#!/usr/bin/env python3
"""从 SQLite 导出 B/C 对接用 JSON / JSONL。"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from db import DEFAULT_DB_PATH, connect

EXPORT_DIR = ROOT / "data" / "export"
MOCK_DIR = ROOT / "mock"


def fetch_category_tree(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT id, parent_id, name, level, path, sort_order, description FROM categories ORDER BY sort_order, name"
    ).fetchall()

    by_id: dict[str, dict] = {}
    for row in rows:
        by_id[row["id"]] = {
            "id": row["id"],
            "parent_id": row["parent_id"],
            "name": row["name"],
            "level": row["level"],
            "path": row["path"],
            "sort_order": row["sort_order"],
            "description": row["description"] or "",
            "children": [],
        }

    roots: list[dict] = []
    for node in by_id.values():
        parent_id = node["parent_id"]
        if parent_id and parent_id in by_id:
            by_id[parent_id]["children"].append(node)
        else:
            roots.append(node)

    def sort_children(n: dict) -> None:
        n["children"].sort(key=lambda x: (x["sort_order"], x["name"]))
        for child in n["children"]:
            sort_children(child)

    for root in roots:
        sort_children(root)
    return roots


def fetch_resources(conn) -> list[dict]:
    rows = conn.execute(
        """
        SELECT r.*, c.path AS category_path, c.name AS category_name
        FROM resources r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.status = 'active'
        ORDER BY r.relevance_score DESC, r.updated_at DESC
        """
    ).fetchall()

    results: list[dict] = []
    for row in rows:
        tags = conn.execute(
            """
            SELECT t.name FROM tags t
            JOIN resource_tags rt ON rt.tag_id = t.id
            WHERE rt.resource_id = ?
            ORDER BY t.name
            """,
            (row["id"],),
        ).fetchall()
        results.append(
            {
                "id": row["id"],
                "title": row["title"],
                "summary": row["summary"],
                "url": row["url"],
                "category_id": row["category_id"],
                "category_path": row["category_path"] or "",
                "category_name": row["category_name"] or "",
                "legacy_category": row["legacy_category"],
                "tags": [t["name"] for t in tags],
                "source_type": row["source_type"],
                "source_name": row["source_name"],
                "access_type": row["access_type"],
                "cost": row["cost"],
                "how_to": row["how_to"],
                "published_at": row["published_at"],
                "updated_at": row["updated_at"],
                "relevance_score": row["relevance_score"],
                "kind": row["kind"],
            }
        )
    return results


def fetch_tags(conn) -> list[str]:
    rows = conn.execute("SELECT name FROM tags ORDER BY name").fetchall()
    return [r["name"] for r in rows]


def main() -> int:
    if not DEFAULT_DB_PATH.exists():
        print(f"找不到数据库: {DEFAULT_DB_PATH}")
        print("请先运行: py scripts/import_json.py")
        return 1

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    MOCK_DIR.mkdir(parents=True, exist_ok=True)

    conn = connect()
    tree = fetch_category_tree(conn)
    resources = fetch_resources(conn)
    tags = fetch_tags(conn)
    conn.close()

    generated_at = datetime.now(timezone.utc).isoformat()

    taxonomy = {
        "generated_at": generated_at,
        "category_tree": tree,
        "tags": tags,
        "category_count": len(tree),
        "tag_count": len(tags),
    }
    (EXPORT_DIR / "taxonomy.json").write_text(
        json.dumps(taxonomy, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    with (EXPORT_DIR / "resources.jsonl").open("w", encoding="utf-8") as handle:
        for item in resources:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    api_payload = {
        "generated_at": generated_at,
        "total": len(resources),
        "resources": resources,
    }
    (EXPORT_DIR / "resources.json").write_text(
        json.dumps(api_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    mock_resources = {
        "generated_at": generated_at,
        "description": "供成员 C 前端联调的 Mock 数据（成员 A 提供）",
        "total": len(resources),
        "resources": resources[:100],
    }
    (MOCK_DIR / "resources.json").write_text(
        json.dumps(mock_resources, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    mock_categories = {
        "generated_at": generated_at,
        "description": "分类树 Mock（成员 C 树状浏览）",
        "tree": tree,
    }
    (MOCK_DIR / "categories.json").write_text(
        json.dumps(mock_categories, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("导出完成")
    print(f"分类/标签: {EXPORT_DIR / 'taxonomy.json'}")
    print(f"B 用 JSONL: {EXPORT_DIR / 'resources.jsonl'} ({len(resources)} 条)")
    print(f"全量 JSON: {EXPORT_DIR / 'resources.json'}")
    print(f"C Mock: {MOCK_DIR / 'resources.json'} (前 100 条)")
    print(f"C Mock: {MOCK_DIR / 'categories.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
