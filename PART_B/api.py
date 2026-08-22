"""HTTP API consumed by the future web frontend."""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import load_knowledge_base_config, load_llm_config, load_web_config
from navigation_service import ResourceNavigationService, build_navigation_service
from session_store import InMemorySessionStore, SessionStore


logger = logging.getLogger(__name__)


class SessionResponse(BaseModel):
    session_id: str
    status: str


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


class ResourceResponse(BaseModel):
    id: str
    title: str
    url: str | None
    summary: str
    source: str
    metadata: dict[str, object]


class QuestionResponse(BaseModel):
    session_id: str
    answer: str
    resources: list[ResourceResponse]


class HealthResponse(BaseModel):
    status: str
    llm_provider: str
    knowledge_base_provider: str


def create_app(
    navigation_service: ResourceNavigationService | None = None,
    session_store: SessionStore | None = None,
) -> FastAPI:
    web_config = load_web_config()
    app = FastAPI(
        title="Resource Navigation Agent API",
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(web_config.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    app.state.navigation_service = navigation_service or build_navigation_service()
    app.state.session_store = session_store or InMemorySessionStore()

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            llm_provider=load_llm_config().provider,
            knowledge_base_provider=load_knowledge_base_config().provider,
        )

    @app.post(
        "/api/v1/sessions",
        response_model=SessionResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_session() -> SessionResponse:
        session = app.state.session_store.create()
        return SessionResponse(session_id=session.id, status=session.status)

    @app.post(
        "/api/v1/sessions/{session_id}/questions",
        response_model=QuestionResponse,
    )
    def ask_question(session_id: str, request: QuestionRequest) -> QuestionResponse:
        session = app.state.session_store.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        if session.status != "active":
            raise HTTPException(status_code=409, detail="Session is already closed.")

        question = request.question.strip()
        if not question:
            raise HTTPException(status_code=422, detail="Question cannot be empty.")

        try:
            result = app.state.navigation_service.answer(question)
        except Exception as exc:
            logger.exception("Question answering failed")
            raise HTTPException(
                status_code=502,
                detail=f"Question answering failed: {exc}",
            ) from exc

        resources = [
            ResourceResponse(
                id=resource.id,
                title=resource.title,
                url=resource.url,
                summary=resource.summary,
                source=resource.source,
                metadata=resource.metadata,
            )
            for resource in result.resources
        ]
        return QuestionResponse(
            session_id=session_id,
            answer=result.answer,
            resources=resources,
        )

    @app.post(
        "/api/v1/sessions/{session_id}/exit",
        response_model=SessionResponse,
    )
    def exit_session(session_id: str) -> SessionResponse:
        session = app.state.session_store.close(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        return SessionResponse(session_id=session.id, status=session.status)

    return app


app = create_app()
