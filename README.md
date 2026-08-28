# 107AgentContests

107 杯智能算力开发赛 —「AI 资源导航助手」团队仓库（数据集 · 接口规范 · 各成员模块）。

## 仓库结构

- `data without log in/`：整合去重后的资源数据集发布镜像（JSON ×2 / 文档树 / 表格 / PDF）
- `数据接口规范.md`：前后端对接唯一权威规范（与 `crawler/` 工作区、`107` 根目录三处同步）
- `member-A/`：成员 A 数据采集流水线（公众号爬取、本地文档入库、团队数据集导出）
- `_master_snapshot.txt` / `_searchtext_stats.txt`：主库统计快照

## 数据现状（2026-08-28 并入 member-A 后）

- 条目总数 **13188**（curated 63 + crawled 732 + crawl 12393），栏目 39 个
- search_text 覆盖 13188/13188；URL 规范化去重 0 重复组；PII 全库复扫 0 命中
- 权威主库位于 crawler 工作区：`crawler\data without log in\原始数据_整合_search_text.json`
- 本目录为发布镜像，统一由 crawler 主库重建同步（`crawler/_rebuild_publish_local.py`）
- 本轮并入远端 member-A 数据库（commit `c759840`）：公众号「蜗壳小道消息」4 篇 + 团队数据集本地缺失 URL 22 条，共 +26 条

## 合规边界

仅收录公开/指导型内容；不含成绩、选课、消费流水、体检、资助申请等个人记录；所有 Cookie 文件不入库（已在 `.gitignore`）。
