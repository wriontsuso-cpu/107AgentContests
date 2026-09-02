"""Fetch and extract a bounded text snapshot from a database resource URL."""

from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
from ipaddress import ip_address
import re
import time
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


_CHARSET_PATTERN = re.compile(r"charset\s*=\s*['\"]?([^\s;'\"]+)", re.IGNORECASE)
_WHITESPACE_PATTERN = re.compile(r"\s+")


@dataclass(frozen=True)
class PageSnapshot:
    requested_url: str
    final_url: str
    title: str
    text: str


class PageReader(Protocol):
    def read(self, url: str) -> PageSnapshot:
        """Visit a public URL and return the extracted current page content."""


class HttpPageReader:
    def __init__(
        self,
        timeout_seconds: float = 20.0,
        max_download_bytes: int = 1_500_000,
        max_text_characters: int = 8_000,
    ) -> None:
        self.timeout_seconds = max(timeout_seconds, 1.0)
        self.max_download_bytes = max(max_download_bytes, 1_024)
        self.max_text_characters = max(max_text_characters, 500)

    def read(self, url: str) -> PageSnapshot:
        requested_url = _public_url(url)
        attempts = _request_urls(requested_url)
        last_error: Exception | None = None

        for request_url in attempts:
            for attempt in range(2):
                try:
                    return self._read_once(requested_url, request_url)
                except (
                    HTTPError,
                    URLError,
                    TimeoutError,
                    OSError,
                    ValueError,
                    UnicodeError,
                ) as exc:
                    last_error = exc
                    if attempt == 0:
                        time.sleep(0.25)

        raise RuntimeError(f"Unable to read resource page: {requested_url}") from last_error

    def _read_once(
        self,
        requested_url: str,
        request_url: str,
    ) -> PageSnapshot:
        request = Request(
            request_url,
            headers={
                "User-Agent": "Mozilla/5.0 USTC-Resource-Navigator/1.0",
                "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
            },
        )
        with urlopen(request, timeout=self.timeout_seconds) as response:
            final_url = _public_url(response.geturl())
            media_type = response.headers.get("content-type", "").lower()
            if media_type and not any(
                allowed in media_type
                for allowed in ("text/", "html", "xhtml", "json", "xml")
            ):
                raise ValueError(f"Unsupported page content type: {media_type}")
            body = response.read(self.max_download_bytes)

        encoding = _response_encoding(media_type)
        decoded = body.decode(encoding, errors="replace")
        if "html" in media_type or "<html" in decoded[:500].lower():
            parser = _VisibleTextParser()
            parser.feed(decoded)
            title = _clean_text(" ".join(parser.title_parts))
            text = _clean_text(" ".join(parser.text_parts))
        else:
            title = ""
            text = _clean_text(decoded)

        if not text and not title:
            raise ValueError("Resource page contained no readable text.")
        return PageSnapshot(
            requested_url=requested_url,
            final_url=final_url,
            title=title,
            text=text[:self.max_text_characters],
        )


class _VisibleTextParser(HTMLParser):
    _SKIPPED_TAGS = {"script", "style", "noscript", "template", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        lowered = tag.lower()
        if lowered in self._SKIPPED_TAGS:
            self._skip_depth += 1
        if lowered == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered in self._SKIPPED_TAGS and self._skip_depth:
            self._skip_depth -= 1
        if lowered == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        value = data.strip()
        if not value or self._skip_depth:
            return
        self.text_parts.append(value)
        if self._in_title:
            self.title_parts.append(value)


def _request_urls(url: str) -> tuple[str, ...]:
    parsed = urlparse(url)
    if parsed.scheme == "http":
        https_url = parsed._replace(scheme="https").geturl()
        return (https_url, url)
    return (url,)


def _public_url(url: str) -> str:
    value = url.strip()
    parsed = urlparse(value)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only public HTTP(S) resource URLs can be read.")
    hostname = parsed.hostname.lower().rstrip(".")
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise ValueError("Local resource URLs are not allowed.")
    try:
        address = ip_address(hostname)
    except ValueError:
        pass
    else:
        if not address.is_global:
            raise ValueError("Non-public resource IP addresses are not allowed.")
    return parsed._replace(
        scheme=parsed.scheme.lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
    ).geturl()


def _response_encoding(content_type: str) -> str:
    match = _CHARSET_PATTERN.search(content_type)
    return match.group(1) if match else "utf-8"


def _clean_text(value: str) -> str:
    return _WHITESPACE_PATTERN.sub(" ", value).strip()
