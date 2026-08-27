"""Knowledge-base adapters and retrieval for the authoritative resource data."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from hashlib import md5
import json
from pathlib import Path
import re
from urllib.parse import urlparse

from config import KnowledgeBaseConfig


CATEGORY_GROUPS: dict[str, tuple[str, ...]] = {
    "services": ("办事指南", "财务服务", "保卫服务", "网站入口", "校级通知", "公示公告", "资源导航", "学工通知", "教务服务"),
    "learning": ("教务通知", "教务选课", "图书馆", "图书馆资源", "免费软件-会员"),
    "research": ("学术科研", "会议-学术交流", "超算中心"),
    "competition": ("竞赛-科创", "勤工助学"),
    "community": ("校园活动", "二课-团学活动", "青春科大", "媒体关注"),
    "life": ("新生指南", "迎新资讯", "新生事务"),
    "wellbeing": ("校医院", "奖助学金"),
    "future": ("就业实习", "研究生培养", "本科招生", "留学-出境交流", "留学-国际交流"),
}

_CHINESE_SEQUENCE = re.compile(r"[\u4e00-\u9fff]+")
_ASCII_WORD = re.compile(r"[a-z0-9]+")
_IGNORED_TERMS = {
    "一个", "一些", "什么", "怎么", "怎样", "如何", "可以", "需要", "想要", "我想",
    "了解", "相关", "资源", "一下", "是否", "有没有", "哪里", "哪个", "哪些", "帮助",
}


@dataclass(frozen=True)
class Resource:
    title: str
    id: str
    url: str
    source: str
    category: str
    summary: str = ""
    content: str = ""
    published_at: str = ""
    crawled_at: str = ""
    tags: tuple[str, ...] = ()
    cost: str = ""
    how_to: str = ""
    relevance_score: float = 0.0
    kind: str = ""
    source_site: str = ""
    related_urls: tuple[str, ...] = ()
    source_count: int = 1
    authority_label: str = ""
    search_text: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "title": self.title,
            "id": self.id,
            "url": self.url,
            "source": self.source,
            "category": self.category,
            "summary": self.summary,
            "content": self.content,
            "published_at": self.published_at,
            "crawled_at": self.crawled_at,
            "tags": list(self.tags),
            "cost": self.cost,
            "how_to": self.how_to,
            "relevance_score": self.relevance_score,
            "kind": self.kind,
            "source_site": self.source_site,
            "related_urls": list(self.related_urls),
            "source_count": self.source_count,
            "authority_label": self.authority_label,
            "search_text": self.search_text,
        }


class KnowledgeBase(ABC):
    @property
    @abstractmethod
    def resources(self) -> tuple[Resource, ...]:
        """Return all normalized resources in the knowledge base."""

    def search(
        self,
        query: str,
        limit: int,
        category: str | None = None,
    ) -> list[Resource]:
        candidates = [
            resource
            for resource in self.resources
            if self._matches_category(resource, category)
        ]
        return self._rank(candidates, query)[:limit]

    def list_resources(
        self,
        query: str = "",
        category: str | None = None,
        group: str | None = None,
        tag: str | None = None,
    ) -> list[Resource]:
        candidates = [
            resource
            for resource in self.resources
            if self._matches_category(resource, category)
            and (not group or resource.category == group)
            and (not tag or tag in resource.tags)
        ]
        if query.strip():
            return self._rank(candidates, query)
        return sorted(
            candidates,
            key=lambda resource: (-resource.relevance_score, resource.category, resource.title),
        )

    def get(self, resource_id: str) -> Resource | None:
        return next(
            (resource for resource in self.resources if resource.id == resource_id),
            None,
        )

    def categories(self) -> list[dict[str, object]]:
        category_names = sorted({resource.category for resource in self.resources})
        return [
            {
                "name": name,
                "count": sum(1 for resource in self.resources if resource.category == name),
                "tags": sorted({
                    tag
                    for resource in self.resources
                    if resource.category == name
                    for tag in resource.tags
                }),
            }
            for name in category_names
        ]

    def is_known_url(self, value: str) -> bool:
        normalized = _normalize_url(value)
        if not normalized:
            return False
        return any(
            normalized == _normalize_url(candidate)
            for resource in self.resources
            for candidate in (resource.url, *resource.related_urls)
        )

    @staticmethod
    def _matches_category(resource: Resource, category: str | None) -> bool:
        if not category:
            return True
        if category == "other":
            grouped = {item for values in CATEGORY_GROUPS.values() for item in values}
            return resource.category not in grouped
        if category in CATEGORY_GROUPS:
            return resource.category in CATEGORY_GROUPS[category]
        return resource.category == category

    @staticmethod
    def _rank(resources: list[Resource], query: str) -> list[Resource]:
        terms = _query_terms(query)
        if not terms:
            return []

        scored = [
            (_score_resource(resource, query, terms), resource)
            for resource in resources
        ]
        return [
            resource
            for score, resource in sorted(
                (item for item in scored if item[0] > 0),
                key=lambda item: (-item[0], -item[1].relevance_score, item[1].title),
            )
        ]


class PlaceholderKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return ()


class JsonKnowledgeBase(KnowledgeBase):
    """Loads and normalizes the JSON dataset named by 数据接口规范.md."""

    def __init__(self, data_path: Path) -> None:
        self.data_path = data_path.resolve()
        self._resources = self._load_resources()

    @property
    def resources(self) -> tuple[Resource, ...]:
        return self._resources

    def _load_resources(self) -> tuple[Resource, ...]:
        if not self.data_path.exists():
            raise FileNotFoundError(f"Knowledge-base file not found: {self.data_path}")

        payload = json.loads(self.data_path.read_text(encoding="utf-8"))
        rows = payload.get("articles") if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            raise ValueError("Knowledge-base JSON must contain an articles array.")

        resources = tuple(
            resource
            for row in rows
            if isinstance(row, dict)
            if (resource := _resource_from_row(row)) is not None
        )
        if not resources:
            raise ValueError("Knowledge-base JSON contains no valid resources.")
        return resources


def build_knowledge_base(config: KnowledgeBaseConfig) -> KnowledgeBase:
    provider = config.provider.strip().lower()
    if provider in {"json", "json-file", "local"}:
        return JsonKnowledgeBase(config.data_path)
    if provider in {"placeholder", "none"}:
        return PlaceholderKnowledgeBase()
    raise ValueError(
        f"Unsupported KNOWLEDGE_BASE_PROVIDER '{config.provider}'. "
        "Register a KnowledgeBase implementation in build_knowledge_base()."
    )


def _resource_from_row(row: dict[str, object]) -> Resource | None:
    title = _text(row.get("title"))
    url = _text(row.get("url"))
    if not title or not url:
        return None

    tags = _string_tuple(row.get("tags"))
    related_urls = _string_tuple(row.get("related_urls"))
    category = _text(row.get("category"))
    source = _text(row.get("source"))
    summary = _text(row.get("summary"))
    content = _text(row.get("content"))
    how_to = _text(row.get("how_to"))
    search_text = _text(row.get("search_text")) or " ".join(
        value
        for value in (
            title,
            category,
            " ".join(tags),
            summary,
            content,
            source,
            how_to,
        )
        if value
    )
    resource_id = _text(row.get("id")) or md5(url.encode("utf-8")).hexdigest()[:16]
    source_site = _text(row.get("source_site")) or urlparse(url).netloc
    source_count = _positive_int(row.get("source_count")) or len({
        candidate for candidate in (_normalize_url(url), *map(_normalize_url, related_urls)) if candidate
    }) or 1

    return Resource(
        title=title,
        id=resource_id,
        url=url,
        source=source,
        category=category,
        summary=summary,
        content=content,
        published_at=_text(row.get("published_at")),
        crawled_at=_text(row.get("crawled_at")),
        tags=tags,
        cost=_text(row.get("cost")),
        how_to=how_to,
        relevance_score=_number(row.get("relevance_score")),
        kind=_text(row.get("kind")),
        source_site=source_site,
        related_urls=related_urls,
        source_count=source_count,
        authority_label=_text(row.get("authority_label")),
        search_text=search_text,
    )


def _query_terms(query: str) -> tuple[str, ...]:
    normalized = query.lower().strip()
    terms: set[str] = {
        word for word in _ASCII_WORD.findall(normalized) if len(word) >= 2
    }
    for sequence in _CHINESE_SEQUENCE.findall(normalized):
        if sequence not in _IGNORED_TERMS and len(sequence) <= 8:
            terms.add(sequence)
        terms.update(
            sequence[index:index + 2]
            for index in range(len(sequence) - 1)
            if sequence[index:index + 2] not in _IGNORED_TERMS
        )
    return tuple(sorted(terms, key=lambda value: (-len(value), value)))


def _score_resource(resource: Resource, query: str, terms: tuple[str, ...]) -> float:
    title = resource.title.lower()
    category = resource.category.lower()
    tags = " ".join(resource.tags).lower()
    summary = resource.summary.lower()
    content = resource.content.lower()
    search_text = resource.search_text.lower()
    normalized_query = "".join(query.lower().split())
    normalized_search = "".join(search_text.split())

    score = 0.0
    if normalized_query and normalized_query in normalized_search:
        score += 30.0
    for term in terms:
        length_bonus = min(len(term), 6) * 0.5
        if term in title:
            score += 12.0 + length_bonus
        if term in category:
            score += 9.0 + length_bonus
        if term in tags:
            score += 7.0 + length_bonus
        if term in summary:
            score += 4.0 + length_bonus
        if term in content:
            score += 2.0
        elif term in search_text:
            score += 1.0
    return score + max(resource.relevance_score, 0.0) * 0.05


def _normalize_url(value: str) -> str:
    return value.strip().lower().replace("http://", "https://", 1).rstrip("/")


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _string_tuple(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item.strip() for item in value if isinstance(item, str) and item.strip())


def _number(value: object) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0


def _positive_int(value: object) -> int:
    return int(value) if isinstance(value, (int, float)) and value > 0 else 0
