from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Article:
    title: str
    url: str
    source: str
    category: str
    published_at: str = ""
    summary: str = ""
    content: str = ""
    crawled_at: str = ""
    tags: list[str] = field(default_factory=list)
    cost: str = ""
    how_to: str = ""
    relevance_score: int = 0
    kind: str = "crawl"  # crawl | curated

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
