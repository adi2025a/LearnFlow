import json
import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_quiz_generation(client: AsyncClient):
    # Create roadmap, chapter, topic
    res = await client.post(
        "/api/roadmaps",
        json={"title": "Study Tools Roadmap", "goal": "Testing study features"},
    )
    assert res.status_code == 201
    roadmap_id = res.json()["id"]

    res = await client.post(
        f"/api/roadmaps/{roadmap_id}/chapters",
        json={"title": "Chapter 1"},
    )
    assert res.status_code == 201
    chapter_id = res.json()["id"]

    res = await client.post(
        f"/api/chapters/{chapter_id}/topics",
        json={"title": "Memory Layout"},
    )
    assert res.status_code == 201
    topic_id = res.json()["id"]

    # Call quiz endpoint
    res = await client.post(f"/api/topics/{topic_id}/quiz")
    assert res.status_code == 200
    quiz = res.json()
    assert quiz["topic_title"] == "Memory Layout"
    assert len(quiz["questions"]) >= 1
    q1 = quiz["questions"][0]
    assert q1["correct_option_id"] == "A"
    assert len(q1["options"]) == 4

    # Nonexistent topic
    fake_id = uuid.uuid4()
    res = await client.post(f"/api/topics/{fake_id}/quiz")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_explanation_evaluation(client: AsyncClient):
    # Create roadmap, chapter, topic
    res = await client.post(
        "/api/roadmaps",
        json={"title": "Study Tools Roadmap", "goal": "Testing study features"},
    )
    assert res.status_code == 201
    roadmap_id = res.json()["id"]

    res = await client.post(
        f"/api/roadmaps/{roadmap_id}/chapters",
        json={"title": "Chapter 1"},
    )
    assert res.status_code == 201
    chapter_id = res.json()["id"]

    res = await client.post(
        f"/api/chapters/{chapter_id}/topics",
        json={"title": "Pointers & References"},
    )
    assert res.status_code == 201
    topic_id = res.json()["id"]

    # Valid evaluation request
    res = await client.post(
        f"/api/topics/{topic_id}/evaluate-explanation",
        json={
            "explanation": "A pointer stores a memory address directly, while a reference is an alias."
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["rating"] == "solid"
    assert "strengths" in data
    assert "suggestion" in data

    # Too short explanation (validation failure)
    res = await client.post(
        f"/api/topics/{topic_id}/evaluate-explanation",
        json={"explanation": "short"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_copilot_chat_stream(client: AsyncClient):
    res = await client.post(
        "/api/copilot/chat",
        json={"messages": [{"role": "user", "content": "How do I run pytest in uv?"}]},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]

    lines = res.text.strip().split("\n\n")
    deltas = []
    has_done = False
    for line in lines:
        if line.startswith("data: "):
            payload = json.loads(line[6:])
            if "delta" in payload:
                deltas.append(payload["delta"])
            if payload.get("done"):
                has_done = True

    assert has_done is True
    full_text = "".join(deltas)
    assert "Copilot" in full_text


@pytest.mark.asyncio
async def test_topic_videos(client: AsyncClient):
    # Create roadmap, chapter, topic
    res = await client.post(
        "/api/roadmaps",
        json={"title": "Study Tools Roadmap", "goal": "Testing video feature"},
    )
    assert res.status_code == 201
    roadmap_id = res.json()["id"]

    res = await client.post(
        f"/api/roadmaps/{roadmap_id}/chapters",
        json={"title": "Chapter 1"},
    )
    assert res.status_code == 201
    chapter_id = res.json()["id"]

    res = await client.post(
        f"/api/chapters/{chapter_id}/topics",
        json={"title": "GPU Thread Scheduling"},
    )
    assert res.status_code == 201
    topic_id = res.json()["id"]

    # Test GET /api/topics/{topic_id}/videos
    res = await client.get(f"/api/topics/{topic_id}/videos")
    assert res.status_code == 200
    data = res.json()
    assert data["topic_title"] == "GPU Thread Scheduling"
    assert len(data["videos"]) >= 1
    assert data["videos"][0]["channel_or_creator"] == "freeCodeCamp"
    assert len(data["recommended_search_queries"]) >= 1


@pytest.mark.asyncio
async def test_youtube_direct_search(client: AsyncClient):
    res = await client.get("/api/youtube/search?query=System+Design")
    assert res.status_code == 200
    data = res.json()
    assert data["query"] == "System Design"
    assert len(data["results"]) >= 1
    first = data["results"][0]
    assert first["id"] == "TnoW2ZrzUWI"
    assert "System Design" in first["title"]
    assert first["channel"] == "Cloud X Berry"


@pytest.mark.asyncio
async def test_activity_stats(client: AsyncClient):
    # Fetch initial activity stats
    res = await client.get("/api/activity?days=30")
    assert res.status_code == 200
    data = res.json()
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "total_active_days" in data
    assert "total_messages" in data
    assert "total_topics_solid" in data
    assert len(data["history"]) == 30
    assert data["history"][-1]["date"] is not None
