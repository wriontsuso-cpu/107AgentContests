#!/usr/bin/env python3
"""Assign retrieval weights and searchable aliases to the campus resource catalog."""

from __future__ import annotations

import csv
import hashlib
import json
import re
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
CSV_PATH = DATA_DIR / "表格" / "整合去重_全量.csv"

NEWS_HINT = re.compile(r"我校|举行|召开|圆满|喜迎|赴.{0,12}开展|关于印发|通知公告")
DATE_HINT = re.compile(r"\d{4}|^\d{1,2}\s")
PORTAL_CATEGORIES = {"资源导航", "网站入口"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    ]
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
    if unique_aliases:
        parts.append(" ".join(unique_aliases))
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
    weight = compute_weight(enriched, ranking)
    enriched["id"] = resource_id(enriched)
    enriched["tags"] = enrich_tags(enriched, ranking)
    enriched["weight"] = weight
    enriched["relevance_score"] = weight
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
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated)


def main() -> None:
    ranking = load_json(RANKING_PATH)
    source_path = next(path for path in SOURCE_CANDIDATES if path.exists())
    payload = load_json(source_path)
    articles = payload["articles"] if isinstance(payload, dict) else payload
    enriched = [enrich_article(article, ranking) for article in articles]

    generated_at = datetime.now(timezone.utc).isoformat()
    envelope = {
        **({key: value for key, value in payload.items() if key != "articles"} if isinstance(payload, dict) else {}),
        "total": len(enriched),
        "weights_generated": generated_at,
        "articles": enriched,
    }

    dump_json(DATA_DIR / "原始数据_整合.json", envelope)
    dump_json(DATA_DIR / "原始数据_整合_search_text.json", envelope)
    dump_json(FRONTEND_JSON, envelope)
    update_csv(enriched)

    weights = [article["weight"] for article in enriched]
    print(f"updated {len(enriched)} resources")
    print(f"weight min={min(weights)} median={sorted(weights)[len(weights)//2]} max={max(weights)}")
    print(f"weight>=7: {sum(1 for value in weights if value >= 7)}")


if __name__ == "__main__":
    main()
