"""Application service shared by the command line and web API."""

from __future__ import annotations

from dataclasses import dataclass

from config import load_knowledge_base_config, load_llm_config
from knowledge_base import KnowledgeBase, Resource, build_knowledge_base
from llm_client import LLMClient, LLMRequest, build_llm_client
from prompts import RESOURCE_NAVIGATION_SYSTEM_PROMPT


@dataclass(frozen=True)
class NavigationAnswer:
    answer: str
    resources: tuple[Resource, ...]


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

    def answer(self, question: str) -> NavigationAnswer:
        normalized_question = question.strip()
        if not normalized_question:
            raise ValueError("Question cannot be empty.")

        resources = self.knowledge_base.search(
            normalized_question,
            limit=self.retrieval_limit,
        )
        response = self.llm_client.generate(
            LLMRequest(
                system_prompt=RESOURCE_NAVIGATION_SYSTEM_PROMPT,
                user_question=self._build_grounded_question(
                    normalized_question,
                    resources,
                ),
            )
        )
        return NavigationAnswer(
            answer=response.text.strip(),
            resources=tuple(resources),
        )

    @staticmethod
    def _build_grounded_question(question: str, resources: list[Resource]) -> str:
        if not resources:
            return question

        resource_lines = []
        for index, resource in enumerate(resources, start=1):
            resource_lines.append(
                "\n".join(
                    (
                        f"[{index}] title: {resource.title}",
                        f"url: {resource.url or 'not provided'}",
                        f"summary: {resource.summary or 'not provided'}",
                        f"source: {resource.source}",
                    )
                )
            )

        context = "\n\n".join(resource_lines)
        return (
            f"User question:\n{question}\n\n"
            "Retrieved database resources:\n"
            f"{context}\n\n"
            "Base the navigation answer on these resources and do not invent "
            "missing resource details."
        )


def build_navigation_service() -> ResourceNavigationService:
    llm_config = load_llm_config()
    knowledge_base_config = load_knowledge_base_config()
    return ResourceNavigationService(
        llm_client=build_llm_client(llm_config),
        knowledge_base=build_knowledge_base(knowledge_base_config),
        retrieval_limit=knowledge_base_config.top_k,
    )
