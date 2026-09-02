import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from config import LLMConfig
from llm_client import LLMRequest, OpenAICompatibleLLMClient, _extract_citations


class FakeResponse:
    output_text = "依据官方页面回答：https://www.ustc.edu.cn/notice"

    def model_dump(self) -> dict[str, object]:
        return {
            "output": [
                {
                    "type": "web_search_call",
                    "action": {
                        "type": "open_page",
                        "url": "https://www.ustc.edu.cn/notice",
                    },
                },
                {
                    "type": "message",
                    "content": [{
                        "type": "output_text",
                        "annotations": [{
                            "type": "url_citation",
                            "title": "中国科大官方通知",
                            "url": "https://www.ustc.edu.cn/notice",
                        }],
                    }],
                },
            ],
        }


class FakeResponses:
    def __init__(self) -> None:
        self.last_request: dict[str, object] | None = None

    def create(self, **kwargs: object) -> FakeResponse:
        self.last_request = kwargs
        return FakeResponse()


class FakeOpenAI:
    instance: "FakeOpenAI | None" = None

    def __init__(self, **_: object) -> None:
        self.responses = FakeResponses()
        FakeOpenAI.instance = self


class OpenAICompatibleLLMClientTests(unittest.TestCase):
    def test_plain_model_text_url_is_not_treated_as_a_tool_citation(self) -> None:
        citations = _extract_citations(
            {"output": []},
            "模型自行写出 https://www.ustc.edu.cn/not-verified",
        )

        self.assertEqual(citations, ())

    def test_web_mode_uses_responses_api_and_extracts_citations(self) -> None:
        config = LLMConfig(
            provider="openai",
            api_key="test-key",
            model="deepseek-v4-pro",
            base_url="https://api.deepseek.com",
            timeout_seconds=30,
            web_search_enabled=True,
        )
        client = OpenAICompatibleLLMClient(config)

        with patch.dict(sys.modules, {"openai": SimpleNamespace(OpenAI=FakeOpenAI)}):
            response = client.generate(LLMRequest(
                system_prompt="只使用可信来源",
                user_question="打开官方通知",
                web_access="open_known_urls",
                max_output_tokens=256,
            ))

        self.assertIsNotNone(FakeOpenAI.instance)
        request = FakeOpenAI.instance.responses.last_request
        self.assertEqual(request["tools"], [{"type": "web_search"}])
        self.assertEqual(request["tool_choice"], "required")
        self.assertEqual(request["max_output_tokens"], 256)
        self.assertEqual(response.citations[0].title, "中国科大官方通知")
        self.assertEqual(response.citations[0].url, "https://www.ustc.edu.cn/notice")


if __name__ == "__main__":
    unittest.main()
