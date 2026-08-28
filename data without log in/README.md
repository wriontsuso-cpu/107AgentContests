# 整合去重结果（data without log in 发布镜像）

- 数据版本：2026-08-28（数据库整理助手 v2：内容级去重 + 三性审核 + 脱敏复扫）
- 条目总数：12882（上一版 13188 → 内容级去重 -306）
- 覆盖栏目：39
- 组成：curated 63 + crawled 651 + crawl 12168
- search_text 覆盖：12882/12882（均长 210.5）
- 去重：URL 规范化 0 重复组；标题指纹 149 组 + 内容相似度 157 组自动合并（共 -306）；年份冲突护栏 188 对、近重复 4694 对待复核（保持独立未合并）
- 三性标注：info_status/event_date/expired/freshness + disposition(keep/flag/deprecate) + url_status 抽样（120 条 reachable）
- 脱敏：sanitized=true；PII 8 类全字段 dry-run 0 命中、写回复扫 0 命中；`file://` 本地绝对路径 24 条已中性化脱敏（去用户名）

## 目录

- `原始数据_整合.json`：无 search_text 版（展示/读取）
- `原始数据_整合_search_text.json`：含 search_text 版（后端 B 消费）
- `文档/`：00_总览与使用说明 / 01_按栏目索引 / 02_全量清单 / 按栏目 39 册
- `表格/整合去重_全量.csv/.xlsx`
- `PDF/整合去重_汇总.pdf`
- 根目录：`数据接口规范.md`、`_master_snapshot.txt`、`_searchtext_stats.txt`

## 合规边界

仅收录公开/指导型内容；不包含成绩、选课、消费流水、体检、资助申请等个人记录；Cookie 文件不提交；发布数据不含本地绝对路径/用户名。
