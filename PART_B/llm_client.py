"""
LLM integration layer.

Add a new client class here when connecting a provider with a different API.
The rest of the agent should depend only on LLMClient.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from urllib.parse import urlparse

from config import LLMConfig


@dataclass(frozen=True)
class LLMRequest:
    system_prompt: str
    user_question: str
    web_access: str = "none"
    max_output_tokens: int | None = None


@dataclass(frozen=True)
class LLMCitation:
    title: str
    url: str


@dataclass(frozen=True)
class LLMResponse:
    text: str
    raw: object | None = None
    citations: tuple[LLMCitation, ...] = ()


class LLMClient(ABC):
    @property
    def supports_web_search(self) -> bool:
        return False

    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Return a concise model response for the given user question."""


class PlaceholderLLMClient(LLMClient):
    def __init__(self, config: LLMConfig) -> None:
        self.config = config

    def generate(self, request: LLMRequest) -> LLMResponse:
        return LLMResponse(
            text=(
                "LLM is not configured yet. Set LLM_PROVIDER, LLM_API_KEY, "
                "LLM_MODEL, and optionally LLM_BASE_URL in the .env file."
            )
        )


class OpenAICompatibleLLMClient(LLMClient):
    """
    Client for OpenAI-compatible chat completion APIs.

    This works for OpenAI itself and many providers that expose a compatible
    /chat/completions endpoint through a custom base_url.
    """

    def __init__(self, config: LLMConfig) -> None:
        self.config = config

    @property
    def supports_web_search(self) -> bool:
        return self.config.web_search_enabled

    def generate(self, request: LLMRequest) -> LLMResponse:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                "The openai package is not installed. Run: pip install -r requirements.txt"
            ) from exc

        if not self.config.api_key:
            raise ValueError("LLM_API_KEY is required for OpenAI-compatible providers.")
        if not self.config.model:
            raise ValueError("LLM_MODEL is required for OpenAI-compatible providers.")

        client_options: dict[str, object] = {
            "api_key": self.config.api_key,
            "timeout": self.config.timeout_seconds,
        }
        if self.config.base_url:
            client_options["base_url"] = self.config.base_url.rstrip("/")

        client = OpenAI(**client_options)
        if request.web_access != "none":
            if self.config.web_search_enabled:
                return self._generate_with_web_access(client, request)
            if request.web_access == "search_web":
                raise RuntimeError(
                    "Web search is required but LLM_WEB_SEARCH_ENABLED is false."
                )
            request = LLMRequest(
                system_prompt=request.system_prompt,
                user_question=(
                    f"{request.user_question}\n\n"
                    "[系统状态] 网页访问工具当前未启用。不得声称已经访问网页；"
                    "只能依据上方数据库快照作答。"
                ),
                max_output_tokens=request.max_output_tokens,
            )

        completion_options: dict[str, object] = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_question},
            ],
            "temperature": 0.0,
        }
        if request.max_output_tokens is not None:
            completion_options["max_tokens"] = request.max_output_tokens
        raw = client.chat.completions.create(**completion_options)

        return LLMResponse(
            text=raw.choices[0].message.content or "",
            raw=raw,
        )

    def _generate_with_web_access(self, client: object, request: LLMRequest) -> LLMResponse:
        responses = getattr(client, "responses", None)
        if responses is None:
            raise RuntimeError("The configured OpenAI-compatible SDK has no Responses API.")

        response_options: dict[str, object] = {
            "model": self.config.model,
            "instructions": request.system_prompt,
            "input": request.user_question,
            "tools": [{"type": "web_search"}],
            "tool_choice": "required",
            "temperature": 0.0,
        }
        if request.max_output_tokens is not None:
            response_options["max_output_tokens"] = request.max_output_tokens
        try:
            raw = responses.create(**response_options)
        except Exception:
            if request.web_access == "search_web":
                raise
            fallback = LLMRequest(
                system_prompt=request.system_prompt,
                user_question=(
                    f"{request.user_question}\n\n"
                    "[系统状态] 网页访问工具调用失败。不得声称已经访问网页；"
                    "请明确依据数据库快照进行简要回答。"
                ),
                max_output_tokens=request.max_output_tokens,
            )
            return self.generate(fallback)

        text = getattr(raw, "output_text", "") or ""
        return LLMResponse(
            text=text,
            raw=raw,
            citations=_extract_citations(raw, text),
        )


def _extract_citations(raw: object, _: str) -> tuple[LLMCitation, ...]:
    payload = raw.model_dump() if hasattr(raw, "model_dump") else raw
    candidates: list[LLMCitation] = []

    def visit(value: object) -> None:
        if isinstance(value, dict):
            url = value.get("url")
            if isinstance(url, str) and url.startswith(("http://", "https://")):
                title = value.get("title")
                candidates.append(LLMCitation(
                    title=title.strip() if isinstance(title, str) and title.strip() else urlparse(url).netloc,
                    url=url.strip(),
                ))
            for nested in value.values():
                visit(nested)
        elif isinstance(value, (list, tuple)):
            for nested in value:
                visit(nested)

    visit(payload)
    unique: dict[str, LLMCitation] = {}
    for citation in candidates:
        normalized = citation.url.lower().replace("http://", "https://", 1).rstrip("/")
        existing = unique.get(normalized)
        if existing is None or (
            existing.title == urlparse(existing.url).netloc
            and citation.title != urlparse(citation.url).netloc
        ):
            unique[normalized] = citation
    return tuple(unique.values())


def build_llm_client(config: LLMConfig) -> LLMClient:
    """
    Factory for choosing a model backend.

    LLM_PROVIDER now controls which backend is used.

    Providers that currently share the OpenAI-compatible client:
    - openai
    - openai-compatible
    - deepseek
    - qwen
    """

    provider = config.provider.strip().lower()

    if provider in {"", "placeholder", "none"}:
        return PlaceholderLLMClient(config)

    if provider in {"openai", "openai-compatible", "deepseek", "qwen"}:
        return OpenAICompatibleLLMClient(config)

    raise ValueError(
        f"Unsupported LLM_PROVIDER '{config.provider}'. "
        "Supported values: placeholder, openai, openai-compatible, deepseek, qwen."
    )
