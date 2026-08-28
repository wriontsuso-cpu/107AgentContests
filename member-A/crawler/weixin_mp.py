"""微信公众号文章抓取（蜗壳小道消息）。"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

import config

ACCOUNT_NAMES = ("蜗壳小道消息", "USTC小道消息")
BLOCKED_AUTHORS = ("微信公众平台",)
ARTICLE_URL_RE = re.compile(r"https://mp\.weixin\.qq\.com/s/[A-Za-z0-9_-]+")


@dataclass
class WeixinArticle:
    title: str
    url: str
    author: str
    published_at: str
    summary: str
    content: str
    out_links: list[str]

    def is_target_account(self) -> bool:
        if any(block in self.author for block in BLOCKED_AUTHORS):
            return False
        if any(name in self.author for name in ACCOUNT_NAMES):
            return True
        title = self.title or ""
        return title.startswith("蜗壳") or "蜗壳小测" in title


def normalize_article_url(url: str) -> str:
    u = (url or "").strip().replace("http://", "https://")
    u = u.split("?")[0].split("#")[0].rstrip("/")
    return u


class WeixinMpClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            }
        )
        self._last_at = 0.0

    def fetch(self, url: str) -> WeixinArticle | None:
        self._sleep()
        try:
            response = self.session.get(url, timeout=config.REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException:
            return None
        response.encoding = response.apparent_encoding or "utf-8"
        return parse_article_html(response.text, normalize_article_url(url))

    def _sleep(self) -> None:
        elapsed = time.time() - self._last_at
        if elapsed < config.REQUEST_DELAY_SECONDS:
            time.sleep(config.REQUEST_DELAY_SECONDS - elapsed)
        self._last_at = time.time()


def parse_article_html(html: str, url: str) -> WeixinArticle | None:
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("#activity-name") or soup.select_one("h1.rich_media_title")
    author_el = soup.select_one("#js_name") or soup.select_one(".profile_nickname")
    content_el = soup.select_one("#js_content")
    time_el = soup.select_one("#publish_time")

    title = title_el.get_text(strip=True) if title_el else ""
    author = author_el.get_text(strip=True) if author_el else ""
    content = content_el.get_text("\n", strip=True) if content_el else ""
    published = time_el.get_text(strip=True) if time_el else ""

    if not title and not content:
        if "验证" in html[:2000] or "secitptpage" in html:
            return None
        og = soup.select_one('meta[property="og:title"]')
        if og and og.get("content"):
            title = og["content"].strip()

    if not title:
        return None

    summary = re.sub(r"\s+", " ", content)[:280]
    out_links = sorted(set(ARTICLE_URL_RE.findall(html)))
    return WeixinArticle(
        title=title,
        url=url,
        author=author,
        published_at=published,
        summary=summary,
        content=content[:8000],
        out_links=out_links,
    )


def crawl_account_bfs(
    seeds: list[str],
    *,
    max_articles: int = 80,
    known_urls: set[str] | None = None,
) -> list[WeixinArticle]:
    """从种子 URL BFS 发现同公众号文章（历史列表 API 需微信登录）。"""
    client = WeixinMpClient()
    known = {normalize_article_url(u) for u in (known_urls or set()) if u}
    queue = [normalize_article_url(u) for u in seeds if u]
    seen: set[str] = set(known)
    results: list[WeixinArticle] = []

    while queue and len(results) < max_articles:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        article = client.fetch(url)
        if article is None:
            continue
        if not article.is_target_account():
            continue

        results.append(article)
        for link in article.out_links:
            link = normalize_article_url(link)
            if link not in seen:
                queue.append(link)

    return results


def to_resource_dict(article: WeixinArticle) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    category = "校园活动"
    if any(k in article.title for k in ("选课", "教务", "培养", "学分", "考试")):
        category = "教务选课"
    elif any(k in article.title for k in ("社团", "二课", "志愿")):
        category = "二课/团学活动"
    elif any(k in article.title for k in ("竞赛", "科创", "实验室", "科研")):
        category = "竞赛/科创"
    elif any(k in article.title for k in ("新生", "入学", "报到")):
        category = "新生指南"

    return {
        "title": article.title,
        "url": article.url,
        "source": "蜗壳小道消息（公众号）",
        "category": category,
        "published_at": article.published_at,
        "summary": article.summary,
        "content": article.content,
        "crawled_at": now,
        "tags": ["蜗壳小道消息", "公众号", "ustc-only", "学生经验"],
        "cost": "免费",
        "how_to": "微信搜索关注「蜗壳小道消息」或在浏览器打开原文链接阅读。",
        "relevance_score": 9,
        "kind": "crawl",
        "source_site": urlparse(article.url).netloc or "mp.weixin.qq.com",
        "related_urls": [],
    }
