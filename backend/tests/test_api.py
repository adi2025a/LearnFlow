import json

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_roadmap_crud(client: AsyncClient):
    # 1. Create roadmap
    res = await client.post(
        "/api/roadmaps",
        json={"title": "Python Mastery", "goal": "Learn Python", "level": "Beginner"},
    )
    assert res.status_code == 201
    roadmap = res.json()
    assert roadmap["title"] == "Python Mastery"
    roadmap_id = roadmap["id"]

    # 2. List roadmaps
    res = await client.get("/api/roadmaps")
    assert res.status_code == 200
    items = res.json()
    assert any(item["id"] == roadmap_id for item in items)

    # 3. Get roadmap tree
    res = await client.get(f"/api/roadmaps/{roadmap_id}")
    assert res.status_code == 200
    tree = res.json()
    assert tree["id"] == roadmap_id
    assert tree["chapters"] == []

    # 4. Update roadmap
    res = await client.patch(
        f"/api/roadmaps/{roadmap_id}",
        json={"title": "Python 3.12 Mastery"},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Python 3.12 Mastery"

    # 5. Add Chapter
    res = await client.post(
        f"/api/roadmaps/{roadmap_id}/chapters",
        json={"title": "Getting Started"},
    )
    assert res.status_code == 201
    chapter = res.json()
    assert chapter["title"] == "Getting Started"
    chapter_id = chapter["id"]

    # 6. Add Topic
    res = await client.post(
        f"/api/chapters/{chapter_id}/topics",
        json={"title": "Variables & Types"},
    )
    assert res.status_code == 201
    topic = res.json()
    assert topic["title"] == "Variables & Types"
    assert topic["status"] == "not_started"
    topic_id = topic["id"]

    # 7. Update Topic
    res = await client.patch(
        f"/api/topics/{topic_id}",
        json={"status": "learning"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "learning"

    # 8. Check Tree with Chapter & Topic
    res = await client.get(f"/api/roadmaps/{roadmap_id}")
    assert res.status_code == 200
    full_tree = res.json()
    assert len(full_tree["chapters"]) == 1
    assert full_tree["chapters"][0]["title"] == "Getting Started"
    assert len(full_tree["chapters"][0]["topics"]) == 1
    assert full_tree["chapters"][0]["topics"][0]["title"] == "Variables & Types"

    # 9. Delete Chapter & Roadmap
    res = await client.delete(f"/api/chapters/{chapter_id}")
    assert res.status_code == 204

    res = await client.delete(f"/api/roadmaps/{roadmap_id}")
    assert res.status_code == 204

    # 10. Verify 404
    res = await client.get(f"/api/roadmaps/{roadmap_id}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_roadmap_generate(client: AsyncClient):
    res = await client.post(
        "/api/roadmaps/generate",
        json={"goal": "Docker & Kubernetes", "level": "Intermediate"},
    )
    assert res.status_code == 201
    tree = res.json()
    assert "Docker & Kubernetes" in tree["title"]
    assert len(tree["chapters"]) == 2
    assert tree["chapters"][0]["title"] == "Basics"
    assert len(tree["chapters"][0]["topics"]) == 2


@pytest.mark.asyncio
async def test_chat_and_pin(client: AsyncClient):
    # Setup roadmap, chapter, topic
    res = await client.post(
        "/api/roadmaps",
        json={"title": "Chat Test Roadmap", "goal": "Testing chat"},
    )
    roadmap_id = res.json()["id"]

    res = await client.post(
        f"/api/roadmaps/{roadmap_id}/chapters",
        json={"title": "Chat Chapter"},
    )
    chapter_id = res.json()["id"]

    res = await client.post(
        f"/api/chapters/{chapter_id}/topics",
        json={"title": "Chat Topic"},
    )
    topic_id = res.json()["id"]

    # Post message to chat (SSE)
    res = await client.post(
        f"/api/topics/{topic_id}/chat",
        json={"content": "What is Python?"},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]

    body = res.text
    assert "data:" in body
    lines = [
        line.strip() for line in body.split("\n") if line.strip().startswith("data:")
    ]
    parsed_events = [json.loads(line[5:].strip()) for line in lines]
    assert any("delta" in ev for ev in parsed_events)
    done_ev = next(ev for ev in parsed_events if ev.get("done") is True)
    assert done_ev is not None
    assistant_msg_id = done_ev["message_id"]

    # Verify messages saved
    res = await client.get(f"/api/topics/{topic_id}/messages")
    assert res.status_code == 200
    messages = res.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "What is Python?"
    assert messages[1]["role"] == "assistant"
    assert "Hello from AI tutor!" in messages[1]["content"]

    # Pin message
    res = await client.patch(
        f"/api/messages/{assistant_msg_id}",
        json={"pinned": True},
    )
    assert res.status_code == 200
    assert res.json()["pinned"] is True

    # Filter pinned
    res = await client.get(f"/api/topics/{topic_id}/messages?pinned=true")
    assert res.status_code == 200
    pinned_messages = res.json()
    assert len(pinned_messages) == 1
    assert pinned_messages[0]["id"] == assistant_msg_id


@pytest.mark.asyncio
async def test_search_messages(client: AsyncClient):
    # Setup
    res = await client.post(
        "/api/roadmaps",
        json={"title": "Search Roadmap", "goal": "Testing search"},
    )
    roadmap_id = res.json()["id"]

    res = await client.post(
        f"/api/roadmaps/{roadmap_id}/chapters",
        json={"title": "Search Chapter"},
    )
    chapter_id = res.json()["id"]

    res = await client.post(
        f"/api/chapters/{chapter_id}/topics",
        json={"title": "Search Topic"},
    )
    topic_id = res.json()["id"]

    # Send chat
    await client.post(
        f"/api/topics/{topic_id}/chat",
        json={"content": "Learn quantum computing algorithms in depth"},
    )

    # Perform full-text search
    res = await client.get("/api/search?q=quantum")
    assert res.status_code == 200
    results = res.json()
    assert len(results) >= 1
    assert any("quantum" in r["snippet"].lower() for r in results)
    assert results[0]["topic_title"] == "Search Topic"
    assert results[0]["roadmap_title"] == "Search Roadmap"
