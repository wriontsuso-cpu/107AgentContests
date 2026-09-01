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


_RANKING_PATH = (
    Path(__file__).resolve().parent.parent
    / "frontend"
    / "src"
    / "data"
    / "raw"
    / "searchRanking.json"
)
_RANKING: dict[str, object] | None = None

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
    "的", "吗", "呢", "那", "请", "是",
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
    snapshot_version: str = ""
    snapshot_one_liner: str = ""
    snapshot_description: str = ""
    content_kind: str = ""
    recommend_priority: str = ""
    audience: tuple[str, ...] = ()
    access_notes: str = ""
    how_to_steps: tuple[str, ...] = ()
    recommend_when: tuple[str, ...] = ()
    do_not_recommend_when: tuple[str, ...] = ()
    query_aliases: tuple[str, ...] = ()
    negative_aliases: tuple[str, ...] = ()
    supported_intents: tuple[str, ...] = ()
    excluded_intents: tuple[str, ...] = ()
    answerable_facts: tuple[str, ...] = ()
    snapshot_confidence: str = ""
    requires_live_check: bool = True
    snapshot_enrichment: str = ""
    url_status: str = ""

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
        minimum_score: float = 0.0,
    ) -> list[Resource]:
        candidates = [
            resource
            for resource in self.resources
            if self._matches_category(resource, category)
            and resource.recommend_priority.lower() != "skip"
        ]
        return self._rank(candidates, query, minimum_score)[:limit]

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
            and resource.recommend_priority.lower() != "skip"
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
    def _rank(
        resources: list[Resource],
        query: str,
        minimum_score: float = 0.0,
    ) -> list[Resource]:
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
                (item for item in scored if item[0] >= max(minimum_score, 0.0) and item[0] > 0),
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

        rows = self._load_rows()
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

    def _load_rows(self) -> list[object]:
        if self.data_path.suffix.lower() != ".jsonl":
            payload = json.loads(self.data_path.read_text(encoding="utf-8"))
            return payload.get("articles") if isinstance(payload, dict) else payload

        rows: list[object] = []
        with self.data_path.open("r", encoding="utf-8") as source:
            for line_number, line in enumerate(source, start=1):
                if not line.strip():
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"Invalid JSONL at {self.data_path}:{line_number}: {error.msg}"
                    ) from error
        return rows


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

    snapshot_value = row.get("snapshot")
    snapshot = snapshot_value if isinstance(snapshot_value, dict) else {}
    intent_fit_value = snapshot.get("intent_fit")
    intent_fit = intent_fit_value if isinstance(intent_fit_value, dict) else {}

    snapshot_one_liner = _text(snapshot.get("one_liner"))
    snapshot_description = _text(snapshot.get("description"))
    how_to_steps = _string_tuple(snapshot.get("how_to_steps"))
    tags = _merge_string_tuples(
        _string_tuple(row.get("tags")),
        _string_tuple(snapshot.get("tags_normalized")),
    )
    related_urls = _string_tuple(row.get("related_urls"))
    category = _text(row.get("category"))
    source = _text(row.get("source"))
    summary = snapshot_one_liner or _text(row.get("summary"))
    content = snapshot_description or _text(row.get("content"))
    how_to = "；".join(how_to_steps) or _text(row.get("how_to"))
    search_text = (
        _text(row.get("search_text_positive"))
        or _text(row.get("search_text"))
        or " ".join(
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
        relevance_score=_weight(row),
        kind=_text(row.get("kind")),
        source_site=source_site,
        related_urls=related_urls,
        source_count=source_count,
        authority_label=_text(row.get("authority_label")),
        search_text=search_text,
        snapshot_version=_text(snapshot.get("snapshot_version")),
        snapshot_one_liner=snapshot_one_liner,
        snapshot_description=snapshot_description,
        content_kind=_text(snapshot.get("content_kind")),
        recommend_priority=_text(snapshot.get("recommend_priority")),
        audience=_string_tuple(snapshot.get("audience")),
        access_notes=_text(snapshot.get("access_notes")),
        how_to_steps=how_to_steps,
        recommend_when=_string_tuple(intent_fit.get("recommend_when")),
        do_not_recommend_when=_string_tuple(intent_fit.get("do_not_recommend_when")),
        query_aliases=_string_tuple(snapshot.get("query_aliases")),
        negative_aliases=_string_tuple(snapshot.get("negative_aliases")),
        supported_intents=_string_tuple(snapshot.get("supported_intents")),
        excluded_intents=_string_tuple(snapshot.get("excluded_intents")),
        answerable_facts=_fact_tuple(snapshot.get("answerable_facts")),
        snapshot_confidence=_text(snapshot.get("confidence")),
        requires_live_check=_boolean(snapshot.get("requires_live_check"), default=True),
        snapshot_enrichment=_text(snapshot.get("enrichment")),
        url_status=_text(row.get("url_status")) or _text(snapshot.get("url_status_hint")),
    )


def _ranking() -> dict[str, object]:
    global _RANKING
    if _RANKING is None:
        if _RANKING_PATH.exists():
            _RANKING = json.loads(_RANKING_PATH.read_text(encoding="utf-8"))
        else:
            _RANKING = {
                "stopwords": sorted(_IGNORED_TERMS),
                "synonyms": {},
                "pinyin": {},
                "keywords": [],
                "keyServices": {},
            }
    return _RANKING


def _levenshtein(left: str, right: str, max_dist: int) -> int:
    if left == right:
        return 0
    if abs(len(left) - len(right)) > max_dist:
        return max_dist + 1
    if not left:
        return len(right)
    if not right:
        return len(left)
    previous = list(range(len(right) + 1))
    for i, left_ch in enumerate(left, start=1):
        current = [i]
        row_min = i
        for j, right_ch in enumerate(right, start=1):
            cost = 0 if left_ch == right_ch else 1
            value = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            current.append(value)
            row_min = min(row_min, value)
        if row_min > max_dist:
            return max_dist + 1
        previous = current
    return previous[-1]


def _window_distance(haystack: str, needle: str, max_dist: int) -> int:
    if not needle:
        return 0
    if needle in haystack:
        return 0
    if len(haystack) <= len(needle) + max_dist:
        return _levenshtein(haystack, needle, max_dist)
    best = max_dist + 1
    for length in range(max(1, len(needle) - max_dist), len(needle) + max_dist + 1):
        for index in range(0, len(haystack) - length + 1):
            distance = _levenshtein(haystack[index:index + length], needle, max_dist)
            if distance < best:
                best = distance
            if best == 0:
                return 0
    return best


def _field_match_ratio(field: str, token: str, allow_fuzzy: bool = False) -> float:
    if not field or not token:
        return 0.0
    if field == token:
        return 1.0
    if field.startswith(token):
        return 0.92
    if token in field:
        return 0.84
    if not allow_fuzzy or len(token) < 3 or len(field) > 40:
        return 0.0
    token_characters = set(token)
    if (
        len(token_characters) >= 3
        and len(token_characters.intersection(field)) < len(token_characters) - 1
    ):
        return 0.0
    max_dist = 1 if len(token) <= 7 else 2
    distance = _window_distance(field, token, max_dist)
    if distance <= max_dist:
        return max(0.48, 0.8 - distance * 0.16)
    return 0.0


def _expand_query(query: str) -> str:
    ranking = _ranking()
    expanded = query
    synonyms = ranking.get("synonyms")
    if isinstance(synonyms, dict):
        for source, targets in synonyms.items():
            if source in expanded and isinstance(targets, list):
                expanded += " " + " ".join(str(item) for item in targets)
    pinyin = ranking.get("pinyin")
    if isinstance(pinyin, dict):
        lowered = expanded.lower()
        for source, chinese in pinyin.items():
            if str(source).lower() in lowered:
                expanded += f" {chinese}"
    return expanded


def _strip_stopwords(value: str) -> str:
    ranking = _ranking()
    stopwords = ranking.get("stopwords")
    ignored = set(_IGNORED_TERMS)
    if isinstance(stopwords, list):
        ignored.update(str(item) for item in stopwords)
    text = value
    for stop in sorted(ignored, key=len, reverse=True):
        text = text.replace(stop, " ")
    return re.sub(r"\s+", " ", text).strip()


def _segment_chinese(run: str) -> list[str]:
    ranking = _ranking()
    raw_keywords = ranking.get("keywords")
    keywords = sorted(
        (str(item) for item in raw_keywords if str(item)),
        key=len,
        reverse=True,
    ) if isinstance(raw_keywords, list) else []
    parts: list[str] = []
    index = 0
    while index < len(run):
        matched = next((item for item in keywords if run.startswith(item, index)), "")
        if matched:
            parts.append(matched)
            index += len(matched)
            continue
        cursor = index + 1
        while cursor < len(run) and not any(run.startswith(item, cursor) for item in keywords):
            cursor += 1
        chunk = run[index:cursor]
        if len(chunk) >= 2:
            parts.append(chunk)
        elif len(run) == 1:
            parts.append(chunk)
        index = cursor
    return parts


def _query_terms(query: str) -> tuple[str, ...]:
    normalized = query.lower().strip()
    if not normalized:
        return ()
    expanded = _strip_stopwords(_expand_query(normalized))
    terms: set[str] = {normalized}
    terms.update(word for word in _ASCII_WORD.findall(expanded) if len(word) >= 2)
    for sequence in _CHINESE_SEQUENCE.findall(expanded):
        terms.update(_segment_chinese(sequence))
        if sequence not in _IGNORED_TERMS and 2 <= len(sequence) <= 8:
            terms.add(sequence)
    return tuple(sorted((term for term in terms if term), key=lambda value: (-len(value), value)))


def _score_fields(fields: list[tuple[str, float, bool]], token: str) -> float:
    best = 0.0
    for field, weight, allow_fuzzy in fields:
        ratio = _field_match_ratio(field, token, allow_fuzzy)
        if ratio > 0:
            best = max(best, ratio * weight)
    return best


def _score_resource(resource: Resource, query: str, terms: tuple[str, ...]) -> float:
    normalized_query = _normalize_phrase(query)
    if any(
        negative_alias in normalized_query
        for negative_alias in (
            _normalize_phrase(alias) for alias in resource.negative_aliases
        )
        if len(negative_alias) >= 2
    ):
        return 0.0

    title = resource.title.lower()
    category = resource.category.lower()
    tags = " ".join(resource.tags).lower()
    summary = resource.summary.lower()
    content = resource.content.lower()
    search_text = resource.search_text.lower()
    source = resource.source.lower()
    aliases = " ".join(resource.query_aliases).lower()
    full = " ".join(_strip_stopwords(query.lower()).split())
    fields = [
        (title, 100.0, True),
        (aliases, 96.0, False),
        (tags, 58.0, False),
        (category, 44.0, False),
        (source, 32.0, False),
        (summary, 20.0, False),
        (content, 16.0, False),
        (search_text, 12.0, False),
    ]

    full_score = _score_fields(fields, full) * 10.0
    extra_terms = [term for term in terms if term != full]
    scoring_terms = extra_terms or list(terms)
    term_score = 0.0
    matched = 0
    for term in scoring_terms:
        length_bonus = min(max(len(term), 2), 6) / 3
        value = _score_fields(fields, term) * length_bonus
        if value > 0:
            matched += 1
            term_score += value
    coverage = matched / len(scoring_terms) if scoring_terms else 0.0
    strong = full_score >= 280 or term_score >= 70
    covered = coverage >= 0.5 and term_score > 0
    if not strong and not covered and full_score <= 0:
        return 0.0
    score = (
        full_score
        + term_score * (0.45 + 0.55 * coverage)
        + max(resource.relevance_score, 0.0) * 8.0
    )
    score += {"high": 24.0, "medium": 8.0, "low": -32.0}.get(
        resource.recommend_priority.lower(),
        0.0,
    )
    if resource.snapshot_enrichment == "llm_intent_v1":
        score += 8.0
    return max(score, 0.0)


def _normalize_phrase(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def _normalize_url(value: str) -> str:
    parsed = urlparse(value.strip().rstrip("）】》」』，。；、"))
    scheme = "https" if parsed.scheme.lower() in {"http", "https"} else parsed.scheme.lower()
    return parsed._replace(
        scheme=scheme,
        netloc=parsed.netloc.lower(),
        path=parsed.path.rstrip("/"),
        fragment="",
    ).geturl()


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _string_tuple(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item.strip() for item in value if isinstance(item, str) and item.strip())


def _merge_string_tuples(*values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(item for value in values for item in value))


def _fact_tuple(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    facts: list[str] = []
    for item in value:
        fact = item if isinstance(item, str) else item.get("fact") if isinstance(item, dict) else None
        if isinstance(fact, str) and fact.strip():
            facts.append(fact.strip())
    return tuple(dict.fromkeys(facts))


def _boolean(value: object, *, default: bool) -> bool:
    return value if isinstance(value, bool) else default


def _number(value: object) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0


def _weight(row: dict[str, object]) -> float:
    if isinstance(row.get("weight"), (int, float)):
        return float(row["weight"])
    return _number(row.get("relevance_score"))


def _positive_int(value: object) -> int:
    return int(value) if isinstance(value, (int, float)) and value > 0 else 0
