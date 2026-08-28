from datetime import datetime, timezone
from urllib.parse import urljoin

import config
from config import SourceConfig

from .catalog import load_curated_resources
from .http_client import HttpClient
from .models import Article
from .parsers import extract_article_links, extract_list_page_links, parse_article_page
from .tagging import infer_tags, score_relevance


def collect_all() -> list[Article]:
    client = HttpClient()
    articles: list[Article] = []
    seen_urls: set[str] = set()

    for curated in load_curated_resources():
        key = f"curated::{curated.title}::{curated.url}"
        if key in seen_urls:
            continue
        seen_urls.add(key)
        # Still reserve the URL so crawl results don't drown curated duplicates.
        seen_urls.add(curated.url)
        articles.append(curated)

    for source in config.SOURCES:
        articles.extend(_collect_source(client, source, seen_urls))

    curated = [item for item in articles if item.kind == "curated"]
    crawled = [item for item in articles if item.kind != "curated"]
    crawled.sort(
        key=lambda item: (item.relevance_score, item.published_at, item.crawled_at),
        reverse=True,
    )
    return curated + crawled


def _collect_source(client: HttpClient, source: SourceConfig, seen_urls: set[str]) -> list[Article]:
    articles: list[Article] = []
    list_urls = _discover_list_pages(client, source)

    for list_url in list_urls:
        soup = client.get_soup(list_url)
        if soup is None:
            continue

        for title, url in extract_article_links(soup, list_url, source.link_mode):
            if url in seen_urls:
                continue
            if len(articles) >= config.MAX_ARTICLES_PER_SOURCE:
                break

            article = _build_article(client, title, url, source)
            if article is None:
                continue
            if config.REQUIRE_STUDENT_RELEVANCE and article.relevance_score < config.MIN_RELEVANCE_SCORE:
                continue

            seen_urls.add(url)
            articles.append(article)

        if len(articles) >= config.MAX_ARTICLES_PER_SOURCE:
            break

    return articles


def _discover_list_pages(client: HttpClient, source: SourceConfig) -> list[str]:
    discovered: list[str] = []
    queue: list[str] = [urljoin(source.base_url, page) for page in source.list_pages]
    visited: set[str] = set()

    while queue and len(discovered) < config.MAX_PAGES_PER_SOURCE:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        discovered.append(current)

        # ASPX / SPA-like portals: avoid aggressive pagination discovery.
        if ".aspx" in current.lower() or "/column/" in current.lower():
            continue

        soup = client.get_soup(current)
        if soup is None:
            continue

        for next_page in extract_list_page_links(soup, current):
            if next_page not in visited and next_page not in queue:
                queue.append(next_page)

    return discovered


def _build_article(
    client: HttpClient,
    fallback_title: str,
    url: str,
    source: SourceConfig,
) -> Article | None:
    crawled_at = datetime.now(timezone.utc).isoformat()
    title = fallback_title
    published_at = ""
    summary = ""
    content = ""

    if config.FETCH_ARTICLE_BODY:
        soup = client.get_soup(url)
        if soup is not None:
            title, published_at, body = parse_article_page(soup, fallback_title)
            content = body
            summary = body[:200]

    score = score_relevance(title, summary, content)
    tags = infer_tags(title, source.category, summary, content)

    return Article(
        title=title,
        url=url,
        source=source.name,
        category=source.category,
        published_at=published_at,
        summary=summary,
        content=content,
        crawled_at=crawled_at,
        tags=tags,
        cost="",
        how_to="",
        relevance_score=score,
        kind="crawl",
    )
