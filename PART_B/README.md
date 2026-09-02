# PART_B Resource Navigation Backend

This backend follows the repository-level `数据接口规范.md` contract and uses
`../data without log in/原始数据_整合.json` as its authoritative resource data.

## Install And Run

```powershell
cd PART_B
pip install -r requirements.txt
python -m uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

API documentation: `http://127.0.0.1:8000/docs`

The command-line interface remains available with `python main.py`.

## API Contract

```text
POST /api/search
GET  /api/resources
GET  /api/resources/{id}
GET  /api/categories
POST /api/sessions/{session_id}/exit
GET  /api/health
```

The assistant request required by the shared specification is:

```json
{
  "query": "秋季要不要抢图书馆座位？",
  "top_k": 5,
  "category": null,
  "session_id": null
}
```

The response contains database records only:

```json
{
  "results": [],
  "answer": "基于数据库资源的简要回答",
  "session_id": "generated-session-id",
  "clarifications": []
}
```

`GET /api/resources` accepts `q`, `category`, `group`, `tag`, `page`, and
`page_size`, matching the current frontend resource browser.

## Knowledge Base

`JsonKnowledgeBase` loads 12454 audited, publishable records once when the application
starts. Dead, unknown, missing-local-file, wrong-redirect, and blank-title records are
excluded by the catalog generation step; login-restricted but valid records remain. The adapter uses the
stored `id` and `search_text` fields and keeps deterministic fallbacks for future
imports that omit them:

- `id`: first 16 characters of the URL MD5 hash.
- `search_text`: title, category, tags, summary, content, source, and access method.

Search uses the same weighted fuzzy matcher as the static frontend: campus
synonyms, pinyin aliases, edit-distance typos, field weights, and the
`weight` / `relevance_score` stored on each record. It supports both the 32
source categories and the frontend's grouped categories.
Every clickable result comes from this dataset. Unknown URLs emitted by a model
are removed from the answer.

To replace the JSON file with a vector database, implement the `KnowledgeBase`
interface and register its provider in `build_knowledge_base()`; the API,
frontend, and LLM service do not need to change.

## Frontend Development

The local frontend uses `frontend/.env.development.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCKS=false
```

Start it in another terminal with:

```powershell
cd frontend
corepack pnpm@9.15.5 dev
```
