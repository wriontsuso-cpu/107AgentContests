# PART_B Resource Navigation Backend

This folder contains a reusable LLM client, a replaceable knowledge-base
interface, a command-line client, and an HTTP API for a future web frontend.

## Install

```powershell
cd PART_B
pip install -r requirements.txt
```

Copy `.env.example` to `.env`, then configure the LLM values. Keep
`KNOWLEDGE_BASE_PROVIDER=placeholder` until the real database adapter is ready.

## Command Line

```powershell
python main.py
```

The process keeps accepting questions until the user enters `exit`, `quit`,
`q`, or `退出`.

## Web API

Start the development server from `PART_B`:

```powershell
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

The frontend flow is:

1. Create a session when the page opens.

```http
POST /api/v1/sessions
```

```json
{"session_id":"generated-id","status":"active"}
```

2. Submit each user question and render both `answer` and `resources`.

```http
POST /api/v1/sessions/{session_id}/questions
Content-Type: application/json
```

```json
{"question":"How can I learn RAG?"}
```

```json
{
  "session_id": "generated-id",
  "answer": "A concise navigation answer",
  "resources": [
    {
      "id": "resource-id",
      "title": "Resource title",
      "url": "https://example.com",
      "summary": "Short description",
      "source": "knowledge_base",
      "metadata": {}
    }
  ]
}
```

3. Connect the exit button to the session exit endpoint.

```http
POST /api/v1/sessions/{session_id}/exit
```

Questions submitted to a closed session return HTTP `409`. Sessions are stored
in memory for now and are cleared whenever the backend restarts.

## Connect the Knowledge Base

`knowledge_base.py` defines the stable database contract:

```python
class KnowledgeBase(ABC):
    def search(self, query: str, limit: int) -> list[Resource]:
        ...
```

To connect the real database:

1. Add a class implementing `KnowledgeBase.search()`.
2. Convert database rows or search hits into `Resource` objects.
3. Register the new provider in `build_knowledge_base()`.
4. Set `KNOWLEDGE_BASE_PROVIDER` and its connection values in `.env`.

Neither the CLI, web API, nor LLM integration needs to change when the adapter
is replaced.

## Extension Points

- `llm_client.py`: add model providers with a different API protocol.
- `knowledge_base.py`: connect SQL, vector, or HTTP retrieval backends.
- `navigation_service.py`: add query refinement, reranking, and skills.
- `session_store.py`: replace local sessions with Redis or persistent storage.
- `api.py`: add authentication, streaming answers, and user feedback routes.
