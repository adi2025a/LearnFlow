# backend/AGENTS.md

FastAPI backend. Read the root `AGENTS.md` and `docs/SPEC.md` first.

## Setup

```bash
uv init --app --python 3.12      # only once, if pyproject.toml does not exist
uv add "fastapi[standard]" "sqlalchemy[asyncio]" asyncpg alembic openai pydantic-settings
uv add --dev pytest pytest-asyncio httpx ruff
```

Always use `uv add` / `uv run`. Do not use pip directly and do not edit `pyproject.toml` dependencies by hand.

## Structure

```
backend/
  app/
    main.py            # FastAPI app, CORS, router registration
    config.py          # pydantic-settings: DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL, CONTEXT_MESSAGES
    db.py              # async engine, session dependency
    models.py          # SQLAlchemy models (Roadmap, Chapter, Topic, Message)
    schemas.py         # Pydantic request/response models
    routers/
      roadmaps.py      # roadmap + chapter + topic CRUD, generate
      chat.py          # messages list, streaming chat, pin
      search.py        # full-text search
    services/
      llm.py           # the ONLY place that imports/calls the OpenAI SDK
      context.py       # builds the prompt for a topic chat
      roadmap_gen.py   # goal -> structured roadmap (one OpenAI call)
    prompts/
      tutor.md         # tutor system prompt
      roadmap.md       # roadmap generator prompt
  alembic/             # migrations
  tests/
```

## Rules

- Routers stay thin: validate input, call a service or query the DB, return a schema. No business logic in routers.
- All OpenAI calls go through `services/llm.py`. This keeps the model/provider swappable and easy to mock in tests.
- Use async everywhere (`AsyncSession`, `AsyncOpenAI`). Never block the event loop.
- Schema changes go through Alembic migrations (`uv run alembic revision --autogenerate -m "..."`). Never edit the DB by hand.
- Use Pydantic models for every request and response. Use OpenAI structured outputs for roadmap generation so the result validates against a Pydantic schema.
- Prompts live in `app/prompts/*.md`, not inline in Python strings, so the user can tune them without touching code.
- Config only via `config.py`. No `os.environ` calls scattered around.
- Type hints on all functions. Run `uv run ruff check .` and `uv run ruff format .` before finishing.

## Streaming chat (important)

`POST /api/topics/{topic_id}/chat` returns Server-Sent Events (`text/event-stream`).

1. Save the user message to the DB first.
2. Build the prompt with `services/context.py`:
   - system prompt from `prompts/tutor.md`
   - orientation: roadmap title, chapter title, topic title
   - `topic.summary` if present
   - the last `CONTEXT_MESSAGES` messages (default 20) in order
3. Stream tokens from OpenAI and forward each as an SSE event: `data: {"delta": "..."}`.
4. When finished, save the full assistant message and send a final event `data: {"done": true, "message_id": "..."}`.
5. If the client disconnects mid-stream, still save whatever text was generated so no chat is lost.
6. The generator must use its own DB session (not the request-scoped one), since it outlives the request handler.

The DB stores the full history forever. Only the prompt sent to the model is trimmed.

## Search

Add a generated `tsvector` column on `messages.content` with a GIN index and query with `websearch_to_tsquery`.
Return the matching message, its topic, chapter and roadmap so the UI can link to it.

## Testing

- Use `pytest` + `httpx.AsyncClient` against the app, with a test database.
- Mock `services/llm.py` in tests. Never call the real OpenAI API in tests.
- Minimum coverage per milestone: happy path plus one failure case for each endpoint added.

## Errors

Return clear JSON errors (`{"detail": "..."}`) with correct status codes (404 for missing rows, 422 validation, 502 if OpenAI fails).
Never leak the API key or raw upstream error bodies to the client.
