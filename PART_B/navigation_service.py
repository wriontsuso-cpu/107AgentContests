"""Database-first navigation service shared by the CLI and HTTP API."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import md5
import logging
import re
from urllib.parse import urlparse

from config import load_knowledge_base_config, load_llm_config
from knowledge_base import KnowledgeBase, Resource, build_knowledge_base
from llm_client import LLMCitation, LLMClient, LLMRequest, build_llm_client
from page_reader import HttpPageReader, PageReader, PageSnapshot
from prompts import RESOURCE_NAVIGATION_SYSTEM_PROMPT


_URL_PATTERN = re.compile(r"https?://[^\s<>()\]）】》」』，。；、]+", re.IGNORECASE)
_CLARIFICATION_PATTERN = re.compile(r"[①②③④]\s*([^；。\n]+)")
_DATABASE_VERDICT_PATTERN = re.compile(
    r"\[\[DATABASE_VERDICT:(VERIFY|EXACT|RELATED|INSUFFICIENT)\]\]",
    re.IGNORECASE,
)
_DATABASE_PRIMARY_ID_PATTERN = re.compile(
    r"\[\[DATABASE_PRIMARY_ID:([^\]\r\n]+)\]\]",
    re.IGNORECASE,
)
_DATABASE_RELATED_IDS_PATTERN = re.compile(
    r"\[\[DATABASE_RELATED_IDS:([^\]\r\n]+)\]\]",
    re.IGNORECASE,
)
_WEB_VERDICT_PATTERN = re.compile(
    r"\[\[WEB_VERDICT:(EXACT|RELATED|INSUFFICIENT)\]\]",
    re.IGNORECASE,
)
_WEB_PRIMARY_URL_PATTERN = re.compile(
    r"\[\[WEB_PRIMARY_URL:(https?://[^\]\r\n]+)\]\]",
    re.IGNORECASE,
)
_NO_TRUSTED_RESULT = "当前未检索到合适内容。"
_RELATED_CANDIDATES_RESULT = (
    "未找到可直接确认的唯一答案，以下仅列出相关度达到高阈值的候选资源。"
)
_DEFAULT_TRUSTED_WEB_DOMAINS = ("ustc.edu.cn", "edu.cn", "gov.cn")
_WEAK_WEB_ANSWER_TERMS = (
    "可能相关",
    "也许相关",
    "似乎相关",
    "无法确认",
    "未能确认",
    "没有足够信息",
    "未找到可信",
    _NO_TRUSTED_RESULT,
)
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NavigationAnswer:
    answer: str
    resources: tuple[Resource, ...]
    clarifications: tuple[str, ...] = ()


class ResourceNavigationService:
    def __init__(
        self,
        llm_client: LLMClient,
        knowledge_base: KnowledgeBase,
        retrieval_limit: int,
        retrieval_minimum_score: float = 28.0,
        trusted_web_domains: tuple[str, ...] = _DEFAULT_TRUSTED_WEB_DOMAINS,
        page_reader: PageReader | None = None,
    ) -> None:
        self.llm_client = llm_client
        self.knowledge_base = knowledge_base
        self.retrieval_limit = retrieval_limit
        self.retrieval_minimum_score = max(retrieval_minimum_score, 0.0)
        self.trusted_web_domains = tuple(
            domain.lower().lstrip(".") for domain in trusted_web_domains if domain
        )
        self.page_reader = page_reader

    def answer(
        self,
        question: str,
        *,
        category: str | None = None,
        limit: int | None = None,
        conversation: tuple[str, ...] = (),
    ) -> NavigationAnswer:
        normalized_question = question.strip()
        if not normalized_question:
            raise ValueError("Question cannot be empty.")

        retrieval_limit = min(max(limit or self.retrieval_limit, 1), 5)
        candidate_pool_limit = min(max(retrieval_limit * 2, 10), 20)
        retrieval_query = self._build_retrieval_query(normalized_question, conversation)
        resources = self.knowledge_base.search(
            retrieval_query,
            limit=candidate_pool_limit,
            category=category,
            minimum_score=self.retrieval_minimum_score,
        )
        if resources:
            return self._answer_from_database_candidates(
                normalized_question,
                resources,
                retrieval_limit,
                conversation,
            )
        return self._answer_from_trusted_web(
            normalized_question,
            retrieval_limit,
            conversation,
            database_candidates_found=False,
        )

    def _answer_from_database_candidates(
        self,
        question: str,
        resources: list[Resource],
        retrieval_limit: int,
        conversation: tuple[str, ...],
    ) -> NavigationAnswer:
        snapshot_answer = self._answer_from_trusted_snapshot(question, resources)
        if snapshot_answer is not None:
            return snapshot_answer

        response = self.llm_client.generate(
            LLMRequest(
                system_prompt=RESOURCE_NAVIGATION_SYSTEM_PROMPT,
                user_question=self._build_database_verification_question(
                    question,
                    resources,
                    conversation,
                ),
                web_access="none",
                max_output_tokens=800,
            )
        )
        verdict = self._database_verdict(response.text)
        answer = self._remove_database_control_markers(response.text)
        primary_resource = self._database_primary_resource(resources, response.text)
        logger.info(
            "Database screening verdict=%s primary_id=%s",
            verdict or "missing",
            primary_resource.id if primary_resource is not None else "none",
        )
        if (
            verdict in {"verify", "exact"}
            and primary_resource is not None
            and (answer or self.llm_client.supports_web_search)
        ):
            return self._answer_from_primary_database_resource(
                question,
                primary_resource,
                answer,
                retrieval_limit,
                conversation,
                snapshot_is_exact=verdict == "exact",
            )

        related_resources = self._database_related_resources(
            resources,
            response.text,
            retrieval_limit,
        )
        logger.info(
            "Database screening verdict=%s primary_id=%s related_count=%d",
            verdict or "missing",
            primary_resource.id if primary_resource is not None else "none",
            len(related_resources),
        )
        related_fallback = (
            NavigationAnswer(
                answer=_RELATED_CANDIDATES_RESULT,
                resources=related_resources,
            )
            if verdict == "related" and related_resources
            else None
        )
        return self._answer_from_trusted_web(
            question,
            retrieval_limit,
            conversation,
            database_candidates_found=True,
            fallback=related_fallback,
        )

    @staticmethod
    def _answer_from_trusted_snapshot(
        question: str,
        resources: list[Resource],
    ) -> NavigationAnswer | None:
        eligible_resources = tuple(
            resource
            for resource in resources
            if _is_trusted_snapshot_match(question, resource)
        )
        if len(eligible_resources) != 1 or eligible_resources[0].id != resources[0].id:
            return None

        resource = eligible_resources[0]
        lead = (resource.snapshot_one_liner or resource.summary).strip().rstrip("。；; ")
        if not lead:
            return None

        facts = tuple(
            fact.strip().rstrip("。；; ")
            for fact in resource.answerable_facts
            if fact.strip()
            and _normalize_match_phrase(fact) not in _normalize_match_phrase(lead)
        )[:3]
        answer_parts = [f"根据当前离线资源快照：{lead}。"]
        if facts:
            answer_parts.append(f"关键信息：{'；'.join(facts)}。")
        if resource.how_to_steps:
            steps = "；".join(resource.how_to_steps[:3]).rstrip("。；; ")
            if steps:
                answer_parts.append(f"操作提示：{steps}。")
        if resource.access_notes and resource.access_notes != "公开可访问":
            answer_parts.append(f"访问说明：{resource.access_notes.rstrip('。')}。")

        logger.info("Trusted snapshot fast path resource_id=%s", resource.id)
        return NavigationAnswer(
            answer="".join(answer_parts),
            resources=(resource,),
        )

    def _answer_from_primary_database_resource(
        self,
        question: str,
        primary_resource: Resource,
        snapshot_answer: str,
        retrieval_limit: int,
        conversation: tuple[str, ...],
        *,
        snapshot_is_exact: bool = False,
    ) -> NavigationAnswer:
        snapshot_fallback = (
            self._database_exact_answer(primary_resource, snapshot_answer)
            if snapshot_is_exact and snapshot_answer
            else None
        )
        if self.page_reader is not None:
            try:
                snapshot = self.page_reader.read(primary_resource.url)
            except Exception:
                logger.exception(
                    "Direct database page read failed for resource_id=%s",
                    primary_resource.id,
                )
            else:
                try:
                    response = self.llm_client.generate(
                        LLMRequest(
                            system_prompt=RESOURCE_NAVIGATION_SYSTEM_PROMPT,
                            user_question=self._build_fetched_page_verification_question(
                                question,
                                primary_resource,
                                snapshot,
                                conversation,
                            ),
                            web_access="none",
                            max_output_tokens=1600,
                        )
                    )
                except Exception:
                    logger.exception(
                        "Fetched database page verification failed for resource_id=%s",
                        primary_resource.id,
                    )
                else:
                    verdict = self._database_verdict(response.text)
                    verified_primary = self._database_primary_resource(
                        [primary_resource],
                        response.text,
                    )
                    verified_answer = self._remove_database_control_markers(response.text)
                    logger.info(
                        "Fetched page verification verdict=%s resource_id=%s",
                        verdict or "missing",
                        primary_resource.id,
                    )
                    if (
                        verdict == "exact"
                        and verified_primary is not None
                        and verified_answer
                    ):
                        return self._database_exact_answer(
                            primary_resource,
                            verified_answer,
                            page_verified=True,
                            allowed_urls=(snapshot.final_url,),
                        )
                    return self._answer_from_trusted_web(
                        question,
                        retrieval_limit,
                        conversation,
                        database_candidates_found=True,
                        fallback=snapshot_fallback,
                    )

        if not self.llm_client.supports_web_search:
            return snapshot_fallback or NavigationAnswer(
                answer=_NO_TRUSTED_RESULT,
                resources=(),
            )

        try:
            response = self.llm_client.generate(
                LLMRequest(
                    system_prompt=RESOURCE_NAVIGATION_SYSTEM_PROMPT,
                    user_question=self._build_primary_verification_question(
                        question,
                        primary_resource,
                        conversation,
                    ),
                    web_access="open_known_urls",
                    max_output_tokens=1600,
                )
            )
        except Exception:
            logger.exception("Primary database page verification failed; trying trusted web search")
        else:
            verdict = self._database_verdict(response.text)
            verified_primary = self._database_primary_resource(
                [primary_resource],
                response.text,
            )
            verified_answer = self._remove_database_control_markers(response.text)
            visited_primary = self._visited_database_resources(
                [primary_resource],
                response.citations,
            )
            logger.info(
                "Primary page verification verdict=%s resource_id=%s visited=%s",
                verdict or "missing",
                primary_resource.id,
                bool(visited_primary),
            )
            if (
                verdict == "exact"
                and verified_primary is not None
                and verified_answer
                and visited_primary
            ):
                return self._database_exact_answer(
                    primary_resource,
                    verified_answer,
                    response.citations,
                )

        return self._answer_from_trusted_web(
            question,
            retrieval_limit,
            conversation,
            database_candidates_found=True,
            fallback=snapshot_fallback,
        )

    def _database_exact_answer(
        self,
        primary_resource: Resource,
        answer: str,
        citations: tuple[LLMCitation, ...] = (),
        *,
        page_verified: bool = False,
        allowed_urls: tuple[str, ...] = (),
    ) -> NavigationAnswer:
        answer = self._remove_unknown_urls(
            answer,
            (primary_resource.url, *allowed_urls),
        )
        if citations:
            page_verified = page_verified or bool(self._visited_database_resources(
                [primary_resource],
                citations,
            ))
        if not page_verified:
            answer = (
                "网页实时访问未能确认，以下内容仅依据项目数据库快照：\n"
                f"{answer}"
            )
        return NavigationAnswer(
            answer=answer,
            resources=(primary_resource,),
            clarifications=self._extract_clarifications(answer),
        )

    def _answer_from_trusted_web(
        self,
        question: str,
        retrieval_limit: int,
        conversation: tuple[str, ...],
        *,
        database_candidates_found: bool,
        fallback: NavigationAnswer | None = None,
    ) -> NavigationAnswer:
        if not self.llm_client.supports_web_search:
            return fallback or NavigationAnswer(answer=_NO_TRUSTED_RESULT, resources=())

        try:
            response = self.llm_client.generate(
                LLMRequest(
                    system_prompt=RESOURCE_NAVIGATION_SYSTEM_PROMPT,
                    user_question=self._build_web_search_question(
                        question,
                        conversation,
                        database_candidates_found=database_candidates_found,
                    ),
                    web_access="search_web",
                    max_output_tokens=2000,
                )
            )
        except Exception:
            if fallback is None:
                raise
            logger.exception("Web search failed; returning high-relevance database candidates")
            return fallback
        web_resources = self._trusted_web_resources(
            response.citations,
            retrieval_limit,
        )
        if not web_resources:
            return fallback or NavigationAnswer(answer=_NO_TRUSTED_RESULT, resources=())
        web_verdict = self._web_verdict(response.text)
        answer = self._remove_web_control_markers(response.text)
        if web_verdict is None and self._is_substantive_web_answer(answer):
            # Tool citations are the trust boundary. A missing formatting marker
            # should not discard an otherwise supported answer.
            web_verdict = "related"
        logger.info(
            "Trusted web verdict=%s trusted_resource_count=%d",
            web_verdict or "missing",
            len(web_resources),
        )
        if web_verdict not in {"exact", "related"}:
            return fallback or NavigationAnswer(answer=_NO_TRUSTED_RESULT, resources=())
        selected_resources = web_resources
        if web_verdict == "exact":
            primary_resource = self._web_primary_resource(web_resources, response.text)
            if primary_resource is None:
                if len(web_resources) == 1 and self._is_substantive_web_answer(answer):
                    primary_resource = web_resources[0]
                elif self._is_substantive_web_answer(answer):
                    # Keep a cited answer when the provider omitted or altered
                    # the primary URL marker, without claiming unique certainty.
                    web_verdict = "related"
                else:
                    return fallback or NavigationAnswer(answer=_NO_TRUSTED_RESULT, resources=())
            if primary_resource is not None:
                selected_resources = (primary_resource,)
        allowed_urls = tuple(resource.url for resource in selected_resources)
        answer = self._remove_unknown_urls(answer, allowed_urls)
        if not answer or _NO_TRUSTED_RESULT in answer:
            return fallback or NavigationAnswer(answer=_NO_TRUSTED_RESULT, resources=())
        return NavigationAnswer(
            answer=answer,
            resources=selected_resources,
            clarifications=self._extract_clarifications(answer),
        )

    @staticmethod
    def _database_verdict(answer: str) -> str | None:
        match = _DATABASE_VERDICT_PATTERN.search(answer)
        return match.group(1).lower() if match else None

    @staticmethod
    def _remove_database_control_markers(answer: str) -> str:
        without_verdict = _DATABASE_VERDICT_PATTERN.sub("", answer)
        without_primary = _DATABASE_PRIMARY_ID_PATTERN.sub("", without_verdict)
        return _DATABASE_RELATED_IDS_PATTERN.sub("", without_primary).strip()

    @staticmethod
    def _database_primary_resource(
        resources: list[Resource],
        answer: str,
    ) -> Resource | None:
        match = _DATABASE_PRIMARY_ID_PATTERN.search(answer)
        if not match:
            return None
        primary_id = match.group(1).strip()
        return next((resource for resource in resources if resource.id == primary_id), None)

    @staticmethod
    def _database_related_resources(
        resources: list[Resource],
        answer: str,
        limit: int,
    ) -> tuple[Resource, ...]:
        match = _DATABASE_RELATED_IDS_PATTERN.search(answer)
        if not match:
            return ()
        requested_ids = tuple(
            dict.fromkeys(
                resource_id.strip()
                for resource_id in match.group(1).split(",")
                if resource_id.strip()
            )
        )
        resources_by_id = {resource.id: resource for resource in resources}
        return tuple(
            resources_by_id[resource_id]
            for resource_id in requested_ids
            if resource_id in resources_by_id
        )[:limit]

    @staticmethod
    def _web_verdict(answer: str) -> str | None:
        match = _WEB_VERDICT_PATTERN.search(answer)
        return match.group(1).lower() if match else None

    @staticmethod
    def _remove_web_control_markers(answer: str) -> str:
        without_verdict = _WEB_VERDICT_PATTERN.sub("", answer)
        return _WEB_PRIMARY_URL_PATTERN.sub("", without_verdict).strip()

    def _web_primary_resource(
        self,
        resources: tuple[Resource, ...],
        answer: str,
    ) -> Resource | None:
        match = _WEB_PRIMARY_URL_PATTERN.search(answer)
        candidate_urls = [match.group(1).strip()] if match else []
        candidate_urls.extend(_URL_PATTERN.findall(
            self._remove_web_control_markers(answer)
        ))
        for candidate_url in candidate_urls:
            primary_url = self._normalize_url(candidate_url)
            primary_resource = next(
                (
                    resource
                    for resource in resources
                    if self._same_web_page(resource.url, primary_url)
                ),
                None,
            )
            if primary_resource is not None:
                return primary_resource
        return None

    @staticmethod
    def _same_web_page(first_url: str, second_url: str) -> bool:
        first = urlparse(ResourceNavigationService._normalize_url(first_url))
        second = urlparse(ResourceNavigationService._normalize_url(second_url))
        if first.geturl() == second.geturl():
            return True
        return (
            first.netloc == second.netloc
            and first.path == second.path
            and first.path not in {"", "/"}
            and (not first.query or not second.query)
        )

    @staticmethod
    def _is_substantive_web_answer(answer: str) -> bool:
        if any(term in answer for term in _WEAK_WEB_ANSWER_TERMS):
            return False
        answer_without_urls = _URL_PATTERN.sub("", answer)
        return len(_normalize_match_phrase(answer_without_urls)) >= 16

    def _visited_database_resources(
        self,
        resources: list[Resource],
        citations: tuple[LLMCitation, ...],
    ) -> tuple[Resource, ...]:
        visited_urls = {
            self._normalize_url(citation.url)
            for citation in citations
        }
        return tuple(
            resource
            for resource in resources
            if self._normalize_url(resource.url) in visited_urls
        )

    @staticmethod
    def _build_retrieval_query(question: str, conversation: tuple[str, ...]) -> str:
        previous_user_messages = tuple(
            message.removeprefix("用户：")
            for message in conversation
            if message.startswith("用户：")
        )[-3:]
        return " ".join((*previous_user_messages, question)).strip()

    @staticmethod
    def _build_database_verification_question(
        question: str,
        resources: list[Resource],
        conversation: tuple[str, ...],
    ) -> str:
        history = "\n".join(conversation[-6:]) or "无"
        resource_blocks = []
        for index, resource in enumerate(resources, start=1):
            block_lines = [
                f"[数据库资源 {index}]",
                f"资源 ID：{resource.id}",
                f"标题：{resource.title}",
                f"URL：{resource.url}",
                f"栏目：{resource.category}",
                f"来源：{resource.source}",
                f"权威标签：{resource.authority_label or '数据未提供'}",
                f"数据处置：{resource.disposition or '数据未提供'}",
                f"链接状态：{resource.url_status or '数据未提供'}",
                f"访问说明：{resource.url_err or resource.access_notes or '数据未提供'}",
                f"时效状态：{resource.info_status or resource.freshness or '数据未提供'}",
                f"发布时间：{resource.published_at or '数据未提供'}",
                f"摘要：{(resource.summary or '数据未提供')[:400]}",
                f"内容要点：{'；'.join(resource.answerable_facts[:4])[:600] or '数据未提供'}",
                f"获取方式：{(resource.how_to or '数据未提供')[:300]}",
                f"费用：{resource.cost or '数据未提供'}",
                f"标签：{'、'.join(resource.tags) or '数据未提供'}",
                f"正文摘录：{(resource.content or '数据未提供')[:600]}",
                "检索命中原文片段："
                f"{_database_evidence_excerpt(question, resource) or '数据未提供'}",
            ]
            if resource.snapshot_version:
                block_lines.extend((
                    f"快照推荐优先级：{resource.recommend_priority or '数据未提供'}",
                    f"快照可信度：{resource.snapshot_confidence or '数据未提供'}",
                    f"是否要求实时核验：{'是' if resource.requires_live_check else '否'}",
                    f"典型匹配场景：{'；'.join(resource.recommend_when[:4]) or '数据未提供'}",
                    f"不应推荐场景：{'；'.join(resource.do_not_recommend_when[:4]) or '数据未提供'}",
                    f"正向检索别名：{'、'.join(resource.query_aliases[:8]) or '数据未提供'}",
                    f"负向消歧别名：{'、'.join(resource.negative_aliases[:6]) or '数据未提供'}",
                    f"快照可回答事实：{'；'.join(resource.answerable_facts[:4])[:600] or '数据未提供'}",
                ))
            resource_blocks.append("\n".join(block_lines))

        database_context = "\n\n".join(resource_blocks)
        exact_urls = "\n".join(f"- {resource.url}" for resource in resources)
        return (
            f"[检索阶段] 数据库候选内容核实\n\n最近对话：\n{history}\n\n当前问题：\n{question}\n\n"
            "以下内容只是数据库检索召回的候选资源，不代表数据库已经命中答案。"
            "主题、栏目、标题或关键词相关，都不能单独证明资源正文包含答案。\n\n"
            f"{database_context}\n\n"
            "[需要核实的数据库资源地址]\n"
            f"{exact_urls}\n\n"
            "本阶段只根据数据库快照进行快速筛选，不调用网页工具。数据库材料已经直接回答问题时可以形成快照"
            "答案；否则请找出最可能直接回答问题、值得进入下一步网页核验的唯一主资源，或列出少量高度相关资源；"
            "不要为了凑数量而采用其他候选。对于询问服务入口、预约、办理位置等导航问题，候选标题与功能和用户"
            "目标高度一致时，可以选为唯一待核验资源，即使正文快照为空。仅仅主题相近、属于同一栏目或业务部门，"
            "仍不能选为唯一资源。"
            "用户明确写出的校区、地点、机构和服务对象必须全部一致；不得把同一校区内名称相近的另一种设施当成"
            "目标，例如‘中区研修室’不能作为‘中区图书馆’的命中。"
            "涉及事实、步骤、数值等内容时，必须在摘要、内容要点、正文摘录或检索命中原文片段中存在相应信息，"
            "不能依靠常识或模型记忆补全。对于姓名、编号、术语等细节查询，原文逐字出现该对象可以证明‘该材料"
            "提及该对象’，即使对象没有出现在标题中；但不得据此推断其现任身份、当前状态或材料未明确写出的属性。"
            "通知末尾的统一反馈电话、邮箱不得归属于正文中的某个人，除非材料明确逐项标注；脱敏占位符也不得还原。\n\n"
            "输出必须严格遵守以下格式之一：\n"
            "1. 数据库材料本身已直接、明确回答问题：第一行输出 [[DATABASE_VERDICT:EXACT]]，第二行输出 "
            "[[DATABASE_PRIMARY_ID:资源ID]]，随后给出简洁答案。历史通知必须说明发布时间和证据范围，不得把历史"
            "记录表述成当前事实。资源 ID 必须逐字复制自候选列表。\n"
            "2. 材料尚不足以回答，但存在唯一值得打开网页核验的主资源：第一行输出 [[DATABASE_VERDICT:VERIFY]]，第二行输出 "
            "[[DATABASE_PRIMARY_ID:资源ID]]，不要输出回答正文。资源 ID 必须逐字复制自候选列表。\n"
            "3. 没有唯一答案，但存在高度相关资源：第一行输出 [[DATABASE_VERDICT:RELATED]]，第二行输出 "
            "[[DATABASE_RELATED_IDS:资源ID1,资源ID2]]。只列真正有助于用户目标的 ID，按相关度排序，最多 5 个；"
            "不要输出回答正文。\n"
            "4. 没有高度相关资源：只输出 [[DATABASE_VERDICT:INSUFFICIENT]]，不要猜测答案或推荐候选。"
        )

    @staticmethod
    def _build_primary_verification_question(
        question: str,
        resource: Resource,
        conversation: tuple[str, ...],
    ) -> str:
        history = "\n".join(conversation[-6:]) or "无"
        return (
            f"[检索阶段] 唯一数据库资源网页核实\n\n最近对话：\n{history}\n\n当前问题：\n{question}\n\n"
            f"资源 ID：{resource.id}\n标题：{resource.title}\nURL：{resource.url}\n"
            f"链接状态：{resource.url_status or '数据未提供'}\n"
            f"访问说明：{resource.url_err or resource.access_notes or '数据未提供'}\n"
            f"发布时间：{resource.published_at or '数据未提供'}\n"
            f"数据库摘要：{resource.summary or '数据未提供'}\n"
            f"数据库内容要点：{'；'.join(resource.answerable_facts[:6]) or '数据未提供'}\n"
            f"数据库正文摘录：{(resource.content or '数据未提供')[:2000]}\n"
            "数据库检索命中原文片段："
            f"{_database_evidence_excerpt(question, resource, max_chars=2000) or '数据未提供'}\n\n"
            "只允许打开上面的确切 URL 并跟随该 URL 自身的重定向，不得搜索或采用其他来源。请核对打开后的页面"
            "是否直接包含回答问题所需的信息。对于资源导航、预约或办理入口问题，如果最终页面本身就是用户所需"
            "服务、登录页或功能入口，页面标题、功能和最终地址足以明确这一点，即可判定为包含答案，不要求另有说明"
            "性正文。但问题中的校区、地点、机构和服务对象必须与页面逐项一致，不得用相近设施替代；存在任何对象"
            "冲突都应判定为不足。若核验通过，第一行输出 [[DATABASE_VERDICT:EXACT]]，第二行输出 "
            f"[[DATABASE_PRIMARY_ID:{resource.id}]]，随后简洁概括页面并回答。若页面内容不足，只输出 "
            "[[DATABASE_VERDICT:INSUFFICIENT]]。"
        )

    @staticmethod
    def _build_fetched_page_verification_question(
        question: str,
        resource: Resource,
        snapshot: PageSnapshot,
        conversation: tuple[str, ...],
    ) -> str:
        history = "\n".join(conversation[-6:]) or "无"
        return (
            f"[检索阶段] 后端实时页面内容核实\n\n最近对话：\n{history}\n\n当前问题：\n{question}\n\n"
            f"资源 ID：{resource.id}\n数据库标题：{resource.title}\n"
            f"数据库 URL：{resource.url}\n实际访问后的 URL：{snapshot.final_url}\n"
            f"实时页面标题：{snapshot.title or '页面未提供'}\n\n"
            f"[实时页面正文]\n{snapshot.text[:8000]}\n\n"
            "上方内容由后端刚刚访问数据库 URL 并跟随其重定向后提取。不得调用网页工具或采用其他来源。"
            "请判断该实时页面是否直接回答当前问题。对于资源导航、预约或办理入口问题，如果页面本身就是"
            "对应服务或功能入口，并且问题中的校区、地点、机构和服务对象与页面逐项一致，才可判定为包含答案。"
            "名称相近、同处一个校区或功能相关不足以证明对象相同；例如‘中区研修室’不是‘中区图书馆’。"
            "核验通过时，第一行输出 "
            "[[DATABASE_VERDICT:EXACT]]，第二行输出 "
            f"[[DATABASE_PRIMARY_ID:{resource.id}]]，随后简洁总结页面并回答；否则只输出 "
            "[[DATABASE_VERDICT:INSUFFICIENT]]。"
        )

    @staticmethod
    def _build_web_search_question(
        question: str,
        conversation: tuple[str, ...],
        *,
        database_candidates_found: bool,
    ) -> str:
        history = "\n".join(conversation[-6:]) or "无"
        database_status = (
            "数据库召回了主题相关候选，但核实后候选内容不足以回答当前问题。"
            if database_candidates_found
            else "数据库没有召回达到阈值的候选资源。"
        )
        return (
            f"[检索阶段] 可信网络检索\n\n最近对话：\n{history}\n\n当前问题：\n{question}\n\n"
            f"[数据库核实结果] {database_status}\n\n"
            "必须使用网页搜索工具寻找能够直接支持答案的可信第一方来源。优先检索中国科学技术大学及其"
            "职能部门官方页面；必要时再使用政府、高校或相关权威机构页面。请实际打开采用的页面并核对正文，"
            "不能把搜索结果摘要、标题相似或业务相关当作答案证据。不得把用户明确指定的对象改写成相近设施；"
            "如果用户问题的前提不成立，应使用官方名录或页面直接纠正，而不是推荐另一个对象。官方完整名录中"
            "没有列出目标时，可以谨慎表述为‘官方当前列表未列出该对象’。输出应遵守以下格式之一：\n"
            "1. 单一页面足以支持唯一确定答案：第一行输出 [[WEB_VERDICT:EXACT]]，第二行输出 "
            "[[WEB_PRIMARY_URL:完整URL]]，随后简洁回答并只列这一项来源。\n"
            "2. 没有唯一答案但存在多个高度相关来源：第一行输出 [[WEB_VERDICT:RELATED]]，随后给出简洁导航，"
            "最多列出 5 个实际采用的来源标题和完整 URL。\n"
            "3. 没有正文直接支持结论的可信来源：只输出 [[WEB_VERDICT:INSUFFICIENT]]。"
        )

    def _trusted_web_resources(
        self,
        citations: tuple[LLMCitation, ...],
        limit: int,
    ) -> tuple[Resource, ...]:
        resources: list[Resource] = []
        seen: set[str] = set()
        for citation in citations:
            normalized_url = self._normalize_url(citation.url)
            parsed = urlparse(normalized_url)
            host = (parsed.hostname or "").lower().rstrip(".")
            if parsed.scheme not in {"http", "https"} or not self._is_trusted_host(host):
                continue
            if normalized_url in seen:
                continue
            seen.add(normalized_url)
            authority_label = self._web_authority_label(host)
            resources.append(Resource(
                id=f"web-{md5(normalized_url.encode('utf-8')).hexdigest()[:16]}",
                title=citation.title or host,
                url=normalized_url,
                source=host,
                category="可信网络来源",
                summary="来自联网检索并通过域名可信度校验的页面。",
                kind="web",
                source_site=host,
                authority_label=authority_label,
                search_text=f"{citation.title} {host}",
            ))
            if len(resources) >= limit:
                break
        return tuple(resources)

    def _is_trusted_host(self, host: str) -> bool:
        return bool(host) and any(
            host == domain or host.endswith(f".{domain}")
            for domain in self.trusted_web_domains
        )

    @staticmethod
    def _web_authority_label(host: str) -> str:
        if host == "ustc.edu.cn" or host.endswith(".ustc.edu.cn"):
            return "中国科大官方网页"
        if host == "gov.cn" or host.endswith(".gov.cn"):
            return "政府官方网页"
        if host == "edu.cn" or host.endswith(".edu.cn"):
            return "高校官方网页"
        return "配置允许的可信网页"

    def _remove_unknown_urls(
        self,
        answer: str,
        allowed_urls: tuple[str, ...] = (),
    ) -> str:
        normalized_allowed = {
            self._normalize_url(url)
            for url in allowed_urls
        }
        return _URL_PATTERN.sub(
            lambda match: match.group(0)
            if (
                self.knowledge_base.is_known_url(match.group(0))
                or self._normalize_url(match.group(0)) in normalized_allowed
            )
            else "（未收录链接已移除）",
            answer,
        )

    @staticmethod
    def _normalize_url(url: str) -> str:
        value = url.strip().rstrip("）】》」』，。；、")
        parsed = urlparse(value)
        scheme = "https" if parsed.scheme.lower() in {"http", "https"} else parsed.scheme.lower()
        return parsed._replace(
            scheme=scheme,
            netloc=parsed.netloc.lower(),
            path=parsed.path.rstrip("/"),
            fragment="",
        ).geturl()

    @staticmethod
    def _extract_clarifications(answer: str) -> tuple[str, ...]:
        return tuple(
            dict.fromkeys(
                option.strip()
                for option in _CLARIFICATION_PATTERN.findall(answer)
                if option.strip()
            )
        )[:4]


def _is_trusted_snapshot_match(question: str, resource: Resource) -> bool:
    if (
        not resource.snapshot_version
        or resource.snapshot_enrichment != "llm_intent_v1"
        or resource.recommend_priority.lower() != "high"
        or resource.snapshot_confidence.lower() != "high"
        or resource.requires_live_check
        or resource.url_status.lower() != "reachable"
        or resource.content_kind not in {"入口", "流程", "权益"}
        or not resource.answerable_facts
    ):
        return False

    normalized_question = _normalize_match_phrase(question)
    if not normalized_question:
        return False
    if any(
        _negative_phrase_matches(normalized_question, alias)
        for alias in resource.negative_aliases
    ):
        return False
    return any(
        _strong_phrase_matches(normalized_question, phrase)
        for phrase in (resource.title, *resource.query_aliases)
    )


def _strong_phrase_matches(normalized_question: str, phrase: str) -> bool:
    normalized_phrase = _normalize_match_phrase(phrase)
    return (
        min(len(normalized_question), len(normalized_phrase)) >= 4
        and (
            normalized_question in normalized_phrase
            or normalized_phrase in normalized_question
        )
    )


def _negative_phrase_matches(normalized_question: str, phrase: str) -> bool:
    normalized_phrase = _normalize_match_phrase(phrase)
    if not normalized_phrase:
        return False
    if normalized_question == normalized_phrase:
        return True
    return (
        min(len(normalized_question), len(normalized_phrase)) >= 4
        and (
            normalized_question in normalized_phrase
            or normalized_phrase in normalized_question
        )
    )


def _normalize_match_phrase(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def _database_evidence_excerpt(
    question: str,
    resource: Resource,
    *,
    max_chars: int = 1200,
) -> str:
    """Return a query-centered excerpt from fields retained for retrieval."""
    evidence_parts = tuple(dict.fromkeys(
        value.strip()
        for value in (resource.content, resource.search_text)
        if value.strip()
    ))
    evidence = "\n".join(evidence_parts)
    if not evidence or len(evidence) <= max_chars:
        return evidence

    normalized_evidence_chars: list[str] = []
    original_positions: list[int] = []
    for index, character in enumerate(evidence.lower()):
        if character.isalnum():
            normalized_evidence_chars.append(character)
            original_positions.append(index)
    normalized_evidence = "".join(normalized_evidence_chars)
    normalized_question = _normalize_match_phrase(question)

    match_index = normalized_evidence.find(normalized_question)
    if match_index < 0:
        max_fragment_length = min(len(normalized_question), 12)
        for length in range(max_fragment_length, 1, -1):
            for start in range(0, len(normalized_question) - length + 1):
                fragment = normalized_question[start:start + length]
                match_index = normalized_evidence.find(fragment)
                if match_index >= 0:
                    break
            if match_index >= 0:
                break

    center = original_positions[match_index] if match_index >= 0 else 0
    start = max(center - max_chars // 3, 0)
    end = min(start + max_chars, len(evidence))
    if end - start < max_chars:
        start = max(end - max_chars, 0)
    prefix = "..." if start else ""
    suffix = "..." if end < len(evidence) else ""
    return f"{prefix}{evidence[start:end]}{suffix}"


def build_navigation_service() -> ResourceNavigationService:
    llm_config = load_llm_config()
    knowledge_base_config = load_knowledge_base_config()
    return ResourceNavigationService(
        llm_client=build_llm_client(llm_config),
        knowledge_base=build_knowledge_base(knowledge_base_config),
        retrieval_limit=knowledge_base_config.top_k,
        retrieval_minimum_score=knowledge_base_config.minimum_score,
        trusted_web_domains=llm_config.trusted_web_domains,
        page_reader=HttpPageReader(
            timeout_seconds=min(max(llm_config.timeout_seconds, 1), 20),
        ),
    )
