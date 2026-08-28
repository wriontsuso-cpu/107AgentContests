# 107AgentContests

107 杯智能算力开发赛 —「AI 资源导航助手」团队仓库（数据集 · 接口规范 · 各成员模块）。

## 仓库结构

- `data without log in/`：整合去重后的资源数据集发布镜像（JSON ×2 / 文档树 / 表格 / PDF）
- `数据接口规范.md`：前后端对接唯一权威规范（与 `crawler/` 工作区、`107` 根目录三处同步）
- `member-A/`：成员 A 数据采集流水线（公众号爬取、本地文档入库、团队数据集导出）
- `_master_snapshot.txt` / `_searchtext_stats.txt`：主库统计快照

## 数据现状（2026-08-28 · 数据库整理助手 v2 整理后）

- 条目总数 **12882**（curated 63 + crawled 651 + crawl 12168），栏目 39 个
- 内容级去重：13188 → 12882（标题指纹 149 组 + 内容相似度 157 组自动合并，共 -306）；URL 规范化 0 重复组；年份冲突/近重复 4694 对待复核未合并（保持独立）
- 三性审核：全库打标 `info_status/event_date/expired/freshness` + `disposition`（keep 3849 / flag 6449 / deprecate 2584，只标注不删除）；有效性分层抽样探活 120 条全 reachable
- 脱敏：PII 8 类 dry-run 0 命中、写回复扫 0 命中；线下文档 `file://` 本地绝对路径（含用户名）已中性化脱敏
- search_text 覆盖 12882/12882
- 权威主库位于 crawler 工作区：`crawler\data without log in\原始数据_整合_search_text.json`；本目录为发布镜像，由 crawler 主库重建同步

## 合规边界

仅收录公开/指导型内容；不含成绩、选课、消费流水、体检、资助申请等个人记录；所有 Cookie 文件不入库；发布数据不含本地绝对路径/用户名。
