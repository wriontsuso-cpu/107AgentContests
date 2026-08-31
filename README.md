# AgentContests
107杯工程代码仓库

静态站点：https://wriontsuso-cpu.github.io/107AgentContests/

## 检索

资源目录与 AI 演示都走同一套**加权模糊匹配**：

- 查询会去掉「怎么 / 如何」等套话，按校园词表切词，并展开同义词（座位 → 学习空间）和常见拼音（`tushuguan` → 图书馆）。
- 标题、标签、栏目、摘要、`search_text` 按字段加权；允许 1 个汉字的编辑距离，因此「图书管」仍能命中「图书馆」。
- 每条资源有 `weight`（0–10）。高频官方入口（教务系统、邮箱、学习空间预约等）权重大，新闻报道权重小。排序分 = 文本匹配分 + `weight × 8`。
- 重新计算权重与检索文本：

```bash
python3 scripts/apply_resource_weights.py
```

词表、同义词和入口加分在 `frontend/src/data/raw/searchRanking.json`。

## GitHub Pages

前端通过 `.github/workflows/pages.yml` 自动构建并发布。合并或推送到 `main` 后，访问：

https://wriontsuso-cpu.github.io/107AgentContests/

首次发布前，仓库管理员需要在 GitHub 打开 `Settings → Pages`，将 `Build and deployment → Source` 设置为 `GitHub Actions`。之后每次 `main` 分支中的 `frontend/` 发生变化都会自动重新发布。
