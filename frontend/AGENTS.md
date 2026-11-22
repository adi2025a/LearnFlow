# frontend/AGENTS.md

React + TypeScript + Vite frontend. Read the root `AGENTS.md` and `docs/SPEC.md` first.

## Why this stack

The backend is a separate FastAPI service, so a plain Vite single-page app is enough. Next.js would add a second server
we do not need. Keep it simple.

## Setup

```bash
npm create vite@latest . -- --template react-ts    # only once, if the app does not exist
npm install react-router-dom @tanstack/react-query react-markdown remark-gfm rehype-highlight
npm install -D tailwindcss @tailwindcss/vite
```

Vite dev server proxies `/api` to `http://localhost:8000` (configure in `vite.config.ts`) so there are no CORS issues in dev.

## Structure

```
frontend/src/
  main.tsx
  App.tsx                  # router + layout
  api/
    client.ts              # fetch wrapper, typed
    chat.ts                # SSE streaming helper
    types.ts               # types mirroring backend schemas
  components/
    Sidebar/               # roadmap tree: chapters > topics, status dots
    Chat/                  # message list, input box, streaming message
    Message.tsx            # markdown rendering, copy + pin buttons
    SearchBox.tsx
    NewRoadmapDialog.tsx   # goal input -> generate
  pages/
    RoadmapsPage.tsx
    TopicPage.tsx          # chat for the selected topic
  hooks/                   # useRoadmap, useMessages, useStreamChat
```

## UI requirements

- Two-pane layout: collapsible roadmap tree on the left, topic chat on the right.
- The selected topic is in the URL (`/topics/:id`) so refresh and back/forward work.
- Chat renders Markdown with GitHub-flavored tables and syntax-highlighted code blocks. Code blocks have a copy button.
- Streaming: show tokens as they arrive; auto-scroll only if the user is already at the bottom; provide a Stop button.
- Each message has Pin and Copy. Pinned messages can be filtered with a "Pinned only" toggle per topic.
- Topic status (not started / learning / solid) is one click to change, shown as a colored dot in the sidebar.
- Search box (Ctrl/Cmd+K) searches all messages and jumps to the topic.
- Dark and light mode following the system setting.
- Responsive: sidebar becomes a drawer on small screens.
- Loading, empty and error states for every screen. No blank screens.

## Rules

- TypeScript strict mode. No `any`; define types in `api/types.ts` to match the backend schemas.
- Server state goes through TanStack Query. Local UI state uses `useState`. No global state library.
- Streaming uses `fetch` with a `ReadableStream` reader (not `EventSource`, since the chat request is a POST). Parse SSE lines `data: {...}`.
- Optimistic UI for pin and status changes; roll back on error.
- Never put the OpenAI key or any secret in the frontend. It only talks to `/api/*`.
- Keep components small and focused. Style with Tailwind utility classes; no extra UI libraries without asking.
- Accessibility basics: semantic HTML, labels on inputs and icon buttons, visible focus states, keyboard navigable tree.

## Before finishing a task

```bash
npm run lint && npm run build
```

Both must pass. Manually check the screen in the browser for the feature you changed.
