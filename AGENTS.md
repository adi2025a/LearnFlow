# AGENTS.md — LearnFlow

Read this first. Subfolders have their own `AGENTS.md` with stack-specific rules.
Full spec (data model, API, milestones): `docs/SPEC.md`.

## What this project is

A personal learning app. The user creates a **roadmap**, which has **chapters**, which have **topics**.
Each topic has its **own chat** with an AI tutor. Chats are saved forever in Postgres and **the chats are the notes**
(there is no separate notes feature). This fixes the problem of learning inside one giant chat.

## Scope (v1) — do not go beyond this

In scope:
- Roadmap / chapter / topic CRUD, with a generate-roadmap-from-goal action (one OpenAI call).
- Per-topic streaming chat with a tutor.
- Pin/star messages, topic status, full-text search across all messages.
- Clean, fast UI.

Out of scope until the user asks: multi-agent systems, agent frameworks (LangChain, LangGraph, CrewAI, etc.),
vector search / embeddings, quizzes, spaced repetition, separate notes editor, auth / multi-user, payments.
Design so these can be added later, but do not build them.

## Stack

- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 (async) + asyncpg, Alembic, Pydantic v2, official `openai` SDK. Package manager: **uv**.
- Database: PostgreSQL 16 (via docker compose for local dev).
- Frontend: React + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router.
- One OpenAI API key, used **only on the backend**. Never expose it to the browser.

## Repo layout

```
learnflow/
  AGENTS.md              <- you are here
  CLAUDE.md              <- points to this file
  docker-compose.yml     <- Postgres for local dev
  .env.example
  backend/               <- FastAPI app (see backend/AGENTS.md)
  frontend/              <- React app (see frontend/AGENTS.md)
  docs/SPEC.md           <- data model, API contract, milestones
```

## Commands

```bash
docker compose up -d db                      # start Postgres
cd backend && uv sync                        # install backend deps
cd backend && uv run alembic upgrade head    # apply migrations
cd backend && uv run fastapi dev app/main.py # API on :8000
cd backend && uv run pytest                  # backend tests
cd backend && uv run ruff check . && uv run ruff format .
cd frontend && npm install && npm run dev    # UI on :5173 (proxies /api to :8000)
cd frontend && npm run build && npm run lint
```

## Working rules

1. Work milestone by milestone from `docs/SPEC.md`. Finish and verify one before starting the next.
2. Before saying a task is done, run the relevant tests/lint/build and confirm they pass. Say what you ran.
3. Keep changes small and focused. One concern per commit, with a clear message.
4. Ask before adding a new dependency, and prefer the standard library or an existing dependency.
5. Never commit secrets. Config comes from environment variables (`.env`, documented in `.env.example`).
6. Never hardcode the OpenAI model name; read it from `OPENAI_MODEL` in settings.
7. The API contract in `docs/SPEC.md` is the source of truth. If you must change it, update the spec in the same change.
8. If a requirement is unclear, ask the user rather than guessing. Do not invent features.
9. Prefer simple, readable code over clever abstractions. This is a learning project; the user wants to understand it.

## Definition of done

- Code runs locally end to end for the milestone.
- Tests pass and lint is clean.
- No secrets, no leftover debug code.
- `docs/SPEC.md` updated if behavior or API changed.
