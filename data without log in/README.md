# 整合去重结果（data without log in 发布镜像）

- 数据版本：2026-08-28（数据库整理助手首轮）
- 条目总数：12863（上一版 13162；本轮内容级去重后 12863）
- 覆盖栏目：39
- 组成：curated 63 + crawled 12800
- search_text 覆盖：12863/12863
- 去重：URL 规范化 0 重复组；标题指纹/相似度自动合并 169 组（-299 条）；年份冲突 188 对转人工复核（未合并）
- 三性标注：info_status/event_date/expired/freshness + disposition(keep/flag/deprecate) + url_status 抽样
- 脱敏：sanitized=true；PII 8 类全字段复扫 0 命中；Cookie 未入库

## 目录

- `原始数据_整合.json`：无 search_text 版（展示/读取）
- `原始数据_整合_search_text.json`：含 search_text 版（后端 B 消费）
- `文档/`：00_总览与使用说明 / 01_按栏目索引 / 02_全量清单 / 按栏目 39 册
- `表格/整合去重_全量.csv/.xlsx`
- `PDF/整合去重_汇总.pdf`
- 根目录：`数据接口规范.md`、`_master_snapshot.txt`、`_searchtext_stats.txt`

## 合规边界

仅收录公开/指导型内容；不包含成绩、选课、消费流水、体检、资助申请等个人记录；Cookie 文件不提交。