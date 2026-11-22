import json
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Chapter, Message, Topic
from app.schemas import (
    ActivityStatsResponse,
    CopilotChatRequest,
    DailyActivity,
    ExplanationEvaluateRequest,
    ExplanationEvaluateResponse,
    QuizResponse,
    TopicVideosResponse,
    YouTubeSearchResponse,
)
from app.services import study_tools, youtube

router = APIRouter(tags=["study"])


@router.get("/activity", response_model=ActivityStatsResponse)
async def get_study_activity_stats(
    days: int = Query(default=364, ge=14, le=371),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now(UTC).date()
    start_date = today - timedelta(days=days - 1)

    # 1. Total counts across all time
    total_msg_stmt = select(func.count(Message.id))
    total_messages = (await db.execute(total_msg_stmt)).scalar() or 0

    total_solid_stmt = select(func.count(Topic.id)).where(Topic.status == "solid")
    total_topics_solid = (await db.execute(total_solid_stmt)).scalar() or 0

    # 2. Activity within requested date window
    msg_stmt = (
        select(
            cast(Message.created_at, Date).label("day"),
            func.count(Message.id).label("cnt"),
        )
        .where(cast(Message.created_at, Date) >= start_date)
        .group_by(cast(Message.created_at, Date))
    )
    msg_res = await db.execute(msg_stmt)
    msg_by_day = {row.day: row.cnt for row in msg_res}

    topic_stmt = (
        select(
            cast(Topic.created_at, Date).label("day"),
            func.count(Topic.id).label("cnt"),
        )
        .where(Topic.status == "solid")
        .where(cast(Topic.created_at, Date) >= start_date)
        .group_by(cast(Topic.created_at, Date))
    )
    topic_res = await db.execute(topic_stmt)
    topic_by_day = {row.day: row.cnt for row in topic_res}

    # 3. All active dates across all time for accurate streak calculation
    all_msg_days_stmt = select(cast(Message.created_at, Date)).distinct()
    all_msg_days = (await db.execute(all_msg_days_stmt)).scalars().all()

    all_solid_days_stmt = (
        select(cast(Topic.created_at, Date)).where(Topic.status == "solid").distinct()
    )
    all_solid_days = (await db.execute(all_solid_days_stmt)).scalars().all()

    all_active_days = set(all_msg_days).union(set(all_solid_days))

    # Calculate current streak
    current_streak = 0
    if today in all_active_days:
        check_day = today
        while check_day in all_active_days:
            current_streak += 1
            check_day -= timedelta(days=1)
    else:
        check_day = today - timedelta(days=1)
        while check_day in all_active_days:
            current_streak += 1
            check_day -= timedelta(days=1)

    # Calculate longest streak
    longest_streak = 0
    sorted_days = sorted(all_active_days)
    if sorted_days:
        streak = 1
        max_streak = 1
        for idx in range(1, len(sorted_days)):
            if sorted_days[idx] == sorted_days[idx - 1] + timedelta(days=1):
                streak += 1
            else:
                streak = 1
            max_streak = max(max_streak, streak)
        longest_streak = max(max_streak, current_streak)

    # 4. Build sequential day-by-day history for heatmap grid
    history: list[DailyActivity] = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        m_count = msg_by_day.get(day, 0)
        t_count = topic_by_day.get(day, 0)
        history.append(
            DailyActivity(
                date=day.isoformat(),
                count=m_count + t_count,
                messages_count=m_count,
                topics_completed=t_count,
            )
        )

    return ActivityStatsResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        total_active_days=len(all_active_days),
        total_messages=total_messages,
        total_topics_solid=total_topics_solid,
        history=history,
    )


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
