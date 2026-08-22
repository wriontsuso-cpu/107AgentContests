"""Replaceable storage for web-session lifecycle state."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import Lock
from uuid import uuid4


@dataclass(frozen=True)
class Session:
    id: str
    status: str


class SessionStore(ABC):
    @abstractmethod
    def create(self) -> Session:
        """Create and return an active session."""

    @abstractmethod
    def get(self, session_id: str) -> Session | None:
        """Return a session, or None when it does not exist."""

    @abstractmethod
    def close(self, session_id: str) -> Session | None:
        """Mark a session as closed and return its latest state."""


class InMemorySessionStore(SessionStore):
    """Development store; replace with Redis or a database for deployment."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = Lock()

    def create(self) -> Session:
        session = Session(id=str(uuid4()), status="active")
        with self._lock:
            self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            return self._sessions.get(session_id)

    def close(self, session_id: str) -> Session | None:
        with self._lock:
            current = self._sessions.get(session_id)
            if current is None:
                return None

            closed = Session(id=current.id, status="closed")
            self._sessions[session_id] = closed
            return closed
