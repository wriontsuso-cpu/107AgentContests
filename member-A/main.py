#!/usr/bin/env python3
"""中科大公开信息 / 学生资源收集入口。"""

from __future__ import annotations

import argparse

import config
from crawler import collect_all
from crawler.storage import (
    ensure_output_dir,
    save_by_category,
    save_csv,
    save_json,
    save_summary,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "收集整理中科大公开信息：学生资源、留学交流、活动竞赛、奖助就业等。"
            "登录墙系统（如青春科大）只能收录入口，无法无账号全量抓取。"
        )
    )
    parser.add_argument("--output", default=config.OUTPUT_DIR, help="输出目录，默认 output")
    parser.add_argument("--no-body", action="store_true", help="仅抓取标题和链接，不抓取正文")
    parser.add_argument(
        "--max-articles",
        type=int,
        default=None,
        help="每个来源最多抓取的文章数",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="每个来源最多抓取的列表页数",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="尽量全量：提高页数/条数，关闭学生相关性过滤，覆盖更多栏目",
    )
    parser.add_argument(
        "--all-posts",
        action="store_true",
        help="不过滤学生相关性（比默认宽，比 --full 窄）",
    )
    parser.add_argument(
        "--curated-only",
        action="store_true",
        help="只导出精选资源目录，不联网爬取",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    config.FETCH_ARTICLE_BODY = not args.no_body

    if args.full:
        config.MAX_ARTICLES_PER_SOURCE = config.FULL_MAX_ARTICLES_PER_SOURCE
        config.MAX_PAGES_PER_SOURCE = config.FULL_MAX_PAGES_PER_SOURCE
        config.REQUEST_DELAY_SECONDS = config.FULL_REQUEST_DELAY_SECONDS
        config.REQUIRE_STUDENT_RELEVANCE = False
    else:
        config.REQUIRE_STUDENT_RELEVANCE = not args.all_posts

    if args.max_articles is not None:
        config.MAX_ARTICLES_PER_SOURCE = max(1, args.max_articles)
    if args.max_pages is not None:
        config.MAX_PAGES_PER_SOURCE = max(1, args.max_pages)

    print("开始收集中科大公开信息 / 学生资源...")
    print(f"爬取源数量: {0 if args.curated_only else len(config.SOURCES)}")
    print(f"精选目录: {config.CURATED_RESOURCES_PATH}")

    if args.curated_only:
        from crawler.catalog import load_curated_resources

        articles = load_curated_resources()
    else:
        print(
            f"模式: {'尽量全量(--full)' if args.full else '常规'}; "
            f"每源最多 {config.MAX_ARTICLES_PER_SOURCE} 篇 / "
            f"{config.MAX_PAGES_PER_SOURCE} 页; "
            f"相关性过滤={'开' if config.REQUIRE_STUDENT_RELEVANCE else '关'}"
        )
        articles = collect_all()

    output_dir = ensure_output_dir(args.output)
    json_path = save_json(articles, output_dir)
    csv_path = save_csv(articles, output_dir)
    by_cat_path = save_by_category(articles, output_dir)
    summary_path = save_summary(articles, output_dir)

    curated_count = sum(1 for item in articles if item.kind == "curated")
    print("")
    print("收集完成")
    print(f"共整理 {len(articles)} 条（精选 {curated_count} + 爬取 {len(articles) - curated_count}）")
    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")
    print(f"分类: {by_cat_path}")
    print(f"摘要: {summary_path}")
    print("")
    print("说明: 青春科大等需统一认证的系统无法无账号爬取内部活动列表，已收录入口与使用说明。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
