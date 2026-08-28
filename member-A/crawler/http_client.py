import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

import config


class HttpClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": config.USER_AGENT})
        self._last_request_at = 0.0

    def get_soup(self, url: str) -> BeautifulSoup | None:
        html = self.get_text(url)
        if html is None:
            return None
        return BeautifulSoup(html, "lxml")

    def get_text(self, url: str) -> str | None:
        self._respect_delay()
        try:
            response = self.session.get(url, timeout=config.REQUEST_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException:
            return None

        response.encoding = response.apparent_encoding or "utf-8"
        return response.text

    def _respect_delay(self) -> None:
        elapsed = time.time() - self._last_request_at
        if elapsed < config.REQUEST_DELAY_SECONDS:
            time.sleep(config.REQUEST_DELAY_SECONDS - elapsed)
        self._last_request_at = time.time()


def normalize_url(base_url: str, href: str) -> str | None:
    if not href or href.startswith(("javascript:", "#", "mailto:")):
        return None
    return urljoin(base_url, href)


def is_article_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return "/info/" in path and path.endswith((".htm", ".html"))
