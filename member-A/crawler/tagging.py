"""学生资源相关性打分与标签。"""

from __future__ import annotations

import config


def score_relevance(title: str, summary: str = "", content: str = "") -> int:
    text = f"{title}\n{summary}\n{content[:1500]}".lower()
    score = 0
    for keyword in config.STUDENT_KEYWORDS:
        if keyword.lower() in text:
            score += 1
    return score


def infer_tags(title: str, category: str, summary: str = "", content: str = "") -> list[str]:
    text = f"{title}\n{category}\n{summary}\n{content[:1500]}"
    tags: list[str] = []
    if category:
        tags.append(category)

    for tag, keywords in config.RESOURCE_TAG_RULES.items():
        if any(keyword in text for keyword in keywords):
            if tag not in tags:
                tags.append(tag)

    if "免费" in text and "免费" not in tags:
        tags.append("免费")
    return tags
