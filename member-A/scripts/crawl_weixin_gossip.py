#!/usr/bin/env python3
"""爬取「蜗壳小道消息」公众号文章并写入团队数据集。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from crawler.weixin_mp import crawl_account_bfs, normalize_article_url, to_resource_dict
from scripts.publish_to_team_dataset import merge_raw_items

SEEDS_PATH = ROOT / "data" / "weixin_gossip" / "seeds.json"
OUT_PATH = ROOT / "data" / "weixin_gossip" / "crawled_articles.json"
TEAM_RAW = ROOT.parent / "data without log in" / "原始数据_整合.json"


def load_known_urls() -> set[str]:
    known: set[str] = set()
    if TEAM_RAW.exists():
        payload = json.loads(TEAM_RAW.read_text(encoding="utf-8"))
        for art in payload.get("articles") or []:
            url = art.get("url") or ""
            if "mp.weixin.qq.com/s/" in url:
                known.add(normalize_article_url(url))
    return known


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="爬取蜗壳小道消息公众号")
    parser.add_argument("--max", type=int, default=60, help="最多抓取新文章数")
    parser.add_argument("--seeds", default=str(SEEDS_PATH), help="种子 URL JSON")
    parser.add_argument("--publish", action="store_true", help="合并进 data without log in 并更新文档")
    parser.add_argument("--dry-run", action="store_true", help="只抓取不写团队库")
    args = parser.parse_args(argv)

    seeds = json.loads(Path(args.seeds).read_text(encoding="utf-8"))
    known = load_known_urls()
    print(f"种子 {len(seeds)} 个，库内已有微信文章 {len(known)} 篇")

    articles = crawl_account_bfs(seeds, max_articles=args.max, known_urls=known)
    resources = [to_resource_dict(a) for a in articles]

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "account": "蜗壳小道消息",
        "biz": "Mzk0Nzc5MTQ3MQ==",
        "crawled": len(resources),
        "articles": resources,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"抓取 {len(resources)} 篇 -> {OUT_PATH}")
    for item in resources:
        print(f"  - {item['title'][:56]} | {item['url']}")

    if args.dry_run or not args.publish:
        if not args.publish:
            print("未加 --publish，仅保存本地 JSON。合并请运行：")
            print("  py scripts/crawl_weixin_gossip.py --publish")
        return 0

    added = merge_raw_items(resources, batch_note="蜗壳小道消息公众号")
    print(f"团队库新增 {added} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
