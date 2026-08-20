# AgentContests

107杯工程代码仓库 —「AI 资源导航助手」

## 仓库结构

| 路径 | 说明 | 负责人 |
|------|------|--------|
| [`数据接口规范.md`](./数据接口规范.md) | 团队字段与 API 约定（权威） | D |
| [`data without log in/`](./data%20without%20log%20in/) | 非登录可获取信息整合包（1295 条，含 search_text） | A 采集 / D 整合 |
| [`member-A/`](./member-A/) | 数据工程师：爬虫、清洗入库、分类树、导出脚本 | **A** |

## 成员 A 使用

```bash
cd member-A
pip install -r requirements.txt
python main.py --full --no-body
python scripts/import_json.py
python scripts/export_api.py
```

详见 [`member-A/README.md`](./member-A/README.md)。

## 数据读取（B/C）

日常问答/检索请优先读取：

`data without log in/原始数据_整合.json` → `articles[]`

字段定义见 `数据接口规范.md`。
