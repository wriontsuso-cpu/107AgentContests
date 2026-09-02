"""FastAPI contract for the resource browser and database-grounded assistant."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import load_knowledge_base_config, load_llm_config, load_web_config
from knowledge_base import Resource
from navigation_service import (
    NavigationAnswer,
    ResourceNavigationService,
    build_navigation_service,
)
from session_store import InMemorySessionStore, SessionStore


logger = logging.getLogger(__name__)


class SearchHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)
    category: str | None = None
    session_id: str | None = Field(default=None, max_length=128)
    history: list[SearchHistoryMessage] = Field(default_factory=list, max_length=40)


class ResourceResponse(BaseModel):
    title: str
    id: str
    url: str
    source: str
    category: str
    summary: str
    content: str
    published_at: str
    crawled_at: str
    tags: list[str]
    cost: str
    how_to: str
    relevance_score: float
    kind: str
    source_site: str
    related_urls: list[str]
    source_count: int
    authority_label: str
    search_text: str


class SearchResponse(BaseModel):
    results: list[ResourceResponse]
    answer: str
    session_id: str
    clarifications: list[str] = Field(default_factory=list)


class ResourceListResponse(BaseModel):
    items: list[ResourceResponse]
    total: int
    page: int
    page_size: int


class CategoriesResponse(BaseModel):
    categories: list[dict[str, object]]
    tags: list[str]


class SessionResponse(BaseModel):
    session_id: str
    status: str


class HealthResponse(BaseModel):
    status: str
    llm_provider: str
    web_search_enabled: bool
    knowledge_base_provider: str
    resource_count: int


def create_app(
    navigation_service: ResourceNavigationService | None = None,
    session_store: SessionStore | None = None,
) -> FastAPI:
    web_config = load_web_config()
    service = navigation_service or build_navigation_service()
    sessions = session_store or InMemorySessionStore()
    app = FastAPI(title="USTC Resource Navigation API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(web_config.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.state.navigation_service = service
    app.state.session_store = sessions

    @app.get("/api/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        llm_config = load_llm_config()
        return HealthResponse(
            status="ok",
            llm_provider=llm_config.provider,
            web_search_enabled=llm_config.web_search_enabled,
            knowledge_base_provider=load_knowledge_base_config().provider,
            resource_count=len(service.knowledge_base.resources),
        )

    @app.post("/api/search", response_model=SearchResponse)
    def search(request: SearchRequest) -> SearchResponse:
        query = request.query.strip()
        if not query:
            raise HTTPException(status_code=422, detail="query cannot be empty.")

        session = sessions.get(request.session_id) if request.session_id else None
        if session is None:
            session = sessions.create(request.session_id)
        if session.status != "active":
            raise HTTPException(status_code=409, detail="Session is already closed.")

        try:
            request_history = tuple(
                f"{'用户' if message.role == 'user' else '助手'}：{message.content.strip()}"
                for message in request.history
                if message.content.strip()
            )
            result = service.answer(
                query,
                category=request.category,
                limit=request.top_k,
                conversation=request_history or session.messages,
            )
        except Exception:
            logger.exception("Answer verification failed; suppressing unverified candidates")
            result = NavigationAnswer(
                answer="AI 核实服务暂时不可用，未返回未经核实的数据库候选，请稍后重试。",
                resources=(),
            )

        sessions.append_exchange(session.id, query, result.answer)
        return SearchResponse(
            results=[_resource_response(resource) for resource in result.resources],
            answer=result.answer,
            session_id=session.id,
            clarifications=list(result.clarifications),
        )

    @app.get("/api/resources", response_model=ResourceListResponse)
    def list_resources(
        q: str = "",
        category: str | None = None,
        group: str | None = None,
        tag: str | None = None,
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=12, ge=1, le=100),
    ) -> ResourceListResponse:
        resources = service.knowledge_base.list_resources(
            query=q,
            category=category,
            group=group,
            tag=tag,
        )
        start = (page - 1) * page_size
        items = resources[start:start + page_size]
        return ResourceListResponse(
            items=[_resource_response(resource) for resource in items],
            total=len(resources),
            page=page,
            page_size=page_size,
        )

    @app.get("/api/resources/{resource_id}", response_model=ResourceResponse)
    def get_resource(resource_id: str) -> ResourceResponse:
        resource = service.knowledge_base.get(resource_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="Resource not found.")
        return _resource_response(resource)

    @app.get("/api/categories", response_model=CategoriesResponse)
    def categories() -> CategoriesResponse:
        return CategoriesResponse(
            categories=service.knowledge_base.categories(),
            tags=sorted({
                tag
                for resource in service.knowledge_base.resources
                for tag in resource.tags
            }),
        )

    @app.post(
        "/api/sessions/{session_id}/exit",
        response_model=SessionResponse,
        status_code=status.HTTP_200_OK,
    )
    def exit_session(session_id: str) -> SessionResponse:
        session = sessions.close(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        return SessionResponse(session_id=session.id, status=session.status)

    return app


def _resource_response(resource: Resource) -> ResourceResponse:
    return ResourceResponse(**resource.to_dict())


app = create_app()
