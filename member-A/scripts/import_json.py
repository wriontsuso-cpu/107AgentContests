#!/usr/bin/env python3
"""将采集 JSON 清洗并导入 SQLite 数据信息库。"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from db import DEFAULT_DB_PATH, connect, init_schema

INPUT_JSON = ROOT / "output" / "student_resources.json"
CATEGORIES_FILE = ROOT / "data" / "categories_v1.json"
MAPPING_FILE = ROOT / "data" / "category_mapping.json"
VERSION_FILE = ROOT / "data" / "VERSION"

NAV_TITLES = {"首页", "更多", "更多>>", "ENGLISH", "单位登录", "注册"}


def url_hash(url: str) -> str:
    return hashlib.sha256(url.strip().lower().encode("utf-8")).hexdigest()[:32]


def resource_id(url: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, url.strip().lower()))


def infer_access_type(item: dict) -> str:
    tags = item.get("tags") or []
    text = " ".join([item.get("title", ""), item.get("how_to", ""), " ".join(tags)])
    if "需登录" in tags or "需登录" in text or "统一身份认证" in text:
        return "login_required"
    if item.get("kind") == "curated":
        host = re.sub(r"^https?://", "", item.get("url", "")).split("/")[0].lower()
        if not any(x in host for x in ("ustc.edu.cn", "ustc.edu.cn")):
            if "ustc" not in host:
                return "external"
    return "public"


def infer_source_type(item: dict) -> str:
    kind = item.get("kind", "crawl")
    if kind == "curated":
        return "curated"
    return "crawl"


def clean_title(title: str) -> str:
    title = title.strip()
    if not title or title in NAV_TITLES or len(title) < 4:
        return ""
    return title


def load_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def seed_categories(conn, categories_data: dict) -> None:
    conn.execute("DELETE FROM categories")
    for cat in categories_data["categories"]:
        conn.execute(
            """
            INSERT INTO categories (id, parent_id, name, level, path, sort_order, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cat["id"],
                cat.get("parent_id"),
                cat["name"],
                cat["level"],
                cat["path"],
                cat.get("sort_order", 0),
                cat.get("description", ""),
            ),
        )
    conn.commit()


def upsert_tag(conn, name: str) -> int:
    name = name.strip()
    if not name:
        return 0
    conn.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
    row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
    return int(row["id"])


def map_category(legacy: str, mapping: dict) -> str:
    return mapping.get("mapping", {}).get(legacy) or mapping.get("default_category_id", "events_lecture")


def import_resources(conn, payload: dict, mapping: dict) -> dict[str, int]:
    now = datetime.now(timezone.utc).isoformat()
    articles = payload.get("articles") or []
    stats = {"total": len(articles), "inserted": 0, "updated": 0, "skipped": 0}

    for item in articles:
        title = clean_title(item.get("title", ""))
        url = (item.get("url") or "").strip()
        if not title or not url or url.startswith("mailto:"):
            stats["skipped"] += 1
            continue

        rid = resource_id(url)
        uhash = url_hash(url)
        legacy_cat = item.get("category") or "未分类"
        category_id = map_category(legacy_cat, mapping)
        updated_at = item.get("crawled_at") or now

        existing = conn.execute(
            "SELECT id FROM resources WHERE url_hash = ?", (uhash,)
        ).fetchone()

        conn.execute(
            """
            INSERT INTO resources (
                id, title, summary, url, category_id, legacy_category,
                source_type, source_name, access_type, cost, how_to,
                audience, published_at, updated_at, crawled_at,
                relevance_score, status, kind, url_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url_hash) DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                category_id = excluded.category_id,
                legacy_category = excluded.legacy_category,
                source_type = excluded.source_type,
                source_name = excluded.source_name,
                access_type = excluded.access_type,
                cost = excluded.cost,
                how_to = excluded.how_to,
                published_at = excluded.published_at,
                updated_at = excluded.updated_at,
                crawled_at = excluded.crawled_at,
                relevance_score = excluded.relevance_score,
                status = 'active',
                kind = excluded.kind
            """,
            (
                rid,
                title,
                (item.get("summary") or "")[:1000],
                url,
                category_id,
                legacy_cat,
                infer_source_type(item),
                item.get("source") or "",
                infer_access_type(item),
                item.get("cost") or "",
                item.get("how_to") or "",
                "",
                item.get("published_at") or "",
                updated_at,
                item.get("crawled_at") or "",
                int(item.get("relevance_score") or 0),
                "active",
                item.get("kind") or "crawl",
                uhash,
            ),
        )

        if existing:
            stats["updated"] += 1
        else:
            stats["inserted"] += 1

        conn.execute("DELETE FROM resource_tags WHERE resource_id = ?", (rid,))
        for tag in item.get("tags") or []:
            tag_id = upsert_tag(conn, tag)
            if tag_id:
                conn.execute(
                    "INSERT OR IGNORE INTO resource_tags (resource_id, tag_id) VALUES (?, ?)",
                    (rid, tag_id),
                )

        conn.execute(
            """
            INSERT INTO sync_state (url, url_hash, last_seen_at, title)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                url_hash = excluded.url_hash,
                last_seen_at = excluded.last_seen_at,
                title = excluded.title
            """,
            (url, uhash, updated_at, title),
        )

    conn.execute(
        """
        INSERT INTO import_batches (source_file, imported_at, total_rows, inserted, updated, skipped)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            str(INPUT_JSON),
            now,
            stats["total"],
            stats["inserted"],
            stats["updated"],
            stats["skipped"],
        ),
    )
    conn.commit()
    return stats


def write_version(payload: dict, stats: dict) -> None:
    total = payload.get("total", 0)
    generated = payload.get("generated_at", "")
    date = datetime.now().strftime("%Y-%m-%d")
    VERSION_FILE.write_text(
        f"{date}-r{total}-db{stats['inserted'] + stats['updated']}\n",
        encoding="utf-8",
    )


def main() -> int:
    if not INPUT_JSON.exists():
        print(f"找不到输入文件: {INPUT_JSON}")
        print("请先运行: py main.py --full --no-body")
        return 1

    payload = load_json(INPUT_JSON)
    categories_data = load_json(CATEGORIES_FILE)
    mapping = load_json(MAPPING_FILE)

    conn = connect()
    init_schema(conn)
    seed_categories(conn, categories_data)
    stats = import_resources(conn, payload, mapping)
    write_version(payload, stats)

    count = conn.execute("SELECT COUNT(*) AS c FROM resources WHERE status='active'").fetchone()["c"]
    tag_count = conn.execute("SELECT COUNT(*) AS c FROM tags").fetchone()["c"]
    conn.close()

    print("导入完成")
    print(f"数据库: {DEFAULT_DB_PATH}")
    print(f"处理: {stats['total']}  新增: {stats['inserted']}  更新: {stats['updated']}  跳过: {stats['skipped']}")
    print(f"库内有效资源: {count}  标签: {tag_count}")
    print(f"版本: {VERSION_FILE.read_text(encoding='utf-8').strip()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
