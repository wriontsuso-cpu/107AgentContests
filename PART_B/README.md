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

The response prefers database records only after their content has been verified
as sufficient for the question. When no candidate is found or candidate content
is insufficient, enabled web fallback may return backend-validated web records:

```json
{
  "results": [],
  "answer": "基于数据库页面或可信网络来源的简要回答",
  "session_id": "generated-session-id",
  "clarifications": []
}
```

`GET /api/resources` accepts `q`, `category`, `group`, `tag`, `page`, and
`page_size`, matching the current frontend resource browser.

## Knowledge Base

`JsonKnowledgeBase` loads the dataset once when the application starts. The
current file declares 12882 rows; rows without the required title or URL are
excluded during normalization. The adapter derives missing fields without
modifying the source data:

- `id`: first 16 characters of the URL MD5 hash.
- `search_text`: title, category, tags, summary, content, source, and access method.

Search uses the same weighted fuzzy matcher as the static frontend: campus
synonyms, pinyin aliases, edit-distance typos, field weights, and the
`weight` / `relevance_score` stored on each record. It supports both the 32
source categories and the frontend's grouped categories.
Every clickable result comes from this dataset. Unknown URLs emitted by a model
are removed from the answer.

`KNOWLEDGE_BASE_MIN_SCORE` is the high-relevance candidate threshold. Its default
is `28`; lower-scoring records are never returned as answer results. `top_k` is a
maximum display count rather than a target count and is capped at 5. The backend
may inspect up to 10 candidates internally so a strong answer just outside the
first five is not lost. It asks the model to inspect candidate content and, when
available, reads the primary candidate URL, follows redirects, and extracts a
bounded live page snapshot. A directly supported answer must name one valid
primary resource ID, and only that resource is returned. Navigation pages can be
confirmed directly only when the requested action and topic both occur in the
live page evidence. Otherwise the backend proceeds to web fallback and may return
at most five model-selected, high-threshold database candidates if no directly
supported web answer is found.
If a sufficient database answer relies only on the stored snapshot because the
page could not be opened, the response says so explicitly.

When the database has no candidate or candidate verification is insufficient,
the backend can make a second request using a Responses API `web_search` tool.
Web citations are accepted only when their host matches
`LLM_TRUSTED_WEB_DOMAINS`; all other model-generated URLs are removed. Trusted
web results use `kind: "web"` and an `authority_label` such as
`中国科大官方网页`. If no trusted citation remains, the backend returns
`当前未检索到合适内容。`

Enable this only for providers that support Responses API web search:

```dotenv
LLM_WEB_SEARCH_ENABLED=true
LLM_TRUSTED_WEB_DOMAINS=ustc.edu.cn,edu.cn,gov.cn
```

Enable this setting only when the configured provider and model expose the
server-side `web_search` tool through a Responses-compatible endpoint. For a
provider without this capability, leave the setting `false`; verified database
answers still work from their stored snapshots, while web fallback remains off.

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
