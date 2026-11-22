import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Chapter, Topic
from app.schemas import (
    CopilotChatRequest,
    ExplanationEvaluateRequest,
    ExplanationEvaluateResponse,
    QuizResponse,
    TopicVideosResponse,
    YouTubeSearchResponse,
)
from app.services import study_tools, youtube

router = APIRouter(tags=["study"])


@router.post("/topics/{topic_id}/quiz", response_model=QuizResponse)
async def get_topic_quiz(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Topic)
        .options(selectinload(Topic.chapter).selectinload(Chapter.roadmap))
        .where(Topic.id == topic_id)
    )
    result = await db.execute(stmt)
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )

    chapter = topic.chapter
    roadmap = chapter.roadmap

    return await study_tools.generate_topic_quiz(
        topic_title=topic.title,
        chapter_title=chapter.title,
        roadmap_title=roadmap.title,
        summary=topic.summary,
    )


@router.post(
    "/topics/{topic_id}/evaluate-explanation",
    response_model=ExplanationEvaluateResponse,
)
async def evaluate_topic_explanation(
    topic_id: UUID,
    payload: ExplanationEvaluateRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Topic)
        .options(selectinload(Topic.chapter).selectinload(Chapter.roadmap))
        .where(Topic.id == topic_id)
    )
    result = await db.execute(stmt)
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )

    chapter = topic.chapter
    roadmap = chapter.roadmap

    return await study_tools.evaluate_user_explanation(
        topic_title=topic.title,
        chapter_title=chapter.title,
        roadmap_title=roadmap.title,
        explanation=payload.explanation,
    )


@router.get("/topics/{topic_id}/videos", response_model=TopicVideosResponse)
@router.post("/topics/{topic_id}/videos", response_model=TopicVideosResponse)
async def get_topic_videos_route(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Topic)
        .options(selectinload(Topic.chapter).selectinload(Chapter.roadmap))
        .where(Topic.id == topic_id)
    )
    result = await db.execute(stmt)
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )

    chapter = topic.chapter
    roadmap = chapter.roadmap

    return await study_tools.get_topic_videos(
        topic_title=topic.title,
        chapter_title=chapter.title,
        roadmap_title=roadmap.title,
    )


@router.get("/youtube/search", response_model=YouTubeSearchResponse)
async def search_youtube_videos(
    query: str = Query(..., min_length=1),
):
    results = await youtube.search_youtube(query)
    return YouTubeSearchResponse(query=query, results=results)


@router.post("/copilot/chat")
async def copilot_chat(
    payload: CopilotChatRequest,
):
    async def event_generator():
        try:
            stream = study_tools.stream_copilot_chat(payload.messages)
            async for chunk in stream:
                event = {"delta": chunk}
                yield f"data: {json.dumps(event)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:  # noqa: BLE001
            err_event = {"error": str(exc) or "Copilot response failed"}
            yield f"data: {json.dumps(err_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
