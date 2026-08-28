# 整合去重结果（data without log in 发布镜像）

- 数据版本：2026-08-28（数据库整理助手；本轮并入远端 member-A 数据库）
- 条目总数：13188（上一版 13162 → 本轮 +26）
- 覆盖栏目：39
- 组成：curated 63 + crawled 732 + crawl 12393
- search_text 覆盖：13188/13188
- 去重：URL 规范化 0 重复组；member-A 线下文档(20)/精选资源(31) 内容本地主库已收录，未重复并入
- 三性标注：info_status/event_date/expired/freshness + disposition(keep/flag/deprecate) + url_status 抽样
- 脱敏：sanitized=true；PII 8 类全字段复扫 0 命中（URL 长数字残留 0）；Cookie 未入库

## 本轮并入（member-A，commit c759840）

- 公众号「蜗壳小道消息」4 篇：欢迎校友回家·入校通道 / 师生亲友入校通道 / USTC 评课社区十周年 / 蜗壳常识小测
- 团队数据集 `member-A/data/export/resources.jsonl` 中本地缺失的 22 条 URL（新闻网 / 学工在线 / 教务处 / 主站通知等）
- member-A 线下文档、精选资源与本地主库已收录内容一致，按去重标准未重复并入

## 目录

- `原始数据_整合.json`：无 search_text 版（展示/读取）
- `原始数据_整合_search_text.json`：含 search_text 版（后端 B 消费）
- `文档/`：00_总览与使用说明 / 01_按栏目索引 / 02_全量清单 / 按栏目 39 册
- `表格/整合去重_全量.csv/.xlsx`
- `PDF/整合去重_汇总.pdf`
- 根目录：`数据接口规范.md`、`_master_snapshot.txt`、`_searchtext_stats.txt`

## 合规边界

仅收录公开/指导型内容；不包含成绩、选课、消费流水、体检、资助申请等个人记录；Cookie 文件不提交。
