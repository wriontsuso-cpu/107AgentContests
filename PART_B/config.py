"""
Configuration for the resource navigation agent.

Values are read from environment variables so the concrete LLM provider can be
changed without editing application logic.
"""

from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
class LLMConfig:
    provider: str
    api_key: str
    model: str
    base_url: str | None = None
    timeout_seconds: int = 30


@dataclass(frozen=True)
class KnowledgeBaseConfig:
    provider: str
    endpoint: str | None = None
    api_key: str = ""
    top_k: int = 5


@dataclass(frozen=True)
class WebConfig:
    cors_origins: tuple[str, ...]


def load_dotenv_if_present() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_llm_config() -> LLMConfig:
    load_dotenv_if_present()

    return LLMConfig(
        provider=os.getenv("LLM_PROVIDER", "placeholder"),
        api_key=os.getenv("LLM_API_KEY", ""),
        model=os.getenv("LLM_MODEL", "your-model-name-here"),
        base_url=os.getenv("LLM_BASE_URL") or None,
        timeout_seconds=int(os.getenv("LLM_TIMEOUT_SECONDS", "10")),
    )


def load_knowledge_base_config() -> KnowledgeBaseConfig:
    load_dotenv_if_present()

    top_k = int(os.getenv("KNOWLEDGE_BASE_TOP_K", "5"))
    if top_k <= 0:
        raise ValueError("KNOWLEDGE_BASE_TOP_K must be greater than 0.")

    return KnowledgeBaseConfig(
        provider=os.getenv("KNOWLEDGE_BASE_PROVIDER", "placeholder"),
        endpoint=os.getenv("KNOWLEDGE_BASE_ENDPOINT") or None,
        api_key=os.getenv("KNOWLEDGE_BASE_API_KEY", ""),
        top_k=top_k,
    )


def load_web_config() -> WebConfig:
    load_dotenv_if_present()

    raw_origins = os.getenv(
        "WEB_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    )
    origins = tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())
    return WebConfig(cors_origins=origins)
