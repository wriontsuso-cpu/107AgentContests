"""Stable interface for retrieving navigation resources from a database."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from config import KnowledgeBaseConfig


@dataclass(frozen=True)
class Resource:
    id: str
    title: str
    url: str | None = None
    summary: str = ""
    source: str = "knowledge_base"
    metadata: dict[str, object] = field(default_factory=dict)


class KnowledgeBase(ABC):
    @abstractmethod
    def search(self, query: str, limit: int) -> list[Resource]:
        """Return resources ordered from most to least relevant."""


class PlaceholderKnowledgeBase(KnowledgeBase):
    """Empty implementation used until the real database is connected."""

    def search(self, query: str, limit: int) -> list[Resource]:
        return []


def build_knowledge_base(config: KnowledgeBaseConfig) -> KnowledgeBase:
    provider = config.provider.strip().lower()

    if provider in {"", "placeholder", "none"}:
        return PlaceholderKnowledgeBase()

    raise ValueError(
        f"Unsupported KNOWLEDGE_BASE_PROVIDER '{config.provider}'. "
        "Create a KnowledgeBase implementation in knowledge_base.py and register it "
        "in build_knowledge_base()."
    )
