# Resource Catalog Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unusable resources from every published catalog, preserve conditionally accessible resources with labels, and replace stale hard-coded resource counts with generated metadata.

**Architecture:** The latest audited JSON remains the recoverable input. `scripts/apply_resource_weights.py` becomes the single deterministic publication pipeline: normalize, classify, exclude, enrich, project, and emit lightweight statistics. Frontend and backend consume the same cleaned authoritative output.

**Tech Stack:** Python 3 standard library, JSON, React 19, TypeScript, Vitest, Python unittest.

**Repository constraint:** Do not commit, merge, push, or create a PR before the user's evening review.

---

### Task 1: Import and characterize the latest audited catalog

**Files:**
- Replace from remote data branch: `data without log in/原始数据_整合.json`
- Replace from remote data branch: `data without log in/原始数据_整合_search_text.json`
- Test: `scripts/tests/test_apply_resource_weights.py`

- [ ] **Step 1: Restore the two audited JSON files from `origin/数据补充与更新`**

Run:

```powershell
git restore --source="origin/数据补充与更新" -- "data without log in/原始数据_整合.json" "data without log in/原始数据_整合_search_text.json"
```

- [ ] **Step 2: Add a failing audit-envelope test**

Assert that the source contains 12,882 rows, all rows have `url_status`, `url_http`, and `url_err`, and status counts match the imported audit. This test protects the input contract rather than the final publication count.

- [ ] **Step 3: Run the script tests and observe the expected projection failure**

Run: `python -m unittest scripts.tests.test_apply_resource_weights -v`  
Expected: FAIL because the current pipeline neither filters audit failures nor projects audit fields.

### Task 2: Implement deterministic publication decisions

**Files:**
- Modify: `scripts/apply_resource_weights.py`
- Test: `scripts/tests/test_apply_resource_weights.py`

- [ ] **Step 1: Add failing policy tests**

Cover these exact decisions:

```python
self.assertEqual(publication_exclusion_reason({"title": "x", "url": "https://x", "url_status": "dead"}), "dead")
self.assertEqual(publication_exclusion_reason({"title": "x", "url": "https://x", "url_status": "unknown"}), "unknown")
self.assertIsNone(publication_exclusion_reason({"title": "x", "url": "https://x", "url_status": "blocked"}))
self.assertEqual(publication_exclusion_reason({"title": "x", "url": "https://i.ustc.edu.cn/appDetail/452", "url_status": "reachable"}), "wrong_redirect")
self.assertEqual(publication_exclusion_reason({"title": "", "url": "https://x", "url_status": "reachable"}), "missing_title")
```

Add local-file cases using a temporary repository root: existing relative files pass, missing relative files return `missing_local_file`, and `mailto:` passes.

- [ ] **Step 2: Run the policy tests and verify failure**

Run: `python -m unittest scripts.tests.test_apply_resource_weights.FrontendProjectionTests -v`  
Expected: FAIL because `publication_exclusion_reason` does not exist.

- [ ] **Step 3: Implement the minimal policy**

Add focused functions:

```python
def publication_exclusion_reason(article: dict[str, Any], repo_root: Path = REPO_ROOT) -> str | None:
    title = str(article.get("title") or "").strip()
    url = str(article.get("url") or "").strip()
    if not title:
        return "missing_title"
    if not url:
        return "missing_url"
    if article.get("url_status") in {"dead", "unknown"}:
        return str(article["url_status"])
    if "i.ustc.edu.cn/appDetail/" in url:
        return "wrong_redirect"
    if article.get("url_status") == "local":
        relative = url.split("?", 1)[0].removeprefix("./")
        if not (repo_root / "data without log in" / relative).is_file():
            return "missing_local_file"
    return None
```

Keep a `Counter` of exclusion reasons and filter before weight/search enrichment.

- [ ] **Step 4: Run the policy tests**

Expected: PASS for dead, unknown, blocked, CAS, mailto, local, empty title, and `appDetail` cases.

### Task 3: Generate cleaned outputs and lightweight counts

**Files:**
- Modify: `scripts/apply_resource_weights.py`
- Create: `frontend/src/data/raw/catalogMetadata.json`
- Modify: `frontend/src/data/catalogMetadata.ts`
- Modify: `frontend/src/data/raw/resources.json`
- Modify: `data without log in/原始数据_整合.json`
- Modify: `data without log in/原始数据_整合_search_text.json`
- Test: `scripts/tests/test_apply_resource_weights.py`
- Test: `frontend/src/data/localCatalog.test.ts`

- [ ] **Step 1: Add failing metadata and consistency tests**

The generated metadata must have:

```json
{
  "total": 0,
  "counts": {
    "services": 0,
    "learning": 0,
    "research": 0,
    "competition": 0,
    "community": 0,
    "life": 0,
    "wellbeing": 0,
    "future": 0,
    "other": 0
  },
  "generatedAt": "ISO-8601"
}
```

Tests must assert `total == sum(counts.values())`, every published ID is unique, and every source category maps to a first-level category.

- [ ] **Step 2: Add category aggregation to the generator**

Use the same category groups already established in frontend/backend. Fail generation for unmapped categories rather than silently adding them to `other`.

- [ ] **Step 3: Preserve access audit fields in the frontend projection**

Add `url_status`, `url_http`, `url_err`, and `url_checked_at` to `FRONTEND_FIELDS`. Ensure full `search_text` and bulky organizer metadata remain excluded from the browser snapshot.

- [ ] **Step 4: Generate the files**

Run: `python scripts/apply_resource_weights.py`  
Expected: output includes retained count plus a non-empty exclusion breakdown.

- [ ] **Step 5: Replace hard-coded metadata consumption**

`catalogMetadata.ts` imports the generated JSON and exports the existing `resourceCounts` and `totalResourceCount` names with typed category keys. `HeroExplorer` and `CategoryTree` therefore update without loading the full resource chunk.

- [ ] **Step 6: Run data and frontend catalog tests**

Run:

```powershell
python -m unittest scripts.tests.test_apply_resource_weights -v
pnpm test:run -- --reporter=dot src/data/resourceAdapter.test.ts src/data/localCatalog.test.ts
```

Expected: all tests pass and no assertion contains the old 1,295 total.

### Task 4: Carry access state through frontend and backend

**Files:**
- Modify: `frontend/src/domain/resource.ts`
- Modify: `frontend/src/data/resourceAdapter.ts`
- Modify: `frontend/src/components/resources/ResourceMetadata.tsx`
- Modify: `frontend/src/components/resources/ResourceCard.tsx`
- Modify: `frontend/src/components/assistant/ResourceRecommendation.tsx`
- Modify: `PART_B/knowledge_base.py`
- Test: `frontend/src/data/resourceAdapter.test.ts`
- Test: `frontend/src/components/resources/ResourceCard.test.tsx`
- Test: `PART_B/tests/test_backend.py`

- [ ] **Step 1: Add failing access-label tests**

Assert that blocked/CAS rows adapt to `accessStatus="login_required"`, mailto adapts to `accessStatus="email"`, local rows adapt to `accessStatus="local"`, and reachable rows adapt to `accessStatus="direct"`.

- [ ] **Step 2: Extend the internal resource type without changing search request shape**

Add optional audit properties plus a derived union:

```ts
type ResourceAccessStatus = 'direct' | 'login_required' | 'local' | 'email'
```

- [ ] **Step 3: Render restrained access notes**

Cards and AI recommendations show “可能需要登录/校内网络”, “本地文档”, or “发送邮件” when applicable. Direct resources do not get an extra badge.

- [ ] **Step 4: Preserve audit data through backend serialization**

Add optional fields to `Resource`, load them in `_resource_from_row`, and include them in `to_dict` so remote and local frontend modes behave the same.

- [ ] **Step 5: Run focused tests**

Expected: access-state tests pass; search result ordering remains unchanged for retained records.

### Task 5: Verify the cleaned catalog

**Files:**
- Verify only; no new implementation files expected.

- [ ] **Step 1: Run complete data and backend tests**

```powershell
python -m unittest discover -s scripts/tests -v
python -m unittest discover -s PART_B/tests -v
```

- [ ] **Step 2: Run frontend test, lint, and build**

```powershell
pnpm test:run -- --reporter=dot
pnpm lint
pnpm build
```

- [ ] **Step 3: Perform final consistency checks**

Confirm both authoritative JSON files and the frontend snapshot have identical ordered IDs, no excluded status remains, category totals equal the actual catalog, and no audit/report code performs a new full network scan.

