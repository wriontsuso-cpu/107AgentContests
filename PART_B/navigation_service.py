"""Database-first navigation service shared by the CLI and HTTP API."""

from __future__ import annotations

from dataclasses import dataclass
import re

from config import load_knowledge_base_config, load_llm_config
from knowledge_base import KnowledgeBase, Resource, build_knowledge_base
from llm_client import LLMClient, LLMRequest, build_llm_client
from prompts import RESOURCE_NAVIGATION_SYSTEM_PROMPT


_URL_PATTERN = re.compile(r"https?://[^\s<>()\]，。；、]+", re.IGNORECASE)
_CLARIFICATION_PATTERN = re.compile(r"[①②③④]\s*([^；。\n]+)")


@dataclass(frozen=True)
class NavigationAnswer:
    answer: str
    resources: tuple[Resource, ...]
    clarifications: tuple[str, ...] = ()


class ResourceNavigationService:
    def __init__(
        self,
        llm_client: LLMClient,
        knowledge_base: KnowledgeBase,
        retrieval_limit: int,
    ) -> None:
        self.llm_client = llm_client
        self.knowledge_base = knowledge_base
        self.retrieval_limit = retrieval_limit

    def answer(
        self,
        question: str,
        *,
        category: str | None = None,
        limit: int | None = None,
        conversation: tuple[str, ...] = (),
    ) -> NavigationAnswer:
        normalized_question = question.strip()
        if not normalized_question:
            raise ValueError("Question cannot be empty.")

        retrieval_limit = min(max(limit or self.retrieval_limit, 1), 20)
        retrieval_query = self._build_retrieval_query(normalized_question, conversation)
        resources = self.knowledge_base.search(
            retrieval_query,
            limit=retrieval_limit,
            category=category,
        )
        response = self.llm_client.generate(
            LLMRequest(
                system_prompt=RESOURCE_NAVIGATION_SYSTEM_PROMPT,
                user_question=self._build_grounded_question(
                    normalized_question,
                    resources,
                    conversation,
                ),
            )
        )
        answer = self._remove_unknown_urls(response.text.strip())
        return NavigationAnswer(
            answer=answer,
            resources=tuple(resources),
            clarifications=self._extract_clarifications(answer),
        )

    @staticmethod
    def _build_retrieval_query(question: str, conversation: tuple[str, ...]) -> str:
        previous_user_messages = tuple(
            message.removeprefix("用户：")
            for message in conversation
            if message.startswith("用户：")
        )[-3:]
        return " ".join((*previous_user_messages, question)).strip()

    @staticmethod
    def _build_grounded_question(
        question: str,
        resources: list[Resource],
        conversation: tuple[str, ...],
    ) -> str:
        history = "\n".join(conversation[-6:]) or "无"
        if not resources:
            return (
                f"最近对话：\n{history}\n\n当前问题：\n{question}\n\n"
                "数据库没有检索到可靠资源。不要提供或猜测任何链接；请简短说明未找到，"
                "并在意图不明确时提出一个带 2 至 4 个选项的引导式问题。"
            )

        resource_blocks = []
        for index, resource in enumerate(resources, start=1):
            resource_blocks.append(
                "\n".join(
                    (
                        f"[数据库资源 {index}]",
                        f"标题：{resource.title}",
                        f"URL：{resource.url}",
                        f"栏目：{resource.category}",
                        f"来源：{resource.source}",
                        f"权威标签：{resource.authority_label or '数据未提供'}",
                        f"摘要：{resource.summary or '数据未提供'}",
                        f"获取方式：{resource.how_to or '数据未提供'}",
                        f"费用：{resource.cost or '数据未提供'}",
                        f"标签：{'、'.join(resource.tags) or '数据未提供'}",
                        f"正文摘录：{(resource.content or '数据未提供')[:800]}",
                    )
                )
            )

        database_context = "\n\n".join(resource_blocks)
        return (
            f"最近对话：\n{history}\n\n当前问题：\n{question}\n\n"
            "以下内容来自本项目的权威资源数据库，是本次回答的首要且唯一资源依据。"
            "只能推荐下列资源，只能使用下列 URL；不要补充记忆中或自行猜测的资源。\n\n"
            f"{database_context}\n\n"
            "请直接给出简洁导航答案。资源卡片会由系统单独展示，因此正文重点说明推荐顺序、"
            "适用场景和访问方法，不要重复堆砌链接。"
        )

    def _remove_unknown_urls(self, answer: str) -> str:
        return _URL_PATTERN.sub(
            lambda match: match.group(0)
            if self.knowledge_base.is_known_url(match.group(0))
            else "（未收录链接已移除）",
            answer,
        )

    @staticmethod
    def _extract_clarifications(answer: str) -> tuple[str, ...]:
        return tuple(
            dict.fromkeys(
                option.strip()
                for option in _CLARIFICATION_PATTERN.findall(answer)
                if option.strip()
            )
        )[:4]


def build_navigation_service() -> ResourceNavigationService:
    llm_config = load_llm_config()
    knowledge_base_config = load_knowledge_base_config()
    return ResourceNavigationService(
        llm_client=build_llm_client(llm_config),
        knowledge_base=build_knowledge_base(knowledge_base_config),
        retrieval_limit=knowledge_base_config.top_k,
    )
