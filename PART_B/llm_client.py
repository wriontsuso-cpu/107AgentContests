"""
LLM integration layer.

Add a new client class here when connecting a provider with a different API.
The rest of the agent should depend only on LLMClient.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from config import LLMConfig


@dataclass(frozen=True)
class LLMRequest:
    system_prompt: str
    user_question: str


@dataclass(frozen=True)
class LLMResponse:
    text: str
    raw: object | None = None


class LLMClient(ABC):
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
        raw = client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_question},
            ],
            temperature=0.2,
        )

        return LLMResponse(
            text=raw.choices[0].message.content or "",
            raw=raw,
        )


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
