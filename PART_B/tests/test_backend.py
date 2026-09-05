from dataclasses import replace
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from api import create_app
from config import load_knowledge_base_config
from knowledge_base import JsonKnowledgeBase, KnowledgeBase, Resource, build_knowledge_base
from llm_client import LLMCitation, LLMClient, LLMRequest, LLMResponse
from navigation_service import ResourceNavigationService
from page_reader import PageReader, PageSnapshot
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

MIDDLE_ZONE_ROOM_RESOURCE = Resource(
    id="middle-zone-room",
    title="中区研修室预约",
    url="http://roombooking.cmet.ustc.edu.cn/",
    source="学习空间",
    category="资源导航",
    summary="中区研修室预约入口。",
    content="学习空间预约。",
    tags=("中区", "研修室", "预约"),
    authority_label="校内服务",
    search_text="中区 研修室 预约 图书馆 学习空间",
)

PERSON_NOTICE_RESOURCE = Resource(
    id="person-notice",
    title="拟聘用并派来学校工作人选公示",
    url="https://i.ustc.edu.cn/page/site/noticeDetail/example",
    source="人力资源部",
    category="校级通知",
    summary="公示一批拟聘用并派来学校工作的管理岗位人选。",
    published_at="2021-11-04",
    search_text=(
        "拟聘用人选包括张见见。联系电话和邮箱为通知统一反馈渠道，"
        "当前数据中已显示为脱敏占位符。"
    ),
    recommend_priority="medium",
    disposition="flag",
    url_status="reachable",
)

SNAPSHOT_RESOURCE = Resource(
    id="snapshot-github-pack",
    title="GitHub Student Developer Pack",
    url="https://education.github.com/pack",
    source="GitHub Education",
    category="免费软件-会员",
    summary="面向大学生的开发者权益礼包。",
    search_text="GitHub Student Developer Pack GitHub 学生包 学生开发者礼包",
    snapshot_version="2.1",
    snapshot_one_liner="面向大学生的开发者权益礼包，可凭学生身份领取",
    content_kind="权益",
    recommend_priority="high",
    query_aliases=("GitHub 学生包", "GitHub Student Pack"),
    negative_aliases=("JetBrains 学生授权",),
    answerable_facts=("包含 GitHub Pro 与 Copilot 权益", "需要完成学生身份认证"),
    snapshot_confidence="high",
    requires_live_check=False,
    snapshot_enrichment="llm_intent_v1",
    url_status="reachable",
)


class FakeLLMClient(LLMClient):
    def __init__(
        self,
        text: str = (
            "[[DATABASE_VERDICT:EXACT]]\n"
            "[[DATABASE_PRIMARY_ID:resource-1]]\n"
            "请优先查看数据库中的学习空间预约资源。"
        ),
        *,
        citations: tuple[LLMCitation, ...] = (),
        supports_web_search: bool = False,
    ) -> None:
        self.text = text
        self.citations = citations
        self._supports_web_search = supports_web_search
        self.last_request: LLMRequest | None = None

    @property
    def supports_web_search(self) -> bool:
        return self._supports_web_search

    def generate(self, request: LLMRequest) -> LLMResponse:
        self.last_request = request
        return LLMResponse(text=self.text, citations=self.citations)


class SequenceLLMClient(LLMClient):
    def __init__(self, responses: tuple[LLMResponse, ...]) -> None:
        self.responses = responses
        self.requests: list[LLMRequest] = []

    @property
    def supports_web_search(self) -> bool:
        return True

    @property
    def last_request(self) -> LLMRequest | None:
        return self.requests[-1] if self.requests else None

    def generate(self, request: LLMRequest) -> LLMResponse:
        response_index = len(self.requests)
        self.requests.append(request)
        if response_index >= len(self.responses):
            raise AssertionError("Unexpected extra LLM request")
        return self.responses[response_index]


class FailingLLMClient(LLMClient):
    def generate(self, request: LLMRequest) -> LLMResponse:
        raise RuntimeError("model unavailable")


class FakeKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return (TEST_RESOURCE,)


class FakePageReader:
    def read(self, url: str) -> PageSnapshot:
        return PageSnapshot(
            requested_url=url,
            final_url="https://lib.ustc.edu.cn/study-space/reserve",
            title="图书馆学习空间预约系统",
            text="选择校区、学习空间和时间段后提交预约。",
        )


class MiddleZoneRoomPageReader:
    def read(self, url: str) -> PageSnapshot:
        return PageSnapshot(
            requested_url=url,
            final_url="https://roombooking.cmet.ustc.edu.cn/",
            title="学习空间预约",
            text="学习空间预约",
        )


class PortalLoginPageReader:
    def read(self, url: str) -> PageSnapshot:
        return PageSnapshot(
            requested_url=url,
            final_url="https://passport.ustc.edu.cn/login",
            title="统一身份认证",
            text="请登录后访问校内信息门户。",
        )


class EmptyKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return ()


class SingleResourceKnowledgeBase(KnowledgeBase):
    def __init__(self, resource: Resource) -> None:
        self.resource = resource

    @property
    def resources(self) -> tuple[Resource, ...]:
        return (self.resource,)


class WeakMatchKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return (Resource(
            id="weak-resource",
            title="校园服务说明",
            url="https://service.ustc.edu.cn/general",
            source="校园服务",
            category="办事指南",
            content="正文中偶然提到护照二字。",
            search_text="校园服务说明 正文中偶然提到护照二字",
        ),)


FINANCE_CANDIDATE = Resource(
    id="finance-candidate",
    title="学校税号相关财务报销指南",
    url="https://finance.ustc.edu.cn/reimbursement",
    source="财务部门",
    category="财务服务",
    summary="介绍差旅报销和票据提交要求。",
    content="页面说明差旅报销审批流程、票据要求和经费归口。",
    search_text="学校 财务 报销 差旅 票据",
)


class BroadFinanceKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return (FINANCE_CANDIDATE,)


HIGH_CONFIDENCE_RESOURCES = tuple(
    Resource(
        id=f"high-{index}",
        title=f"校园卡补办指南 {index}",
        url=f"https://service.ustc.edu.cn/card/{index}",
        source="校园卡服务",
        category="办事指南",
        summary="校园卡遗失后的补办入口与办理步骤。",
        search_text="校园卡 补办 遗失 办理",
    )
    for index in range(1, 8)
)
WEAK_CONFIDENCE_RESOURCE = Resource(
    id="weak-confidence",
    title="校园生活说明",
    url="https://service.ustc.edu.cn/life",
    source="校园服务",
    category="办事指南",
    content="正文中偶然提到补办二字。",
    search_text="校园生活说明 补办",
)


class MixedConfidenceKnowledgeBase(KnowledgeBase):
    @property
    def resources(self) -> tuple[Resource, ...]:
        return (*HIGH_CONFIDENCE_RESOURCES, WEAK_CONFIDENCE_RESOURCE)


def build_test_service(
    llm_client: LLMClient | None = None,
    knowledge_base: KnowledgeBase | None = None,
    page_reader: PageReader | None = None,
) -> ResourceNavigationService:
    return ResourceNavigationService(
        llm_client=llm_client or FakeLLMClient(),
        knowledge_base=knowledge_base or FakeKnowledgeBase(),
        retrieval_limit=5,
        retrieval_minimum_score=28,
        page_reader=page_reader,
    )


class JsonKnowledgeBaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.knowledge_base = build_knowledge_base(load_knowledge_base_config())

    def test_authoritative_dataset_is_loaded_and_normalized(self) -> None:
        self.assertGreater(len(self.knowledge_base.resources), 10000)
        self.assertTrue(all(resource.id for resource in self.knowledge_base.resources))
        self.assertTrue(all(resource.search_text for resource in self.knowledge_base.resources))

    def test_audit_fields_filter_unrecommendable_resources(self) -> None:
        rows = {
            "articles": [
                {
                    "id": "active",
                    "title": "可用服务入口",
                    "url": "https://example.test/active",
                    "category": "办事指南",
                    "disposition": "keep",
                    "url_status": "reachable",
                    "url_checked_at": "2026-09-02",
                    "content_info": {
                        "digest": "提供可用服务入口。",
                        "points": ["按页面提示办理"],
                    },
                },
                {
                    "id": "restricted",
                    "title": "受限服务入口",
                    "url": "https://example.test/restricted",
                    "category": "办事指南",
                    "disposition": "keep",
                    "url_status": "blocked",
                    "url_err": "需登录/CAS",
                },
                {
                    "id": "deprecated",
                    "title": "停用服务入口",
                    "url": "https://example.test/deprecated",
                    "category": "办事指南",
                    "disposition": "deprecate",
                    "url_status": "reachable",
                },
                {
                    "id": "dead",
                    "title": "失效服务入口",
                    "url": "https://example.test/dead",
                    "category": "办事指南",
                    "disposition": "keep",
                    "url_status": "dead",
                },
            ],
        }
        with TemporaryDirectory() as directory:
            data_path = Path(directory) / "audit.json"
            data_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
            knowledge_base = JsonKnowledgeBase(data_path)

        visible_ids = {resource.id for resource in knowledge_base.list_resources()}
        self.assertEqual(visible_ids, {"active", "restricted"})
        self.assertEqual(
            {resource.id for resource in knowledge_base.search("服务入口", limit=5)},
            {"active", "restricted"},
        )
        self.assertIsNone(knowledge_base.get("deprecated"))
        self.assertFalse(knowledge_base.is_known_url("https://example.test/dead"))
        self.assertEqual(knowledge_base.categories()[0]["count"], 2)

        active = knowledge_base.get("active")
        restricted = knowledge_base.get("restricted")
        self.assertIsNotNone(active)
        self.assertIsNotNone(restricted)
        self.assertEqual(active.summary, "提供可用服务入口。")
        self.assertEqual(active.answerable_facts, ("按页面提示办理",))
        self.assertEqual(active.to_dict()["url_checked_at"], "2026-09-02")
        self.assertEqual(restricted.recommend_priority, "medium")
        self.assertEqual(restricted.access_notes, "需登录/CAS")

    def test_duplicate_source_ids_are_disambiguated_for_api_routes(self) -> None:
        rows = {
            "articles": [
                {
                    "id": "shared-id",
                    "title": "同一通知的校级入口",
                    "url": "https://www.ustc.edu.cn/notice",
                    "source": "学校主站",
                    "category": "校级通知",
                },
                {
                    "id": "shared-id",
                    "title": "同一通知的教务入口",
                    "url": "https://www.ustc.edu.cn/notice",
                    "source": "教务处",
                    "category": "教务通知",
                },
            ],
        }
        with TemporaryDirectory() as directory:
            data_path = Path(directory) / "duplicates.json"
            data_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
            knowledge_base = JsonKnowledgeBase(data_path)

        resource_ids = [resource.id for resource in knowledge_base.resources]
        self.assertEqual(len(resource_ids), len(set(resource_ids)))
        self.assertTrue(all(resource_id.startswith("shared-id-") for resource_id in resource_ids))
        self.assertTrue(all(knowledge_base.get(resource_id) for resource_id in resource_ids))

    def test_search_and_url_validation_use_known_data(self) -> None:
        results = self.knowledge_base.search("图书馆座位预约", limit=5)
        self.assertTrue(results)
        self.assertTrue(any("图书馆" in resource.category for resource in results))
        self.assertTrue(self.knowledge_base.is_known_url(results[0].url))
        self.assertTrue(self.knowledge_base.is_known_url(f"{results[0].url}#ws_call_id=test"))
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

    def test_person_name_in_search_text_outranks_generic_contact_pages(self) -> None:
        rows = {
            "articles": [
                {
                    "id": "person-notice",
                    "title": "拟聘用人选公示",
                    "url": "https://i.ustc.edu.cn/notice/person",
                    "category": "校级通知",
                    "disposition": "flag",
                    "url_status": "reachable",
                    "content_info": {"digest": "公示拟聘用人选。"},
                    "search_text": "拟聘用人选包括张见见。",
                },
                {
                    "id": "generic-contact",
                    "title": "联系方式",
                    "url": "https://www.ustc.edu.cn/contact",
                    "category": "网站入口",
                    "disposition": "keep",
                    "url_status": "reachable",
                    "search_text": "学校各部门联系方式、电话和邮箱。",
                },
            ],
        }
        with TemporaryDirectory() as directory:
            data_path = Path(directory) / "people.json"
            data_path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
            knowledge_base = JsonKnowledgeBase(data_path)

        for query in ("张见见老师", "张见见的联系方式", "查一下张见见老师的信息"):
            with self.subTest(query=query):
                results = knowledge_base.search(query, limit=5, minimum_score=28)
                self.assertTrue(results)
                self.assertEqual(results[0].id, "person-notice")

    def test_jsonl_snapshot_fields_drive_alias_and_negative_alias_matching(self) -> None:
        rows = [
            {
                "id": "snapshot-target",
                "title": "GitHub 教育资源",
                "url": "https://education.github.com/pack",
                "category": "免费软件-会员",
                "search_text_positive": "GitHub 学生包 学生开发者礼包",
                "url_status": "reachable",
                "snapshot": {
                    "snapshot_version": "2.1",
                    "one_liner": "GitHub 学生开发者权益入口",
                    "description": "完成学生身份认证后可领取开发者权益。",
                    "content_kind": "权益",
                    "recommend_priority": "high",
                    "query_aliases": ["GitHub 学生包"],
                    "negative_aliases": ["JetBrains 学生授权"],
                    "answerable_facts": [{"fact": "需完成学生身份认证"}],
                    "confidence": "high",
                    "requires_live_check": False,
                    "enrichment": "llm_intent_v1",
                },
            },
            {
                "id": "snapshot-skip",
                "title": "GitHub 学生包旧入口",
                "url": "https://example.invalid/old",
                "category": "免费软件-会员",
                "search_text_positive": "GitHub 学生包",
                "snapshot": {
                    "snapshot_version": "2.1",
                    "recommend_priority": "skip",
                },
            },
        ]
        with TemporaryDirectory() as directory:
            data_path = Path(directory) / "snapshots.jsonl"
            data_path.write_text(
                "\n".join(json.dumps(row, ensure_ascii=False) for row in rows),
                encoding="utf-8",
            )
            knowledge_base = JsonKnowledgeBase(data_path)

        results = knowledge_base.search("GitHub 学生包", limit=5, minimum_score=28)
        negative_results = knowledge_base.search(
            "JetBrains 学生授权",
            limit=5,
            minimum_score=0,
        )

        self.assertEqual([resource.id for resource in results], ["snapshot-target"])
        self.assertEqual(results[0].snapshot_one_liner, "GitHub 学生开发者权益入口")
        self.assertEqual(results[0].answerable_facts, ("需完成学生身份认证",))
        self.assertEqual(negative_results, [])


class NavigationServiceTests(unittest.TestCase):
    def test_progress_callback_reports_real_verification_stages(self) -> None:
        llm_client = SequenceLLMClient((
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:VERIFY]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]"
                ),
            ),
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:EXACT]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]\n"
                    "页面说明可以预约学习空间。"
                ),
            ),
        ))
        updates: list[tuple[str, str]] = []
        service = build_test_service(
            llm_client,
            page_reader=FakePageReader(),
        )

        service.answer(
            "学习空间怎么预约",
            progress_callback=lambda stage, message: updates.append((stage, message)),
        )

        stages = [stage for stage, _ in updates]
        self.assertEqual(stages[:3], ["understanding", "database_search", "candidate_review"])
        self.assertIn("page_fetch", stages)
        self.assertIn("answer_verification", stages)

    def test_small_talk_skips_search_model_and_page_access_even_with_history(self) -> None:
        knowledge_base = FakeKnowledgeBase()
        llm_client = SequenceLLMClient(())
        page_reader = FakePageReader()
        service = build_test_service(llm_client, knowledge_base, page_reader)

        with (
            patch.object(knowledge_base, "search", side_effect=AssertionError("Unexpected search")) as search,
            patch.object(page_reader, "read", side_effect=AssertionError("Unexpected page read")) as read,
        ):
            for question in ("你好", "  您好呀！  ", "在吗？", "谢谢！", "好的，谢谢", "再见", "你能做什么？", "ＨＥＬＬＯ！", "Thank you"):
                with self.subTest(question=question):
                    result = service.answer(question, conversation=("用户：图书馆怎么预约",))
                    self.assertEqual(result.response_type, "conversation")
                    self.assertTrue(result.answer)
                    self.assertNotIn("未检索到", result.answer)
                    self.assertEqual(result.resources, ())
                    self.assertEqual(result.clarifications, ())
            search.assert_not_called()
            read.assert_not_called()
        self.assertEqual(llm_client.requests, [])

    def test_greetings_attached_to_questions_still_use_resource_verification(self) -> None:
        for question in ("你好，请问图书馆怎么预约？", "谢谢，图书馆预约时间呢？", "帮我找名为你好的活动", "好的", "继续"):
            with self.subTest(question=question):
                llm_client = FakeLLMClient()
                service = build_test_service(llm_client)
                result = service.answer(question, conversation=("用户：图书馆怎么预约",))
                self.assertEqual(result.response_type, "navigation")
                self.assertEqual(result.resources, (TEST_RESOURCE,))
                self.assertIsNotNone(llm_client.last_request)
                self.assertIn(question, llm_client.last_request.user_question)

    def test_small_talk_is_excluded_from_retrieval_but_task_context_is_kept(self) -> None:
        query = ResourceNavigationService._build_retrieval_query(
            "那预约时间呢？",
            ("用户：你好！", "用户：图书馆座位预约", "助手：请查看入口", "用户：谢谢", "用户：在吗", "用户：好的"),
        )
        self.assertEqual(query, "图书馆座位预约 好的 那预约时间呢？")

    def test_trusted_static_snapshot_skips_model_and_page_verification(self) -> None:
        llm_client = FakeLLMClient("不应被调用")
        service = build_test_service(
            llm_client,
            SingleResourceKnowledgeBase(SNAPSHOT_RESOURCE),
        )

        result = service.answer("GitHub 学生包")

        self.assertIsNone(llm_client.last_request)
        self.assertEqual(result.resources, (SNAPSHOT_RESOURCE,))
        self.assertIn("当前离线资源快照", result.answer)
        self.assertIn("GitHub Pro", result.answer)

    def test_snapshot_requiring_live_check_keeps_existing_verification_flow(self) -> None:
        live_resource = replace(SNAPSHOT_RESOURCE, requires_live_check=True)
        llm_client = FakeLLMClient(
            "[[DATABASE_VERDICT:EXACT]]\n"
            "[[DATABASE_PRIMARY_ID:snapshot-github-pack]]\n"
            "数据库候选通过模型筛选。"
        )
        service = build_test_service(
            llm_client,
            SingleResourceKnowledgeBase(live_resource),
        )

        service.answer("GitHub 学生包")

        self.assertIsNotNone(llm_client.last_request)
        self.assertEqual(llm_client.last_request.web_access, "none")

    def test_database_resources_are_the_llm_context(self) -> None:
        llm_client = FakeLLMClient()
        service = build_test_service(llm_client)

        result = service.answer("如何预约图书馆座位？")

        self.assertEqual(result.resources, (TEST_RESOURCE,))
        self.assertIsNotNone(llm_client.last_request)
        self.assertIn(TEST_RESOURCE.title, llm_client.last_request.user_question)
        self.assertIn(TEST_RESOURCE.url, llm_client.last_request.user_question)
        self.assertIn("只是数据库检索召回的候选资源", llm_client.last_request.user_question)
        self.assertEqual(llm_client.last_request.web_access, "none")
        self.assertIn("DATABASE_VERDICT:VERIFY", llm_client.last_request.user_question)
        self.assertIn("DATABASE_PRIMARY_ID", llm_client.last_request.user_question)
        self.assertEqual(llm_client.last_request.max_output_tokens, 800)
        self.assertIn("仅依据项目数据库快照", result.answer)
        self.assertNotIn("DATABASE_VERDICT", result.answer)
        self.assertNotIn("DATABASE_PRIMARY_ID", result.answer)

    def test_database_answer_is_unmarked_after_exact_page_visit(self) -> None:
        llm_client = FakeLLMClient(
            "[[DATABASE_VERDICT:EXACT]]\n"
            "[[DATABASE_PRIMARY_ID:resource-1]]\n"
            "页面说明可以预约学习空间。",
            citations=(LLMCitation(TEST_RESOURCE.title, TEST_RESOURCE.url),),
            supports_web_search=True,
        )
        service = build_test_service(llm_client)

        result = service.answer("如何预约图书馆座位？")

        self.assertNotIn("仅依据项目数据库快照", result.answer)
        self.assertEqual(result.resources, (TEST_RESOURCE,))

    def test_unique_candidate_is_visited_before_it_becomes_an_exact_answer(self) -> None:
        llm_client = SequenceLLMClient((
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:VERIFY]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]"
                ),
            ),
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:EXACT]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]\n"
                    "该页面就是学习空间预约入口。"
                ),
                citations=(LLMCitation(TEST_RESOURCE.title, TEST_RESOURCE.url),),
            ),
        ))
        service = build_test_service(llm_client)

        result = service.answer("学习空间开放时间")

        self.assertEqual(len(llm_client.requests), 2)
        self.assertEqual(llm_client.requests[0].web_access, "none")
        self.assertEqual(llm_client.requests[1].web_access, "open_known_urls")
        self.assertEqual(result.resources, (TEST_RESOURCE,))

    def test_backend_page_snapshot_is_used_before_model_web_tools(self) -> None:
        llm_client = SequenceLLMClient((
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:VERIFY]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]"
                ),
            ),
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:EXACT]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]\n"
                    "实时页面提供学习空间预约入口。"
                ),
            ),
        ))
        service = build_test_service(
            llm_client,
            page_reader=FakePageReader(),
        )

        result = service.answer("学习空间开放时间")

        self.assertEqual(len(llm_client.requests), 2)
        self.assertEqual(llm_client.requests[1].web_access, "none")
        self.assertEqual(llm_client.requests[1].max_output_tokens, 1600)
        self.assertIn("后端实时页面内容核实", llm_client.requests[1].user_question)
        self.assertIn("选择校区、学习空间和时间段", llm_client.requests[1].user_question)
        self.assertEqual(result.resources, (TEST_RESOURCE,))
        self.assertNotIn("网页实时访问未能确认", result.answer)

    def test_navigation_entry_still_requires_semantic_page_verification(self) -> None:
        llm_client = SequenceLLMClient((
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:VERIFY]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]"
                ),
            ),
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:EXACT]]\n"
                    "[[DATABASE_PRIMARY_ID:resource-1]]\n"
                    "实时页面确认这是图书馆学习空间预约入口。"
                ),
            ),
        ))
        service = build_test_service(
            llm_client,
            page_reader=FakePageReader(),
        )

        result = service.answer("图书馆怎么预约？")

        self.assertEqual(len(llm_client.requests), 2)
        self.assertIn("校区、地点、机构和服务对象", llm_client.requests[1].user_question)
        self.assertEqual(result.resources, (TEST_RESOURCE,))
        self.assertIn("学习空间预约入口", result.answer)

    def test_similar_middle_zone_room_does_not_answer_middle_zone_library_question(self) -> None:
        official_overview_url = "https://lib.ustc.edu.cn/about/library"
        llm_client = SequenceLLMClient((
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:VERIFY]]\n"
                    "[[DATABASE_PRIMARY_ID:middle-zone-room]]"
                ),
            ),
            LLMResponse(text="[[DATABASE_VERDICT:INSUFFICIENT]]"),
            LLMResponse(
                text=(
                    "[[WEB_VERDICT:EXACT]]\n"
                    f"[[WEB_PRIMARY_URL:{official_overview_url}]]\n"
                    "图书馆官方当前馆舍列表未列出中区图书馆，因此不能把中区研修室预约入口当作图书馆入口。"
                ),
                citations=(LLMCitation("中国科大图书馆本馆简介", official_overview_url),),
            ),
        ))
        service = build_test_service(
            llm_client,
            SingleResourceKnowledgeBase(MIDDLE_ZONE_ROOM_RESOURCE),
            MiddleZoneRoomPageReader(),
        )

        result = service.answer("中区图书馆怎么预约")

        self.assertEqual(
            [request.web_access for request in llm_client.requests],
            ["none", "none", "search_web"],
        )
        self.assertEqual(len(result.resources), 1)
        self.assertEqual(result.resources[0].kind, "web")
        self.assertNotEqual(result.resources[0].id, MIDDLE_ZONE_ROOM_RESOURCE.id)
        self.assertIn("未列出中区图书馆", result.answer)

    def test_exact_person_detail_uses_index_evidence_and_survives_live_miss(self) -> None:
        llm_client = SequenceLLMClient((
            LLMResponse(
                text=(
                    "[[DATABASE_VERDICT:EXACT]]\n"
                    "[[DATABASE_PRIMARY_ID:person-notice]]\n"
                    "2021 年 11 月 4 日的历史公示名单提及张见见；"
                    "这不能证明其当前任职。通知中的联系方式是统一反馈渠道且已脱敏，"
                    "不能作为张见见的个人联系方式。"
                ),
            ),
            LLMResponse(text="[[DATABASE_VERDICT:INSUFFICIENT]]"),
            LLMResponse(text="[[WEB_VERDICT:INSUFFICIENT]]"),
        ))
        service = build_test_service(
            llm_client,
            SingleResourceKnowledgeBase(PERSON_NOTICE_RESOURCE),
            PortalLoginPageReader(),
        )

        result = service.answer("查一下张见见老师的信息")

        self.assertEqual(
            [request.web_access for request in llm_client.requests],
            ["none", "none", "search_web"],
        )
        initial_prompt = llm_client.requests[0].user_question
        self.assertIn("检索命中原文片段", initial_prompt)
        self.assertIn("张见见", initial_prompt)
        self.assertIn("通知末尾的统一反馈电话、邮箱不得归属于", initial_prompt)
        self.assertEqual(result.resources, (PERSON_NOTICE_RESOURCE,))
        self.assertIn("仅依据项目数据库快照", result.answer)
        self.assertIn("不能证明其当前任职", result.answer)

    def test_unknown_model_urls_are_removed(self) -> None:
        service = build_test_service(FakeLLMClient(
            "[[DATABASE_VERDICT:EXACT]]\n"
            "[[DATABASE_PRIMARY_ID:resource-1]]\n"
            "请访问 https://evil.example/phish"
        ))
        result = service.answer("图书馆预约")
        self.assertNotIn("evil.example", result.answer)
        self.assertIn("未收录链接已移除", result.answer)

    def test_broad_database_candidate_falls_back_to_web_when_content_is_insufficient(self) -> None:
        llm_client = SequenceLLMClient((
            LLMResponse(
                text="[[DATABASE_VERDICT:INSUFFICIENT]]",
                citations=(LLMCitation(FINANCE_CANDIDATE.title, FINANCE_CANDIDATE.url),),
            ),
            LLMResponse(
                text=(
                    "[[WEB_VERDICT:EXACT]]\n"
                    "[[WEB_PRIMARY_URL:https://www.ustc.edu.cn/services/tax-id]]\n"
                    "学校税号见官方信息页。来源：https://www.ustc.edu.cn/services/tax-id"
                ),
                citations=(LLMCitation(
                    "中国科大学校信息",
                    "https://www.ustc.edu.cn/services/tax-id",
                ),),
            ),
        ))
        service = build_test_service(llm_client, BroadFinanceKnowledgeBase())

        result = service.answer("学校税号")

        self.assertEqual(len(llm_client.requests), 2)
        self.assertEqual(llm_client.requests[0].web_access, "none")
        self.assertIn("数据库候选内容核实", llm_client.requests[0].user_question)
        self.assertEqual(llm_client.requests[1].web_access, "search_web")
        self.assertIn("候选内容不足", llm_client.requests[1].user_question)
        self.assertEqual(len(result.resources), 1)
        self.assertEqual(result.resources[0].kind, "web")
        self.assertNotEqual(result.resources[0].id, FINANCE_CANDIDATE.id)
        self.assertNotIn("DATABASE_VERDICT", result.answer)

    def test_missing_verification_verdict_returns_no_unverified_candidates(self) -> None:
        service = build_test_service(
            FakeLLMClient("财务报销资源可能相关。"),
            BroadFinanceKnowledgeBase(),
        )

        result = service.answer("学校税号")

        self.assertEqual(result.answer, "当前未检索到合适内容。")
        self.assertEqual(result.resources, ())

    def test_non_exact_answer_returns_at_most_five_high_threshold_candidates(self) -> None:
        service = build_test_service(
            FakeLLMClient(
                "[[DATABASE_VERDICT:RELATED]]\n"
                "[[DATABASE_RELATED_IDS:high-1,high-2,high-3,high-4,high-5,high-6,high-7,weak-confidence]]"
            ),
            MixedConfidenceKnowledgeBase(),
        )

        result = service.answer("校园卡补办", limit=20)

        self.assertEqual(len(result.resources), 5)
        self.assertTrue(all(resource.id.startswith("high-") for resource in result.resources))
        self.assertNotIn(WEAK_CONFIDENCE_RESOURCE, result.resources)
        self.assertIn("高阈值", result.answer)

    def test_exact_primary_outside_first_five_is_the_only_returned_resource(self) -> None:
        primary = HIGH_CONFIDENCE_RESOURCES[6]
        llm_client = FakeLLMClient(
            "[[DATABASE_VERDICT:EXACT]]\n"
            f"[[DATABASE_PRIMARY_ID:{primary.id}]]\n"
            "该页面给出了确定的校园卡补办入口。"
        )
        service = build_test_service(llm_client, MixedConfidenceKnowledgeBase())

        result = service.answer("校园卡补办")

        self.assertEqual(result.resources, (primary,))
        self.assertIsNotNone(llm_client.last_request)
        self.assertIn(f"资源 ID：{primary.id}", llm_client.last_request.user_question)

    def test_no_candidate_above_high_threshold_returns_no_related_information(self) -> None:
        service = build_test_service(
            FakeLLMClient("不应被调用"),
            WeakMatchKnowledgeBase(),
        )

        result = service.answer("护照")

        self.assertEqual(result.answer, "当前未检索到合适内容。")
        self.assertEqual(result.resources, ())

    def test_database_miss_uses_only_trusted_web_citations(self) -> None:
        llm_client = FakeLLMClient(
            "[[WEB_VERDICT:RELATED]]\n"
            "根据官方通知办理。来源：https://www.ustc.edu.cn/notice；转载：https://forum.example/notice",
            citations=(
                LLMCitation("中国科大官方通知", "https://www.ustc.edu.cn/notice"),
                LLMCitation("论坛转载", "https://forum.example/notice"),
            ),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, EmptyKnowledgeBase())

        result = service.answer("最新办理通知")

        self.assertEqual(llm_client.last_request.web_access, "search_web")
        self.assertEqual(len(result.resources), 1)
        self.assertEqual(result.resources[0].kind, "web")
        self.assertEqual(result.resources[0].url, "https://www.ustc.edu.cn/notice")
        self.assertNotIn("forum.example", result.answer)
        self.assertIn("未收录链接已移除", result.answer)

    def test_exact_web_answer_returns_only_declared_primary_source(self) -> None:
        primary_url = "https://finance.ustc.edu.cn/tax-info"
        llm_client = FakeLLMClient(
            "[[WEB_VERDICT:EXACT]]\n"
            f"[[WEB_PRIMARY_URL:{primary_url}]]\n"
            f"学校税号见财务处页面。来源：（{primary_url}）",
            citations=(
                LLMCitation("财务处开票信息", f"{primary_url}#ws_call_id=test"),
                LLMCitation("学校相关通知", "https://www.ustc.edu.cn/tax-notice"),
            ),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, EmptyKnowledgeBase())

        result = service.answer("学校税号")

        self.assertEqual(len(result.resources), 1)
        self.assertEqual(result.resources[0].url, primary_url)
        self.assertNotIn("未收录链接已移除", result.answer)
        self.assertNotIn("WEB_VERDICT", result.answer)
        self.assertNotIn("WEB_PRIMARY_URL", result.answer)

    def test_database_and_web_miss_returns_fixed_no_result_message(self) -> None:
        llm_client = FakeLLMClient(
            "网上有人提到过。",
            citations=(LLMCitation("非可信页面", "https://example.com/post"),),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, EmptyKnowledgeBase())

        result = service.answer("找一个不存在的资源")

        self.assertEqual(result.answer, "当前未检索到合适内容。")
        self.assertEqual(result.resources, ())

    def test_missing_web_verdict_does_not_return_unverified_citations(self) -> None:
        llm_client = FakeLLMClient(
            "这个页面可能相关。",
            citations=(LLMCitation("中国科大页面", "https://www.ustc.edu.cn/maybe"),),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, EmptyKnowledgeBase())

        result = service.answer("不确定的问题")

        self.assertEqual(result.answer, "当前未检索到合适内容。")
        self.assertEqual(result.resources, ())

    def test_substantive_cited_web_answer_survives_a_missing_control_marker(self) -> None:
        official_url = "https://finance.ustc.edu.cn/tax-info"
        llm_client = FakeLLMClient(
            f"根据学校财务处官方页面，学校统一社会信用代码可在开票信息中查询。来源：{official_url}",
            citations=(LLMCitation("财务处开票信息", official_url),),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, EmptyKnowledgeBase())

        result = service.answer("学校税号")

        self.assertEqual(len(result.resources), 1)
        self.assertEqual(result.resources[0].url, official_url)
        self.assertIn("统一社会信用代码", result.answer)

    def test_exact_web_answer_uses_sole_citation_when_primary_marker_is_missing(self) -> None:
        official_url = "https://finance.ustc.edu.cn/tax-info"
        llm_client = FakeLLMClient(
            "[[WEB_VERDICT:EXACT]]\n学校税号可在财务处官方开票信息页面中核实。",
            citations=(LLMCitation("财务处开票信息", official_url),),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, EmptyKnowledgeBase())

        result = service.answer("学校税号")

        self.assertEqual(len(result.resources), 1)
        self.assertEqual(result.resources[0].url, official_url)
        self.assertNotIn("WEB_VERDICT", result.answer)

    def test_weak_database_match_does_not_block_web_fallback(self) -> None:
        llm_client = FakeLLMClient(
            "[[WEB_VERDICT:EXACT]]\n"
            "[[WEB_PRIMARY_URL:https://www.gov.cn/passport]]\n"
            "依据官方页面回答。来源：https://www.gov.cn/passport",
            citations=(LLMCitation("政府官方页面", "https://www.gov.cn/passport"),),
            supports_web_search=True,
        )
        service = build_test_service(llm_client, WeakMatchKnowledgeBase())

        result = service.answer("护照")

        self.assertEqual(llm_client.last_request.web_access, "search_web")
        self.assertEqual(result.resources[0].kind, "web")


class WebApiTests(unittest.TestCase):
    def test_streaming_search_emits_progress_and_result_events(self) -> None:
        client = TestClient(create_app(build_test_service(), InMemorySessionStore()))

        with client.stream("POST", "/api/search/stream", json={"query": "你好"}) as response:
            events = [json.loads(line) for line in response.iter_lines() if line]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/x-ndjson")
        self.assertEqual(events[0]["type"], "progress")
        self.assertEqual(events[0]["stage"], "understanding")
        self.assertEqual(events[-1]["type"], "result")
        self.assertEqual(events[-1]["data"]["response_type"], "conversation")

    def test_small_talk_is_saved_in_session_and_farewell_does_not_close_it(self) -> None:
        sessions = InMemorySessionStore()
        client = TestClient(create_app(build_test_service(FailingLLMClient()), sessions))

        response = client.post("/api/search", json={"query": "你好"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["response_type"], "conversation")
        self.assertEqual(payload["results"], [])
        self.assertIn("你好", payload["answer"])
        session_id = payload["session_id"]
        self.assertIn("用户：你好", sessions.get(session_id).messages)

        farewell = client.post("/api/search", json={"query": "再见", "session_id": session_id})
        self.assertEqual(farewell.json()["response_type"], "conversation")
        self.assertEqual(sessions.get(session_id).status, "active")
        follow_up = client.post("/api/search", json={"query": "在吗", "session_id": session_id})
        self.assertEqual(follow_up.status_code, 200)
        self.assertEqual(follow_up.json()["session_id"], session_id)
        self.assertEqual(len(sessions.get(session_id).messages), 6)

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
        self.assertEqual(payload["response_type"], "navigation")
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

    def test_llm_failure_does_not_return_unverified_database_candidates(self) -> None:
        client = TestClient(create_app(
            build_test_service(FailingLLMClient()),
            InMemorySessionStore(),
        ))
        response = client.post("/api/search", json={"query": "图书馆预约"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
        self.assertIn("未返回未经核实", response.json()["answer"])


if __name__ == "__main__":
    unittest.main()
