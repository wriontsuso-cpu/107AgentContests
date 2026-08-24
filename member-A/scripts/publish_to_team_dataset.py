#!/usr/bin/env python3
"""把本地文档/衍生入口按团队规范写入 data without log in。"""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
TEAM_DIR = REPO / "data without log in"
RAW_PATH = TEAM_DIR / "原始数据_整合.json"
ST_PATH = TEAM_DIR / "原始数据_整合_search_text.json"
LOCAL = ROOT / "data" / "local_docs" / "merged_for_import.json"

CATEGORY_MAP = {
    "新生事务": "新生指南",
}

CAT_MD = {
    "网站入口": "网站入口.md",
    "二课/团学活动": "二课_团学活动.md",
    "竞赛/科创": "竞赛_科创.md",
    "办事指南": "办事指南.md",
    "新生指南": "新生指南.md",
    "教务选课": "教务选课.md",
}


def norm_url(url: str) -> str:
    u = (url or "").strip().replace("http://", "https://").lower().rstrip("/")
    return u


def make_search_text(article: dict) -> str:
    parts = [article.get("title") or "", f"栏目：{article.get('category') or ''}"]
    tags = article.get("tags") or []
    if tags:
        parts.append("标签：" + "、".join(tags))
    how = (article.get("how_to") or "").strip()
    body = (article.get("content") or article.get("summary") or "").strip()
    body = re.sub(r"\s+", " ", body)
    if how and how not in body:
        parts.append(how)
    if body:
        parts.append(body[:4000])
    return " ".join(p for p in parts if p).strip()


def stable_local_url(item: dict) -> str:
    url = item.get("url") or ""
    if url.startswith("file:"):
        name = Path(urlparse(url).path).name
        if not name:
            name = Path(item.get("title") or "doc").name
        return f"local://ustc-docs/{name}"
    return url


def to_team_article(item: dict) -> dict:
    category = CATEGORY_MAP.get(item.get("category") or "", item.get("category") or "办事指南")
    url = stable_local_url(item)
    parsed = urlparse(url)
    source_site = parsed.netloc or ("local.doc" if url.startswith("local://") else "curated.local")
    content = (item.get("content") or item.get("summary") or "")[:8000]
    content = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", content)
    content = re.sub(r"\n{3,}", "\n\n", content).strip()
    summary = (item.get("summary") or content)[:280]
    summary = re.sub(r"\s+", " ", summary).strip()
    article = {
        "title": item.get("title") or "",
        "url": url,
        "source": item.get("source") or "本地文档入库（成员A）",
        "category": category,
        "published_at": item.get("published_at") or "",
        "summary": summary,
        "content": content or summary,
        "crawled_at": item.get("crawled_at") or datetime.now(timezone.utc).isoformat(),
        "tags": item.get("tags") or [],
        "cost": item.get("cost") or "",
        "how_to": item.get("how_to") or "",
        "relevance_score": int(item.get("relevance_score") or 10),
        "kind": "curated",
        "source_site": source_site,
        "related_urls": [],
    }
    return article


def md_item(article: dict, index: int) -> str:
    tags = " | ".join(article.get("tags") or [])
    lines = [
        f"## {index}. {article['title']}",
        "- 访问属性：公开可访问",
        f"- 来源：{article.get('source') or ''}",
        f"- 链接：{article.get('url') or ''}",
    ]
    if article.get("cost"):
        lines.append(f"- 费用：{article['cost']}")
    if article.get("how_to"):
        lines.append(f"- 获取方式：{article['how_to']}")
    if tags:
        lines.append(f"- 标签：{tags}")
    if article.get("summary"):
        lines.append(f"- 摘要：{article['summary']}")
    return "\n".join(lines) + "\n"


def rewrite_category_md(path: Path, articles: list[dict]) -> None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    title_line = lines[0] if lines else f"# {path.stem}"
    rest = "\n".join(lines[1:])
    rest = re.sub(r"^(?:\s*共 \d+ 条\s*\n)+", "", rest)
    existing_n = len(re.findall(r"^## \d+\. ", rest, flags=re.M))
    new_total = existing_n + len(articles)
    chunks = [title_line, "", f"共 {new_total} 条", "", rest.strip(), ""]
    start = existing_n + 1
    for i, art in enumerate(articles, start=start):
        chunks.append(md_item(art, i))
    out = re.sub(r"\n{3,}", "\n\n", "\n".join(chunks)).strip() + "\n"
    path.write_text(out, encoding="utf-8")


def update_overview(all_articles: list[dict]) -> None:
    counts = Counter(a.get("category") for a in all_articles)
    src_counts = Counter(a.get("source") for a in all_articles)
    now = datetime.now(timezone.utc).isoformat()
    lines = [
        "# 整合去重 · 总览",
        "",
        f"- 原始采集时间：2026-08-16T17:00:56.639822+00:00",
        f"- 最近增量：{now}（本地文档入库）",
        f"- 条目总数：{len(all_articles)}",
        "",
        "## 按栏目",
        "",
    ]
    for cat, n in counts.most_common():
        lines.append(f"- {cat}: {n}")
    lines += ["", "## 按来源（前 20）", ""]
    for src, n in src_counts.most_common(20):
        lines.append(f"- {src}: {n}")
    lines.append("")
    (TEAM_DIR / "文档" / "00_总览与使用说明.md").write_text("\n".join(lines), encoding="utf-8")

    # 01 index: keep existing order, update numbers
    index_path = TEAM_DIR / "文档" / "01_按栏目索引.md"
    index_text = index_path.read_text(encoding="utf-8")

    def repl(m: re.Match) -> str:
        name = m.group(1)
        return f"[{name}]({m.group(2)})（{counts.get(name, 0)}）"

    index_text = re.sub(r"\[([^\]]+)\]\((按栏目/[^)]+)\)（\d+）", repl, index_text)
    index_path.write_text(index_text, encoding="utf-8")


def append_full_list(new_articles: list[dict], start_index: int) -> None:
    path = TEAM_DIR / "文档" / "02_全量清单.md"
    extra = ["\n"]
    for i, art in enumerate(new_articles, start=start_index):
        extra.append(f"## {i}. [{art['category']}] {art['title']}\n")
        extra.append("- 访问属性：公开可访问\n")
        extra.append(f"- 来源：{art.get('source')}\n")
        extra.append(f"- URL：{art.get('url')}\n")
        if art.get("cost"):
            extra.append(f"- 费用：{art['cost']}\n")
        if art.get("how_to"):
            extra.append(f"- 获取：{art['how_to']}\n")
        if art.get("summary"):
            extra.append(f"- 摘要：{art['summary']}\n")
        tags = art.get("tags") or []
        if tags:
            extra.append(f"- 标签：{' | '.join(tags)}\n")
        extra.append("\n")
    with path.open("a", encoding="utf-8") as f:
        f.writelines(extra)


def patch_readme_counts(total: int) -> None:
    spec = REPO / "数据接口规范.md"
    spec_text = spec.read_text(encoding="utf-8")
    spec_text = re.sub(r"\| 条数 \| .* \|", f"| 条数 | {total} |", spec_text)
    spec.write_text(spec_text, encoding="utf-8")

    root_readme = REPO / "README.md"
    rr = root_readme.read_text(encoding="utf-8")
    rr = re.sub(r"（1295 条，含 search_text）", f"（{total} 条，含 search_text）", rr)
    root_readme.write_text(rr, encoding="utf-8")

    team_readme = TEAM_DIR / "README.md"
    tr = team_readme.read_text(encoding="utf-8")
    tr = re.sub(r"- 条目总数：\d+", f"- 条目总数：{total}", tr)
    tr = re.sub(
        r"- 生成时间：.*",
        f"- 生成时间：{datetime.now(timezone.utc).isoformat()}",
        tr,
        count=1,
    )
    team_readme.write_text(tr, encoding="utf-8")


def main() -> int:
    payload = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    st_payload = json.loads(ST_PATH.read_text(encoding="utf-8"))
    local = json.loads(LOCAL.read_text(encoding="utf-8"))

    existing = payload.get("articles") or []
    known = {norm_url(a.get("url") or "") for a in existing if a.get("url")}

    added: list[dict] = []
    by_cat: dict[str, list[dict]] = {}
    for raw in local.get("articles") or []:
        art = to_team_article(raw)
        key = norm_url(art["url"])
        if not key or key in known:
            continue
        known.add(key)
        added.append(art)
        by_cat.setdefault(art["category"], []).append(art)

    if not added:
        print("没有可新增条目（URL 均已存在）")
        return 0

    all_articles = existing + added
    now = datetime.now(timezone.utc).isoformat()
    curated = sum(1 for a in all_articles if a.get("kind") == "curated")
    crawled = len(all_articles) - curated
    payload.update(
        {
            "generated_at": now,
            "total": len(all_articles),
            "curated": curated,
            "crawled": crawled,
            "articles": all_articles,
        }
    )
    RAW_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    st_articles = (st_payload.get("articles") or []) + [
        {**a, "search_text": make_search_text(a)} for a in added
    ]
    st_payload.update(
        {
            "generated_at": now,
            "total": len(st_articles),
            "curated": curated,
            "crawled": crawled,
            "search_text_generated": now,
            "articles": st_articles,
        }
    )
    ST_PATH.write_text(json.dumps(st_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    docs_dir = TEAM_DIR / "文档" / "按栏目"
    for cat, arts in by_cat.items():
        md_name = CAT_MD.get(cat)
        if not md_name:
            print(f"跳过无栏目文档: {cat}")
            continue
        rewrite_category_md(docs_dir / md_name, arts)

    update_overview(all_articles)
    append_full_list(added, start_index=len(existing) + 1)
    patch_readme_counts(len(all_articles))

    print(f"新增 {len(added)} 条，总计 {len(all_articles)}")
    for a in added:
        print(f"  - [{a['category']}] {a['title']} -> {a['url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
