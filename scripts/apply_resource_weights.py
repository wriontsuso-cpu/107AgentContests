#!/usr/bin/env python3
"""Assign retrieval weights and searchable aliases to the campus resource catalog."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data without log in"
RANKING_PATH = REPO_ROOT / "frontend" / "src" / "data" / "raw" / "searchRanking.json"
SOURCE_CANDIDATES = [
    DATA_DIR / "原始数据_整合_search_text.json",
    DATA_DIR / "原始数据_整合.json",
]
FRONTEND_JSON = REPO_ROOT / "frontend" / "src" / "data" / "raw" / "resources.json"
CATALOG_METADATA_JSON = REPO_ROOT / "frontend" / "src" / "data" / "raw" / "catalogMetadata.json"
CSV_PATH = DATA_DIR / "表格" / "整合去重_全量.csv"

FRONTEND_FIELDS = {
    "id", "title", "url", "source", "category", "legacy_category",
    "category_id", "category_name", "published_at", "updated_at", "summary",
    "content", "crawled_at", "tags", "cost", "how_to", "access_type",
    "kind", "source_site", "authority_label", "weight", "relevance_score",
    "search_aliases", "url_status", "url_http", "url_err", "url_checked_at",
}

CATEGORY_GROUPS: dict[str, tuple[str, ...]] = {
    "services": ("办事指南", "财务服务", "保卫服务", "网站入口", "校级通知", "公示公告", "资源导航", "学工通知", "教务服务"),
    "learning": ("教务通知", "教务选课", "图书馆", "图书馆资源", "免费软件-会员"),
    "research": ("学术科研", "会议-学术交流", "超算中心", "中心动态"),
    "competition": ("竞赛-科创", "勤工助学"),
    "community": ("校园活动", "二课-团学活动", "青春科大", "媒体关注", "校园资讯", "社团-文体活动", "院系一线", "学研两会-学生组织", "二课-团学办事指南"),
    "life": ("新生指南", "迎新资讯", "新生事务", "生活服务"),
    "wellbeing": ("校医院", "奖助学金"),
    "future": ("就业实习", "研究生培养", "本科招生", "留学-出境交流", "留学-国际交流"),
}
CATEGORY_BY_SOURCE = {
    category: group
    for group, categories in CATEGORY_GROUPS.items()
    for category in categories
}

NEWS_HINT = re.compile(r"我校|举行|召开|圆满|喜迎|赴.{0,12}开展|关于印发|通知公告")
DATE_HINT = re.compile(r"\d{4}|^\d{1,2}\s")
PORTAL_CATEGORIES = {"资源导航", "网站入口"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def dump_compact_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def frontend_projection(payload: dict[str, Any]) -> dict[str, Any]:
    articles = payload.get("articles")
    if not isinstance(articles, list):
        raise ValueError("Catalog payload must contain an articles array.")
    validate_articles(articles)
    return {
        **{key: value for key, value in payload.items() if key != "articles"},
        "total": len(articles),
        "articles": [
            {key: value for key, value in article.items() if key in FRONTEND_FIELDS}
            for article in articles
        ],
    }


def validate_articles(articles: list[Any]) -> None:
    seen: set[str] = set()
    for index, article in enumerate(articles):
        if not isinstance(article, dict):
            raise ValueError(f"Catalog row {index} must be an object.")
        resource_id_value = str(article.get("id") or "").strip()
        if not resource_id_value:
            raise ValueError(f"Catalog row {index} must have a non-empty id.")
        if resource_id_value in seen:
            raise ValueError(f"Duplicate resource id: {resource_id_value}")
        seen.add(resource_id_value)


def publication_exclusion_reason(
    article: dict[str, Any],
    repo_root: Path = REPO_ROOT,
) -> str | None:
    title = str(article.get("title") or "").strip()
    url = str(article.get("url") or "").strip()
    if not title:
        return "missing_title"
    if not url:
        return "missing_url"
    status = str(article.get("url_status") or "").strip()
    if status in {"dead", "unknown"}:
        return status
    if "i.ustc.edu.cn/appDetail/" in url:
        return "wrong_redirect"
    if status == "local":
        relative = url.split("?", 1)[0].removeprefix("./")
        if not (repo_root / "data without log in" / relative).is_file():
            return "missing_local_file"
    return None


def build_catalog_metadata(
    articles: list[dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    counts = {group: 0 for group in (*CATEGORY_GROUPS, "other")}
    for article in articles:
        category = normalize_category(str(article.get("category") or "").strip())
        group = CATEGORY_BY_SOURCE.get(category)
        if group is None:
            raise ValueError(f"Unmapped resource category: {category or '<empty>'}")
        counts[group] += 1
    return {
        "total": len(articles),
        "counts": counts,
        "generatedAt": generated_at,
    }


def merge_publication_summary(
    payload: Any,
    input_total: int,
    current_exclusions: Counter[str] | dict[str, int],
) -> tuple[int, Counter[str]]:
    exclusions = Counter(current_exclusions)
    if not isinstance(payload, dict):
        return input_total, exclusions
    previous_source_total = payload.get("source_total")
    source_total = previous_source_total if isinstance(previous_source_total, int) else input_total
    if source_total > input_total:
        previous = payload.get("excluded_by_reason")
        if isinstance(previous, dict):
            exclusions.update({str(reason): int(count) for reason, count in previous.items()})
    return source_total, exclusions


def normalize_category(value: str) -> str:
    return value.replace("/", "-")


def resource_id(article: dict[str, Any]) -> str:
    existing = str(article.get("id") or "").strip()
    if existing:
        return existing
    seed = str(article.get("url") or article.get("title") or "").encode("utf-8")
    return hashlib.md5(seed).hexdigest()[:16]


def lookup_key_service(title: str, key_services: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    compact = title.strip()
    if compact in key_services:
        return compact, key_services[compact]
    matches = [
        (name, spec)
        for name, spec in key_services.items()
        if name and name in compact
    ]
    if not matches:
        return None
    matches.sort(key=lambda item: len(item[0]), reverse=True)
    return matches[0]


def compute_weight(article: dict[str, Any], ranking: dict[str, Any]) -> float:
    kind = str(article.get("kind") or "")
    if kind == "curated":
        return 10.0

    title = str(article.get("title") or "").strip()
    category = str(article.get("category") or "")
    category_key = normalize_category(category)
    priors = ranking["categoryPriors"]
    score = 1.0 + float(priors.get(category, priors.get(category_key, 1.2)))

    if len(title) <= 12 and not NEWS_HINT.search(title) and not DATE_HINT.search(title):
        score += 2.0
    if NEWS_HINT.search(title) or len(title) > 28 or DATE_HINT.match(title):
        score -= 2.2
    if category in PORTAL_CATEGORIES and 2 <= len(title) <= 16:
        score += 0.8

    matched = lookup_key_service(title, ranking["keyServices"])
    if matched:
        name, spec = matched
        bonus = float(spec.get("bonus") or 0)
        if title == name:
            score += bonus
        else:
            score += bonus * 0.65

    authority = str(article.get("authority_label") or "")
    if category not in {"校园活动", "媒体关注", "青春科大"}:
        if authority in {"校级官方", "职能部门官方"}:
            score += 0.8
        elif authority in {"部门/服务", "部门服务"}:
            score += 0.4

    source_count = article.get("source_count")
    if isinstance(source_count, (int, float)) and source_count > 1:
        score += min(float(source_count) - 1, 3) * 0.4

    if str(article.get("how_to") or "").strip():
        score += 0.5
    if str(article.get("summary") or "").strip():
        score += 0.3
    if article.get("tags"):
        score += 0.2

    return round(max(0.0, min(10.0, score)), 1)


def build_search_aliases(article: dict[str, Any], ranking: dict[str, Any]) -> list[str]:
    title = str(article.get("title") or "").strip()
    category = str(article.get("category") or "").strip()
    tags = article.get("tags") if isinstance(article.get("tags"), list) else []
    aliases: list[str] = []
    matched = lookup_key_service(title, ranking["keyServices"])
    if matched:
        aliases.extend(str(item) for item in matched[1].get("aliases") or [])
    for source, targets in ranking["synonyms"].items():
        haystack = " ".join(part for part in (title, category, " ".join(str(tag) for tag in tags)) if part)
        if source in haystack:
            aliases.extend(targets)
    unique_aliases: list[str] = []
    seen = {title, category, *(str(tag) for tag in tags)}
    for alias in aliases:
        if alias and alias not in seen:
            unique_aliases.append(alias)
            seen.add(alias)
    return unique_aliases


def build_search_text(article: dict[str, Any], ranking: dict[str, Any]) -> str:
    title = str(article.get("title") or "").strip()
    category = str(article.get("category") or "").strip()
    tags = article.get("tags") if isinstance(article.get("tags"), list) else []
    parts = [
        title,
        f"栏目：{category}" if category else "",
        " ".join(str(tag) for tag in tags if str(tag).strip()),
        str(article.get("summary") or "").strip(),
        str(article.get("content") or "").strip(),
        str(article.get("source") or "").strip(),
        str(article.get("how_to") or "").strip(),
        " ".join(build_search_aliases(article, ranking)),
    ]
    return " ".join(part for part in parts if part)


def enrich_tags(article: dict[str, Any], ranking: dict[str, Any]) -> list[str]:
    existing = [str(tag).strip() for tag in article.get("tags") or [] if str(tag).strip()]
    if existing:
        return existing
    matched = lookup_key_service(str(article.get("title") or ""), ranking["keyServices"])
    if not matched:
        return []
    tags = [matched[0], *(str(item) for item in matched[1].get("aliases") or [])]
    unique: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if tag and tag not in seen:
            unique.append(tag)
            seen.add(tag)
    return unique[:6]


def enrich_article(article: dict[str, Any], ranking: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(article)
    enriched["tags"] = enrich_tags(enriched, ranking)
    weight = compute_weight(enriched, ranking)
    enriched["id"] = resource_id(enriched)
    enriched["weight"] = weight
    enriched["relevance_score"] = weight
    enriched["search_aliases"] = build_search_aliases(enriched, ranking)
    enriched["search_text"] = build_search_text(enriched, ranking)
    return enriched


def update_csv(articles: list[dict[str, Any]]) -> None:
    if not CSV_PATH.exists():
        return
    by_url = {str(article.get("url") or ""): article for article in articles}
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    if "相关分" not in fieldnames:
        fieldnames.append("相关分")
    if "检索权重" not in fieldnames:
        fieldnames.append("检索权重")
    updated = []
    for row in rows:
        article = by_url.get(row.get("链接") or "")
        if article is not None:
            row["相关分"] = str(article["relevance_score"])
            row["检索权重"] = str(article["weight"])
        updated.append(row)
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(updated)


def main() -> None:
    ranking = load_json(RANKING_PATH)
    source_path = next(path for path in SOURCE_CANDIDATES if path.exists())
    payload = load_json(source_path)
    articles = payload["articles"] if isinstance(payload, dict) else payload
    exclusion_counts: Counter[str] = Counter()
    publishable: list[dict[str, Any]] = []
    for article in articles:
        reason = publication_exclusion_reason(article)
        if reason:
            exclusion_counts[reason] += 1
        else:
            publishable.append(article)
    source_total, exclusion_counts = merge_publication_summary(payload, len(articles), exclusion_counts)
    enriched = [enrich_article(article, ranking) for article in publishable]
    validate_articles(enriched)

    generated_at = datetime.now(timezone.utc).isoformat()
    envelope = {
        **({key: value for key, value in payload.items() if key != "articles"} if isinstance(payload, dict) else {}),
        "source_total": source_total,
        "total": len(enriched),
        "excluded_total": sum(exclusion_counts.values()),
        "excluded_by_reason": dict(sorted(exclusion_counts.items())),
        "weights_generated": generated_at,
        "articles": enriched,
    }

    dump_json(DATA_DIR / "原始数据_整合.json", envelope)
    dump_json(DATA_DIR / "原始数据_整合_search_text.json", envelope)
    dump_compact_json(FRONTEND_JSON, frontend_projection(envelope))
    dump_json(CATALOG_METADATA_JSON, build_catalog_metadata(enriched, generated_at))
    update_csv(enriched)

    weights = [article["weight"] for article in enriched]
    print(f"updated {len(enriched)} resources")
    print(f"excluded {sum(exclusion_counts.values())}: {dict(sorted(exclusion_counts.items()))}")
    print(f"weight min={min(weights)} median={sorted(weights)[len(weights)//2]} max={max(weights)}")
    print(f"weight>=7: {sum(1 for value in weights if value >= 7)}")


if __name__ == "__main__":
    main()
