"""加载精选学生资源目录。"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import config
from .models import Article


def load_curated_resources(path: str | Path | None = None) -> list[Article]:
    resource_path = Path(path or config.CURATED_RESOURCES_PATH)
    if not resource_path.exists():
        return []

    raw = json.loads(resource_path.read_text(encoding="utf-8"))
    crawled_at = datetime.now(timezone.utc).isoformat()
    articles: list[Article] = []

    for item in raw:
        articles.append(
            Article(
                title=item.get("title", "").strip(),
                url=item.get("url", "").strip(),
                source=item.get("source", "精选资源目录"),
                category=item.get("category", "精选资源"),
                published_at="",
                summary=item.get("summary", ""),
                content=item.get("summary", ""),
                crawled_at=crawled_at,
                tags=list(item.get("tags", [])),
                cost=item.get("cost", ""),
                how_to=item.get("how_to", ""),
                relevance_score=10,
                kind="curated",
            )
        )

    return [article for article in articles if article.title and article.url]
