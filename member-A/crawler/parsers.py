import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .http_client import normalize_url


LIST_PAGE_RE = re.compile(r"^[a-z0-9_/\-]+\.(htm|html)$", re.I)
INFO_ARTICLE_RE = re.compile(r"/info/\d+/\d+\.(htm|html)$", re.I)
PAGE_ARTICLE_RE = re.compile(r"/\d{4}/\d{4}/c\d+a\d+/page\.htm$", re.I)
NOTICE_ARTICLE_RE = re.compile(
    r"/(notice|service)/[^?#]+?\.(html?)$",
    re.I,
)
PHP_ID_RE = re.compile(r"(?:^|[?&/])(?:v7list|v7show|show|article)\.php\?id=\d+", re.I)
ASPX_DETAIL_RE = re.compile(
    r"/(breakingnews|hotspotnews|announcement|recruitment|internship|"
    r"specialrecruitment|campusdouble|airtalk|jobinformation)/.+",
    re.I,
)
GRAD_ARTICLE_RE = re.compile(r"/(article|detail|content|news)/\d+", re.I)
WP_POST_RE = re.compile(r"[?&]p=\d+", re.I)

_NAV_TITLES = {
    "新闻博览",
    "党建文化",
    "人才培养",
    "科研进展",
    "媒体关注",
    "专题新闻",
    "通知公告",
    "首页",
    "ENGLISH",
    "更多",
    "更多>>",
    "查看更多+",
    "单位登录",
    "注册",
    "新闻速递",
    "关于我们",
}


def is_candidate_article(url: str, link_mode: str = "auto") -> bool:
    path = urlparse(url).path
    lower = path.lower()
    full = url.lower()

    checks = {
        "info": bool(INFO_ARTICLE_RE.search(lower)),
        "page": bool(PAGE_ARTICLE_RE.search(lower)),
        "notice": bool(NOTICE_ARTICLE_RE.search(lower)),
        "php_id": bool(PHP_ID_RE.search(full) or "v7list.php?id=" in full),
        "list_any": False,
    }

    if link_mode == "auto":
        return any(
            [
                checks["info"],
                checks["page"],
                checks["notice"],
                checks["php_id"],
                bool(GRAD_ARTICLE_RE.search(lower)),
                bool(WP_POST_RE.search(full)),
            ]
        )

    if link_mode == "notice":
        return bool(
            NOTICE_ARTICLE_RE.search(lower)
            or INFO_ARTICLE_RE.search(lower)
            or PAGE_ARTICLE_RE.search(lower)
        )

    if link_mode == "list_any":
        if any(x in lower for x in ("list.aspx", "list.htm", "index.aspx", "/column/")):
            return False
        if lower.endswith(("/login", "/login/", "/regedit.aspx")):
            return False
        return bool(
            INFO_ARTICLE_RE.search(lower)
            or PAGE_ARTICLE_RE.search(lower)
            or NOTICE_ARTICLE_RE.search(lower)
            or PHP_ID_RE.search(full)
            or "detail" in lower
            or "view.aspx" in lower
            or "show.aspx" in lower
            or GRAD_ARTICLE_RE.search(lower)
            or WP_POST_RE.search(full)
            or re.search(r"[?&]id=\d+", full)
        )

    return checks.get(link_mode, False)


def extract_article_links(
    soup: BeautifulSoup,
    page_url: str,
    link_mode: str = "auto",
) -> list[tuple[str, str]]:
    seen: set[str] = set()
    results: list[tuple[str, str]] = []

    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "").strip()
        title = anchor.get_text(" ", strip=True)
        if not title or len(title) < 6 or title in _NAV_TITLES:
            continue

        absolute = normalize_url(page_url, href)
        if not absolute or not is_candidate_article(absolute, link_mode):
            continue
        if absolute in seen:
            continue

        seen.add(absolute)
        results.append((title, absolute))

    return results


def extract_list_page_links(soup: BeautifulSoup, page_url: str) -> list[str]:
    base_path = urlparse(page_url).path
    current_name = base_path.rsplit("/", 1)[-1]
    prefix = current_name.rsplit(".", 1)[0] if "." in current_name else current_name
    links: set[str] = set()

    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "").strip()
        if not href or href.startswith(("javascript:", "#")):
            continue

        absolute = normalize_url(page_url, href)
        if not absolute:
            continue

        path = urlparse(absolute).path
        filename = path.rsplit("/", 1)[-1]
        if filename.endswith("list.htm") or re.search(r"list\d*\.htm$", filename, re.I):
            links.add(absolute)
            continue
        if not LIST_PAGE_RE.match(filename):
            continue
        if prefix and prefix[:3] not in filename and filename != current_name:
            continue
        if is_candidate_article(absolute, "auto"):
            continue

        links.add(absolute)

    return sorted(links)


def parse_article_page(soup: BeautifulSoup, fallback_title: str) -> tuple[str, str, str]:
    title_el = soup.select_one(
        ".article-title, .Article_Title, h1, .news_title, .title, .arti_title, .content-title"
    )
    date_el = soup.select_one(
        ".date, .arti_update, .Article_PublishDate, .news_meta, .publish-time, .time"
    )
    content_el = soup.select_one(
        ".v_news_content, .Article_Content, .arti_content, #vsb_content, "
        ".article-content, .wp_articlecontent, .content, .news-content"
    )

    title = _extract_title(soup, title_el, fallback_title)
    published_at = date_el.get_text(" ", strip=True) if date_el else ""
    content = content_el.get_text("\n", strip=True) if content_el else ""
    return title, published_at, content


def _extract_title(soup: BeautifulSoup, title_el, fallback_title: str) -> str:
    if title_el is not None:
        title = title_el.get_text(" ", strip=True)
        if title and title not in _NAV_TITLES and len(title) >= 6:
            return title

    if soup.title and soup.title.string:
        page_title = soup.title.string.strip()
        for suffix in (
            "-中国科大新闻网",
            "-中国科学技术大学",
            "_中国科学技术大学",
            "-学工在线",
            "-中国科学技术大学研究生院",
        ):
            if suffix in page_title:
                page_title = page_title.split(suffix, 1)[0].strip()
                break
        if page_title and page_title not in _NAV_TITLES:
            return page_title

    return fallback_title
