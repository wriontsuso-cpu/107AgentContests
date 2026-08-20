# 成员 A · 数据工程师（信息获取 + 数据信息库）

> 107 杯「AI 资源导航助手」  
> 职责：爬虫采集、清洗入库、分类树、导出给 B/C 联调  
> 对接规范：见仓库根目录 [`数据接口规范.md`](../数据接口规范.md)  
> 整合后的权威数据集：[`data without log in/`](../data%20without%20log%20in/)（1295 条，由 D 整合）

---

## 目录结构

```
member-A/
├── main.py                 # 公开页采集入口
├── config.py               # 数据源与关键词配置
├── export_backup.py        # 导出文档/表格/PDF 备份
├── requirements.txt
├── crawler/                # 爬虫核心
├── scripts/
│   ├── import_json.py      # JSON → SQLite
│   └── export_api.py       # DB → B/C 导出文件
├── db/
│   └── init.sql            # 库表结构（不含 .db 二进制）
├── data/
│   ├── curated_resources.json
│   ├── categories_v1.json  # 分类树 v1
│   ├── category_mapping.json
│   ├── VERSION
│   └── export/             # 给 B/C 的结构化导出
│       ├── resources.jsonl # B 检索用（一行一条）
│       ├── resources.json
│       └── taxonomy.json
├── mock/                   # C 前端联调 Mock
│   ├── categories.json
│   └── resources.json
└── docs/
    ├── 成员A_任务方案.md
    ├── 数据字典_v0.1.md
    └── 数据源清单.md
```

---

## 快速开始

```bash
cd member-A
pip install -r requirements.txt

# 1) 采集公开信息
python main.py --full --no-body

# 2) 入库（生成 db/ustc_resources.db，本地使用，不提交）
python scripts/import_json.py

# 3) 导出给 B/C
python scripts/export_api.py
```

---

## 给队友的文件

| 队友 | 文件 | 说明 |
|------|------|------|
| **B** | `data/export/resources.jsonl` | 结构化资源，可建向量库 |
| **B** | `docs/数据字典_v0.1.md` | 字段说明 |
| **C** | `mock/categories.json` | 分类树 |
| **C** | `mock/resources.json` | 前 100 条 Mock |
| **D** | 本模块 + 更新命令 | 与根目录整合数据对接 |

> 团队当前权威数据以根目录 `data without log in/原始数据_整合.json` 为准（含 `search_text`）。  
> 本目录提供**可复现采集流水线**与 **W1 结构化库/分类树**，后续增量可由 A 产出后交 D 合并。

---

## 与接口规范的对齐

- 爬虫原始字段：`title/url/source/category/summary/tags/cost/how_to/...`
- 结构化增强字段：`id/category_id/category_path/access_type/source_type`
- `search_text` 由 D 侧脚本生成，权威文件在 `data without log in/`

---

## 版本

见 `data/VERSION`（当前示例：`2026-08-20-r627-db626`）
