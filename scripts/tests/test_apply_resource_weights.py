import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.apply_resource_weights import (
    build_catalog_metadata,
    enrich_article,
    frontend_projection,
    merge_publication_summary,
    publication_exclusion_reason,
    validate_articles,
)


class PublicationPolicyTests(unittest.TestCase):
    def test_rerun_preserves_original_exclusion_summary(self) -> None:
        payload = {
            "source_total": 12882,
            "excluded_by_reason": {"dead": 392, "unknown": 8, "missing_local_file": 24, "wrong_redirect": 3, "missing_title": 1},
        }

        source_total, exclusions = merge_publication_summary(payload, 12454, {})

        self.assertEqual(source_total, 12882)
        self.assertEqual(sum(exclusions.values()), 428)
        self.assertEqual(exclusions["dead"], 392)

    def test_enrichment_is_idempotent_when_tags_are_derived(self) -> None:
        ranking = {
            "categoryPriors": {"校园资讯": 1.2},
            "keyServices": {"教务系统": {"bonus": 0, "aliases": ["选课", "成绩"]}},
            "synonyms": {"选课": ["教务"]},
        }
        article = {
            "title": "教务系统",
            "url": "https://example.test/jwxt",
            "category": "校园资讯",
            "tags": [],
            "kind": "crawl",
        }

        first = enrich_article(article, ranking)
        second = enrich_article(first, ranking)

        self.assertEqual(first, second)

    def test_removes_confirmed_failures_and_known_wrong_redirects(self) -> None:
        self.assertEqual(publication_exclusion_reason({"title": "资源", "url": "https://example.test/dead", "url_status": "dead"}), "dead")
        self.assertEqual(publication_exclusion_reason({"title": "资源", "url": "https://example.test/unknown", "url_status": "unknown"}), "unknown")
        self.assertEqual(publication_exclusion_reason({"title": "资源", "url": "https://i.ustc.edu.cn/appDetail/452", "url_status": "reachable"}), "wrong_redirect")
        self.assertEqual(publication_exclusion_reason({"title": "", "url": "https://example.test/blank", "url_status": "reachable"}), "missing_title")

    def test_keeps_login_email_and_existing_local_resources(self) -> None:
        self.assertIsNone(publication_exclusion_reason({"title": "登录入口", "url": "https://id.ustc.edu.cn/", "url_status": "blocked"}))
        self.assertIsNone(publication_exclusion_reason({"title": "咨询邮箱", "url": "mailto:help@example.test", "url_status": "unchecked"}))

        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            document = root / "data without log in" / "offline data documents" / "guide.pdf"
            document.parent.mkdir(parents=True)
            document.write_bytes(b"pdf")
            article = {
                "title": "离线指南",
                "url": "./offline data documents/guide.pdf?part=one",
                "url_status": "local",
            }
            self.assertIsNone(publication_exclusion_reason(article, root))
            document.unlink()
            self.assertEqual(publication_exclusion_reason(article, root), "missing_local_file")


class FrontendProjectionTests(unittest.TestCase):
    def test_rejects_non_object_rows_and_duplicate_or_blank_ids(self) -> None:
        with self.assertRaisesRegex(ValueError, "object"):
            validate_articles([{"id": "one"}, "bad-row"])
        with self.assertRaisesRegex(ValueError, "non-empty id"):
            validate_articles([{"id": ""}])
        with self.assertRaisesRegex(ValueError, "Duplicate resource id"):
            validate_articles([{"id": "one"}, {"id": "one"}])

    def test_keeps_ui_search_and_access_fields_without_bulky_metadata(self) -> None:
        payload = {
            "total": 1,
            "generated_at": "now",
            "articles": [{
                "id": "one",
                "title": "资源",
                "url": "https://example.edu/",
                "category": "生活服务",
                "content": "详情",
                "how_to": "步骤",
                "weight": 4.2,
                "search_text": "资源 详情 步骤",
                "search_aliases": ["resource-service"],
                "content_info": {"digest": "重复内容"},
                "url_status": "blocked",
                "url_http": "200",
                "url_err": "登录墙：需校园统一身份认证",
                "url_checked_at": "2026-08-31",
            }],
        }

        projected = frontend_projection(payload)

        self.assertEqual(projected["total"], 1)
        self.assertEqual(projected["articles"][0]["id"], "one")
        self.assertEqual(projected["articles"][0]["content"], "详情")
        self.assertEqual(projected["articles"][0]["weight"], 4.2)
        self.assertEqual(projected["articles"][0]["search_aliases"], ["resource-service"])
        self.assertNotIn("search_text", projected["articles"][0])
        self.assertNotIn("content_info", projected["articles"][0])
        self.assertEqual(projected["articles"][0]["url_status"], "blocked")
        self.assertEqual(projected["articles"][0]["url_http"], "200")
        self.assertEqual(projected["articles"][0]["url_err"], "登录墙：需校园统一身份认证")
        self.assertEqual(projected["articles"][0]["url_checked_at"], "2026-08-31")

    def test_builds_lightweight_counts_from_published_categories(self) -> None:
        metadata = build_catalog_metadata([
            {"category": "办事指南"},
            {"category": "校园资讯"},
            {"category": "生活服务"},
        ], generated_at="2026-09-01T00:00:00+00:00")

        self.assertEqual(metadata["total"], 3)
        self.assertEqual(metadata["counts"]["services"], 1)
        self.assertEqual(metadata["counts"]["community"], 1)
        self.assertEqual(metadata["counts"]["life"], 1)
        self.assertEqual(sum(metadata["counts"].values()), 3)
        self.assertEqual(metadata["generatedAt"], "2026-09-01T00:00:00+00:00")

    def test_rejects_unmapped_source_categories(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unmapped resource category"):
            build_catalog_metadata([{"category": "未来栏目"}], generated_at="now")


if __name__ == "__main__":
    unittest.main()
