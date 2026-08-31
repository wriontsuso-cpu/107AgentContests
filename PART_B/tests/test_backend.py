import unittest

from fastapi.testclient import TestClient

from api import create_app
from config import load_knowledge_base_config
from knowledge_base import KnowledgeBase, Resource, build_knowledge_base
from llm_client import LLMClient, LLMRequest, LLMResponse
from navigation_service import ResourceNavigationService
from session_store import InMemorySessionStore


TEST_RESOURCE = Resource(
    id="resource-1",
    title="图书馆学习空间预约",
    url="https://lib.ustc.edu.cn/space",
    source="图书馆",
    category="图书馆资源",
    summary="预约图书馆学习空间。",
    tags=("图书馆", "预约"),
    authority_label="职能部门官方",
    search_text="图书馆 学习空间 座位 预约",
)


class FakeLLMClient(LLMClient):
    def __init__(self, text: str = "请优先查看数据库中的学习空间预约资源。") -> None:
        self.text = text
        self.last_request: LLMRequest | None = None

    def generate(self, request: LLMRequest) -> LLMResponse:
        self.last_request = request
        return LLMResponse(text=self.text)


class FailingLLMClient(LLMClient):
    def generate(self, request: LLMRequest) -> LLMResponse:
        raise RuntimeError("model unavailable")


class FakeKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return (TEST_RESOURCE,)


def build_test_service(llm_client: LLMClient | None = None) -> ResourceNavigationService:
    return ResourceNavigationService(
        llm_client=llm_client or FakeLLMClient(),
        knowledge_base=FakeKnowledgeBase(),
        retrieval_limit=5,
    )


class JsonKnowledgeBaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.knowledge_base = build_knowledge_base(load_knowledge_base_config())

    def test_authoritative_dataset_is_loaded_and_normalized(self) -> None:
        self.assertEqual(len(self.knowledge_base.resources), 1295)
        self.assertTrue(all(resource.id for resource in self.knowledge_base.resources))
        self.assertTrue(all(resource.search_text for resource in self.knowledge_base.resources))

    def test_search_and_url_validation_use_known_data(self) -> None:
        results = self.knowledge_base.search("图书馆座位预约", limit=5)
        self.assertTrue(results)
        self.assertTrue(any("图书馆" in resource.category for resource in results))
        self.assertTrue(self.knowledge_base.is_known_url(results[0].url))
        self.assertFalse(self.knowledge_base.is_known_url("https://evil.example/phish"))

    def test_fuzzy_queries_prefer_weighted_service_entries(self) -> None:
        seats = self.knowledge_base.search("座位预约", limit=5)
        self.assertTrue(seats)
        self.assertTrue(any("学习空间" in resource.title or "研修" in resource.title for resource in seats[:3]))

        typo = self.knowledge_base.search("图书管", limit=8)
        self.assertTrue(any("图书馆" in resource.title or "图书馆" in resource.category for resource in typo[:5]))

        mailbox = self.knowledge_base.search("邮箱", limit=3)
        self.assertEqual(mailbox[0].title, "邮箱")
        self.assertGreaterEqual(mailbox[0].relevance_score, 7)


class NavigationServiceTests(unittest.TestCase):
    def test_database_resources_are_the_llm_context(self) -> None:
        llm_client = FakeLLMClient()
        service = build_test_service(llm_client)

        result = service.answer("如何预约图书馆座位？")

        self.assertEqual(result.resources, (TEST_RESOURCE,))
        self.assertIsNotNone(llm_client.last_request)
        self.assertIn(TEST_RESOURCE.title, llm_client.last_request.user_question)
        self.assertIn(TEST_RESOURCE.url, llm_client.last_request.user_question)
        self.assertIn("首要且唯一资源依据", llm_client.last_request.user_question)

    def test_unknown_model_urls_are_removed(self) -> None:
        service = build_test_service(FakeLLMClient("请访问 https://evil.example/phish"))
        result = service.answer("图书馆预约")
        self.assertNotIn("evil.example", result.answer)
        self.assertIn("未收录链接已移除", result.answer)


class WebApiTests(unittest.TestCase):
    def test_browser_history_is_included_in_the_grounded_llm_request(self) -> None:
        llm_client = FakeLLMClient()
        client = TestClient(create_app(
            build_test_service(llm_client),
            InMemorySessionStore(),
        ))

        response = client.post(
            "/api/search",
            json={
                "query": "那预约时间呢？",
                "history": [
                    {"role": "user", "content": "我想预约图书馆座位"},
                    {"role": "assistant", "content": "可以使用学习空间预约入口。"},
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(llm_client.last_request)
        self.assertIn("用户：我想预约图书馆座位", llm_client.last_request.user_question)
        self.assertIn("助手：可以使用学习空间预约入口。", llm_client.last_request.user_question)

    def test_search_resource_browser_and_exit_contract(self) -> None:
        client = TestClient(create_app(build_test_service(), InMemorySessionStore()))

        search_response = client.post(
            "/api/search",
            json={
                "query": "如何预约图书馆座位？",
                "top_k": 5,
                "category": None,
                "session_id": None,
            },
        )
        self.assertEqual(search_response.status_code, 200)
        payload = search_response.json()
        self.assertEqual(payload["results"][0]["id"], TEST_RESOURCE.id)
        self.assertEqual(payload["results"][0]["authority_label"], "职能部门官方")
        self.assertTrue(payload["session_id"])

        list_response = client.get("/api/resources?q=预约&page=1&page_size=12")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()["total"], 1)

        detail_response = client.get(f"/api/resources/{TEST_RESOURCE.id}")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["url"], TEST_RESOURCE.url)

        exit_response = client.post(f"/api/sessions/{payload['session_id']}/exit")
        self.assertEqual(exit_response.status_code, 200)
        self.assertEqual(exit_response.json()["status"], "closed")

        closed_response = client.post(
            "/api/search",
            json={"query": "继续", "session_id": payload["session_id"]},
        )
        self.assertEqual(closed_response.status_code, 409)

    def test_llm_failure_still_returns_database_results(self) -> None:
        client = TestClient(create_app(
            build_test_service(FailingLLMClient()),
            InMemorySessionStore(),
        ))
        response = client.post("/api/search", json={"query": "图书馆预约"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["url"], TEST_RESOURCE.url)
        self.assertIn("数据库", response.json()["answer"])


if __name__ == "__main__":
    unittest.main()
