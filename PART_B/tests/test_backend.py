import unittest

from fastapi.testclient import TestClient

from api import create_app
from knowledge_base import KnowledgeBase, Resource
from llm_client import LLMClient, LLMRequest, LLMResponse
from navigation_service import ResourceNavigationService
from session_store import InMemorySessionStore


class FakeLLMClient(LLMClient):
    def __init__(self) -> None:
        self.last_request: LLMRequest | None = None

    def generate(self, request: LLMRequest) -> LLMResponse:
        self.last_request = request
        return LLMResponse(text="concise answer")


class FakeKnowledgeBase(KnowledgeBase):
    def search(self, query: str, limit: int) -> list[Resource]:
        return [
            Resource(
                id="resource-1",
                title="RAG Guide",
                url="https://example.com/rag",
                summary="An introduction to retrieval-augmented generation.",
            )
        ][:limit]


def build_test_service() -> tuple[ResourceNavigationService, FakeLLMClient]:
    llm_client = FakeLLMClient()
    service = ResourceNavigationService(
        llm_client=llm_client,
        knowledge_base=FakeKnowledgeBase(),
        retrieval_limit=5,
    )
    return service, llm_client


class NavigationServiceTests(unittest.TestCase):
    def test_database_resources_are_passed_to_the_llm(self) -> None:
        service, llm_client = build_test_service()

        result = service.answer("How do I learn RAG?")

        self.assertEqual(result.answer, "concise answer")
        self.assertEqual(result.resources[0].title, "RAG Guide")
        self.assertIsNotNone(llm_client.last_request)
        self.assertIn("RAG Guide", llm_client.last_request.user_question)
        self.assertIn("https://example.com/rag", llm_client.last_request.user_question)


class WebApiTests(unittest.TestCase):
    def test_question_and_exit_flow(self) -> None:
        service, _ = build_test_service()
        client = TestClient(create_app(service, InMemorySessionStore()))

        create_response = client.post("/api/v1/sessions")
        self.assertEqual(create_response.status_code, 201)
        session_id = create_response.json()["session_id"]

        question_response = client.post(
            f"/api/v1/sessions/{session_id}/questions",
            json={"question": "How do I learn RAG?"},
        )
        self.assertEqual(question_response.status_code, 200)
        self.assertEqual(question_response.json()["answer"], "concise answer")
        self.assertEqual(
            question_response.json()["resources"][0]["title"],
            "RAG Guide",
        )

        exit_response = client.post(f"/api/v1/sessions/{session_id}/exit")
        self.assertEqual(exit_response.status_code, 200)
        self.assertEqual(exit_response.json()["status"], "closed")

        closed_response = client.post(
            f"/api/v1/sessions/{session_id}/questions",
            json={"question": "Another question"},
        )
        self.assertEqual(closed_response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
