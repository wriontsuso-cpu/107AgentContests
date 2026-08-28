"""Replaceable storage for web-session lifecycle and short conversation context."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import Lock
from uuid import uuid4


@dataclass(frozen=True)
class Session:
    id: str
    status: str
    messages: tuple[str, ...] = ()


class SessionStore(ABC):
    @abstractmethod
    def create(self, session_id: str | None = None) -> Session:
        """Create and return an active session."""

    @abstractmethod
    def get(self, session_id: str) -> Session | None:
        """Return a session, or None when it does not exist."""

    @abstractmethod
    def append_exchange(self, session_id: str, question: str, answer: str) -> Session:
        """Append one user/assistant exchange."""

    @abstractmethod
    def close(self, session_id: str) -> Session | None:
        """Mark a session as closed and return its latest state."""


class InMemorySessionStore(SessionStore):
    """Development store; replace with Redis or a database for deployment."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = Lock()

    def create(self, session_id: str | None = None) -> Session:
        session = Session(id=session_id or str(uuid4()), status="active")
        with self._lock:
            existing = self._sessions.get(session.id)
            if existing is not None:
                return existing
            self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            return self._sessions.get(session_id)

    def append_exchange(self, session_id: str, question: str, answer: str) -> Session:
        with self._lock:
            current = self._sessions[session_id]
            messages = (*current.messages, f"用户：{question}", f"助手：{answer}")[-12:]
            updated = Session(id=current.id, status=current.status, messages=messages)
            self._sessions[session_id] = updated
            return updated

    def close(self, session_id: str) -> Session | None:
        with self._lock:
            current = self._sessions.get(session_id)
            if current is None:
                return None

            closed = Session(
                id=current.id,
                status="closed",
                messages=current.messages,
            )
            self._sessions[session_id] = closed
            return closed
