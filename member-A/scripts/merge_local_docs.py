#!/usr/bin/env python3
"""把本地文档资源合并进主库，并补充从文档拆出的高价值子条目。"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

LOCAL = ROOT / "data" / "local_docs" / "local_doc_resources.json"
CURATED = ROOT / "data" / "curated_resources.json"
MERGED_EXPORT = ROOT / "data" / "local_docs" / "merged_for_import.json"

# 从校园网讲解等文档拆出的独立入口（信息差：常用但新生不知道）
PORTAL_EXTRAS = [
    {
        "title": "网络通（校园网权限开通）",
        "url": "https://wlt.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解",
        "category": "网站入口",
        "summary": "开通校园网国内/国际权限、出口选择与使用时限；宿舍有线与部分 Wi‑Fi 需网络通认证。",
        "tags": ["网络", "网络通", "ustc-only", "流程", "入口"],
        "cost": "约 10～20 元/月（以网络中心为准）",
        "how_to": "登录 wlt.ustc.edu.cn，用统一身份开通国内或国际权限；有线/ustcnet 需网页认证，eduroam 用网络通账号连接。",
        "kind": "curated",
        "content_kind": "流程",
    },
    {
        "title": "校外访问 VPN（wvpn）",
        "url": "https://wvpn.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解",
        "category": "网站入口",
        "summary": "在校外访问校内资源（教务、图书馆数据库等）的 Web VPN 入口。",
        "tags": ["VPN", "校外访问", "ustc-only", "入口"],
        "cost": "免费（需账号）",
        "how_to": "打开 wvpn.ustc.edu.cn，用统一身份登录后访问校内系统。",
        "kind": "curated",
        "content_kind": "入口",
    },
    {
        "title": "eduroam 校园无线",
        "url": "https://ustcnet.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解",
        "category": "网站入口",
        "summary": "校本部主要无线接入方式；可用网络通账号在全球 eduroam 高校漫游。",
        "tags": ["Wi-Fi", "eduroam", "ustc-only", "流程"],
        "cost": "需已开通网络通权限",
        "how_to": "连接 SSID「eduroam」，用户名为网络通账号（常为学号@ustc.edu.cn 形式，以网络中心说明为准），密码为网络通密码。",
        "kind": "curated",
        "content_kind": "流程",
    },
    {
        "title": "本科生教务系统",
        "url": "https://jw.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解/教务指南",
        "category": "教务选课",
        "summary": "选课、成绩、培养相关教务系统入口。",
        "tags": ["选课", "教务", "ustc-only", "入口"],
        "cost": "免费",
        "how_to": "用统一身份登录 jw.ustc.edu.cn；新生若提示未录入学号需等待教务导入。",
        "kind": "curated",
        "content_kind": "入口",
    },
    {
        "title": "课程目录 catalog.ustc.edu.cn",
        "url": "https://catalog.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解",
        "category": "教务选课",
        "summary": "查询课程与培养相关目录信息。",
        "tags": ["课程", "培养方案", "ustc-only", "入口"],
        "cost": "免费",
        "how_to": "打开 catalog.ustc.edu.cn 检索课程/培养信息。",
        "kind": "curated",
        "content_kind": "入口",
    },
    {
        "title": "校园一卡通（改绑手机号）",
        "url": "http://ecard.ustc.edu.cn/",
        "source": "本地文档衍生-新生问答",
        "category": "办事指南",
        "summary": "一卡通相关；新生问答提到绑定电话号可在此修改。",
        "tags": ["一卡通", "手机号", "ustc-only", "流程"],
        "cost": "免费",
        "how_to": "登录 ecard.ustc.edu.cn 修改绑定电话；证件照一般为高考准考证照片，通常不可自行更改。",
        "kind": "curated",
        "content_kind": "流程",
    },
    {
        "title": "学生邮箱命名与别名（新生常见问题）",
        "url": "https://mail.ustc.edu.cn/",
        "source": "本地文档衍生-新生问答",
        "category": "网站入口",
        "summary": "学生邮箱后缀 @mail.ustc.edu.cn；名称建议正式；不合适时可设一次别名。",
        "tags": ["邮箱", "新生", "学生经验", "ustc-only", "流程"],
        "cost": "免费",
        "how_to": "登录邮箱时选择正确后缀；密码勿含特殊字符；二次验证建议短信；别名操作按邮箱系统提示，通常仅一次机会。",
        "kind": "curated",
        "content_kind": "流程",
    },
    {
        "title": "迎新网请用电脑登录（常见问题）",
        "url": "https://welcome.ustc.edu.cn/",
        "source": "本地文档衍生-新生问答",
        "category": "新生事务",
        "summary": "迎新网部分页面在手机异常时，改用电脑浏览器登录。",
        "tags": ["迎新", "新生", "学生经验", "ustc-only", "流程"],
        "cost": "免费",
        "how_to": "若迎新网显示异常，改用电脑登录 welcome.ustc.edu.cn。",
        "kind": "curated",
        "content_kind": "流程",
    },
    {
        "title": "报修系统 baoxiu.ustc.edu.cn",
        "url": "https://baoxiu.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解",
        "category": "办事指南",
        "summary": "宿舍/校园设施报修入口。",
        "tags": ["报修", "宿舍", "ustc-only", "入口"],
        "cost": "免费",
        "how_to": "登录 baoxiu.ustc.edu.cn 提交报修。",
        "kind": "curated",
        "content_kind": "入口",
    },
    {
        "title": "黑白名单 / IP 相关（ipb）",
        "url": "https://ipb.ustc.edu.cn/",
        "source": "本地文档衍生-校园网讲解",
        "category": "网站入口",
        "summary": "校园网相关 IP/黑白名单服务入口（以页面说明为准）。",
        "tags": ["网络", "ustc-only", "入口"],
        "cost": "免费",
        "how_to": "打开 ipb.ustc.edu.cn，按页面说明操作。",
        "kind": "curated",
        "content_kind": "入口",
    },
]


def normalize_item(item: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "title": item.get("title", ""),
        "url": item.get("url", ""),
        "source": item.get("source", "本地文档"),
        "category": item.get("category", "办事指南"),
        "published_at": item.get("published_at", ""),
        "summary": (item.get("summary") or "")[:500],
        "content": (item.get("content") or item.get("summary") or "")[:8000],
        "crawled_at": item.get("crawled_at") or now,
        "tags": item.get("tags") or [],
        "cost": item.get("cost") or "免费（文档查阅）",
        "how_to": item.get("how_to") or "",
        "relevance_score": int(item.get("relevance_score") or 10),
        "kind": "curated",
    }


def main() -> int:
    local_items = []
    if LOCAL.exists():
        local_items = json.loads(LOCAL.read_text(encoding="utf-8"))

    extras = PORTAL_EXTRAS
    combined = [normalize_item(x) for x in local_items] + [normalize_item(x) for x in extras]

    # merge into curated_resources.json (append by title+url)
    curated = []
    if CURATED.exists():
        curated = json.loads(CURATED.read_text(encoding="utf-8"))

    existing = {(c.get("title"), c.get("url")) for c in curated}
    added = 0
    for item in combined:
        key = (item["title"], item["url"])
        if key in existing:
            continue
        curated.append(
            {
                "title": item["title"],
                "url": item["url"],
                "source": item["source"],
                "category": item["category"],
                "tags": item["tags"],
                "cost": item["cost"],
                "how_to": item["how_to"],
                "summary": item["summary"],
            }
        )
        existing.add(key)
        added += 1

    CURATED.write_text(json.dumps(curated, ensure_ascii=False, indent=2), encoding="utf-8")

    # also write import-friendly full dump for student_resources merge
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(combined),
        "curated": len(combined),
        "crawled": 0,
        "articles": combined,
    }
    MERGED_EXPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"本地文档条目: {len(local_items)}")
    print(f"衍生入口/FAQ: {len(extras)}")
    print(f"写入 curated 新增: {added}（curated 现共 {len(curated)}）")
    print(f"导入用 JSON: {MERGED_EXPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
