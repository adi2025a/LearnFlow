# SPEC.md — LearnFlow v1

Source of truth for the data model, API contract and build order. Update this file whenever behavior or API changes.

## 1. Data model (PostgreSQL)

All ids are UUIDs. All tables have `created_at` (timestamptz, default now()).

```
roadmaps
  id, title, goal (text), level (text, nullable), updated_at

chapters
  id, roadmap_id -> roadmaps (on delete cascade), title, position (int)

topics
  id, chapter_id -> chapters (on delete cascade), title, position (int),
  status ('not_started' | 'learning' | 'solid', default 'not_started'),
  summary (text, nullable)          -- rolling summary of older messages, optional

messages
  id, topic_id -> topics (on delete cascade),
  role ('user' | 'assistant'), content (text),
  pinned (bool, default false),
  search_vector (tsvector, generated from content, GIN index)
```

Indexes: `messages(topic_id, created_at)`, GIN on `messages.search_vector`, `chapters(roadmap_id, position)`, `topics(chapter_id, position)`.

Single-user in v1: no users table, no auth.

## 2. API contract

Base path `/api`. JSON unless stated. Errors: `{"detail": "..."}`.

### Roadmaps
| Method | Path | Purpose |
|---|---|---|
| GET | `/roadmaps` | List roadmaps |
| POST | `/roadmaps` | Create empty roadmap `{title, goal, level?}` |
| POST | `/roadmaps/generate` | `{goal, level?, duration?}` -> one OpenAI call -> creates roadmap + chapters + topics, returns full tree |
| GET | `/roadmaps/{id}` | Full tree: chapters (ordered) with topics (ordered) |
| PATCH | `/roadmaps/{id}` | Edit title/goal/level |
| DELETE | `/roadmaps/{id}` | Delete (cascades) |

### Chapters and topics
| Method | Path | Purpose |
|---|---|---|
| POST | `/roadmaps/{id}/chapters` | Add chapter |
| PATCH | `/chapters/{id}` | Rename, change position |
| DELETE | `/chapters/{id}` | Delete (cascades) |
| POST | `/chapters/{id}/topics` | Add topic |
| PATCH | `/topics/{id}` | Rename, change position, change status |
| DELETE | `/topics/{id}` | Delete (cascades) |

### Chat
| Method | Path | Purpose |
|---|---|---|
| GET | `/topics/{id}/messages` | All messages, oldest first. Optional `?pinned=true` |
| POST | `/topics/{id}/chat` | Body `{content}`. Streams SSE (below) |
| PATCH | `/messages/{id}` | `{pinned: bool}` |

SSE events from `POST /topics/{id}/chat` (`Content-Type: text/event-stream`):

```
data: {"delta": "partial text"}          (many)
data: {"done": true, "message_id": "..."}   (last)
data: {"error": "message"}               (only on failure)
```

### Search
| Method | Path | Purpose |
|---|---|---|
| GET | `/search?q=...` | Full-text search over messages. Returns `[{message_id, snippet, topic_id, topic_title, chapter_title, roadmap_title}]`, max 50 |

### Study Tools (Learning Accelerator)
| Method | Path | Purpose |
|---|---|---|
| POST | `/topics/{id}/quiz` | Generates 3-4 structured MCQ questions with 4 options, correct answer ID, and explanations |
| POST | `/topics/{id}/evaluate-explanation` | Body `{explanation}`. Evaluates learner's explanation (Feynman rating, strengths, gaps, advice) |
| POST | `/copilot/chat` | Body `{messages}`. Zero-context technical copilot scratchpad chat. Streams SSE tokens |
| GET/POST | `/topics/{id}/videos` | Relatable YouTube videos and lecture recommendations for the topic |



## 3. Prompt assembly for a topic chat

Order of messages sent to OpenAI:

1. `system`: contents of `prompts/tutor.md`
2. `system`: orientation — `Roadmap: {title}. Chapter: {title}. Topic: {title}.`
3. `system`: `Summary of earlier discussion: {topic.summary}` (only if present)
4. Last `CONTEXT_MESSAGES` messages from this topic (default 20), oldest first, including the new user message

The database keeps every message. Only the prompt is trimmed.

### Tutor prompt (put in `prompts/tutor.md`, user can edit)

```
You are a patient tutor helping one learner study the current topic.
- Explain in simple, plain language first (an analogy or everyday example), then give the precise technical version.
- Keep answers focused on the current topic. If the learner asks something that belongs to another topic, answer briefly and say so.
- Check understanding: occasionally ask the learner to explain something back or answer a small question.
- Use Markdown. Use code blocks for code. Be concise; do not pad.
- If you are unsure, say so instead of guessing.
```

### Roadmap generation (`prompts/roadmap.md`)

Ask for structured output matching this schema:

```
{ "title": str,
  "chapters": [ { "title": str, "topics": [ { "title": str } ] } ] }
```

Guidelines for the prompt: order chapters from prerequisites to advanced, 4-10 chapters, 3-8 topics each, topic titles specific and learnable in one sitting, fit the learner's stated level and time.

## 4. Config (`.env.example`)

```
DATABASE_URL=postgresql+asyncpg://learnflow:learnflow@localhost:5432/learnflow
OPENAI_API_KEY=
OPENAI_MODEL=
CONTEXT_MESSAGES=20
```

`docker-compose.yml`: one `db` service, `postgres:16`, user/password/db all `learnflow`, port 5432, named volume for data.

## 5. Milestones

Each milestone must be runnable and verified before moving on.

**M1 — Foundations**
docker compose + Postgres, backend skeleton, config, Alembic with all four tables, `/health` endpoint, frontend skeleton with proxy.
Done when: `uv run fastapi dev` and `npm run dev` both start, and `/api/health` returns ok through the frontend proxy.

**M2 — Roadmap CRUD + sidebar**
All roadmap/chapter/topic endpoints (except generate). Sidebar tree in the UI with add, rename, delete, reorder, status dot.
Done when: you can build a roadmap by hand in the UI and it persists after refresh.

**M3 — Topic chat (the core)**
Streaming chat endpoint, prompt assembly, message list, markdown rendering, stop button.
Done when: each topic has its own separate chat, history survives refresh, and a long chat still works (only last N sent to the model).

**M4 — Roadmap generation**
`/roadmaps/generate` with structured outputs and the "New roadmap" dialog.
Done when: typing a goal produces an editable roadmap tree in a few seconds.

**M5 — Pin, search, polish**
Pin messages and "Pinned only" filter, full-text search with Ctrl/Cmd+K, copy buttons, dark mode, responsive drawer, loading/empty/error states.
Done when: you can find any past answer from any topic within seconds.

**M6 — Long-topic summaries (optional)**
When a topic exceeds a message threshold, summarize older messages into `topics.summary` with one extra OpenAI call, and include it in the prompt.

## 6. Later (not in v1)

Quizzes and spaced review, separate notes view generated from pinned messages, embeddings and semantic search, auth and multi-user, multi-agent features.
The four-table model is designed so these can be added without rewriting it.
