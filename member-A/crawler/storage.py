import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from .models import Article


def ensure_output_dir(path: str | Path) -> Path:
    output_dir = Path(path)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def save_json(articles: list[Article], output_dir: Path, filename: str = "student_resources.json") -> Path:
    target = output_dir / filename
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(articles),
        "curated": sum(1 for item in articles if item.kind == "curated"),
        "crawled": sum(1 for item in articles if item.kind != "curated"),
        "articles": [article.to_dict() for article in articles],
    }
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def save_csv(articles: list[Article], output_dir: Path, filename: str = "student_resources.csv") -> Path:
    target = output_dir / filename
    fields = [
        "kind",
        "title",
        "url",
        "source",
        "category",
        "tags",
        "cost",
        "how_to",
        "published_at",
        "summary",
        "relevance_score",
        "crawled_at",
    ]

    with target.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for article in articles:
            row = article.to_dict()
            row["tags"] = " | ".join(row.get("tags") or [])
            writer.writerow({field: row.get(field, "") for field in fields})

    return target


def save_by_category(articles: list[Article], output_dir: Path) -> Path:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for article in articles:
        grouped[article.category or "未分类"].append(article.to_dict())

    target = output_dir / "by_category.json"
    target.write_text(json.dumps(grouped, ensure_ascii=False, indent=2), encoding="utf-8")
    return target


def save_summary(articles: list[Article], output_dir: Path, filename: str = "summary.txt") -> Path:
    target = output_dir / filename
    category_counts = Counter(article.category for article in articles)
    tag_counts: Counter[str] = Counter()
    for article in articles:
        tag_counts.update(article.tags)

    curated = [item for item in articles if item.kind == "curated"]
    crawled = [item for item in articles if item.kind != "curated"]

    lines = [
        "中科大学生资源收集摘要",
        "=" * 40,
        f"总计条目: {len(articles)}（精选 {len(curated)} + 爬取 {len(crawled)}）",
        "",
        "按栏目统计:",
    ]
    for category, count in category_counts.most_common():
        lines.append(f"  - {category}: {count}")

    lines.extend(["", "热门标签:"])
    for tag, count in tag_counts.most_common(15):
        lines.append(f"  - {tag}: {count}")

    lines.extend(["", "精选资源（节选）:"])
    for article in curated[:12]:
        lines.append(f"  [{article.category}] {article.title}")
        lines.append(f"    {article.url}")
        if article.cost:
            lines.append(f"    费用: {article.cost}")

    lines.extend(["", "最新/高相关爬取条目:"])
    for article in crawled[:12]:
        lines.append(f"  [{article.category}|score={article.relevance_score}] {article.title}")
        lines.append(f"    {article.url}")

    target.write_text("\n".join(lines), encoding="utf-8")
    return target
