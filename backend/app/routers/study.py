import json
import re
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Chapter, Message, Roadmap, Topic
from app.schemas import (
    ActivityStatsResponse,
    CopilotChatRequest,
    DailyActivity,
    ExplanationEvaluateRequest,
    ExplanationEvaluateResponse,
    GraphLink,
    GraphNode,
    KnowledgeGraphResponse,
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


STOP_WORDS = {
    "with",
    "from",
    "that",
    "this",
    "into",
    "using",
    "basics",
    "intro",
    "introduction",
    "advanced",
    "guide",
    "overview",
    "learn",
    "first",
    "part",
    "build",
    "building",
    "about",
    "what",
    "when",
    "where",
    "which",
    "your",
    "their",
    "simple",
    "core",
    "fundamental",
    "fundamentals",
    "understanding",
    "mastering",
    "deep",
    "dive",
    "practical",
    "crash",
    "course",
    "concepts",
    "concept",
    "patterns",
    "pattern",
    "modern",
    "essential",
    "essentials",
    "getting",
    "started",
    "step",
    "steps",
    "chapter",
    "topic",
    "notes",
    "learnflow",
}


def _extract_concept_keywords(title: str) -> set[str]:
    words = re.findall(r"[a-zA-Z]{3,}", title.lower())
    return {w for w in words if w not in STOP_WORDS}


@router.get("/knowledge-graph", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(
    db: AsyncSession = Depends(get_db),
):
    # 1. Fetch all roadmaps with chapters and topics
    stmt = (
        select(Roadmap)
        .options(selectinload(Roadmap.chapters).selectinload(Chapter.topics))
        .order_by(Roadmap.created_at.asc())
    )
    result = await db.execute(stmt)
    roadmaps = result.scalars().all()

    # 2. Get message counts per topic
    msg_stmt = (
        select(Message.topic_id, func.count(Message.id).label("cnt"))
        .group_by(Message.topic_id)
    )
    msg_res = await db.execute(msg_stmt)
    msg_counts = {row.topic_id: row.cnt for row in msg_res}

    nodes: list[GraphNode] = []
    links: list[GraphLink] = []

    total_solid = 0
    total_learning = 0
    total_not_started = 0
    total_chapters = 0
    total_topics = 0

    all_dates: list[str] = []
    topic_keywords: dict[str, set[str]] = {}
    topic_chapter_map: dict[str, str] = {}

    for r in roadmaps:
        r_id_str = f"roadmap-{r.id}"
        r_created_iso = r.created_at.isoformat()
        all_dates.append(r_created_iso)

        # Roadmap core node
        nodes.append(
            GraphNode(
                id=r_id_str,
                raw_id=str(r.id),
                label=r.title,
                type="roadmap",
                status="core",
                roadmap_id=str(r.id),
                roadmap_title=r.title,
                val=26.0,
                growth_level=3,
                color="#38bdf8",  # Sky-blue galaxy core
                created_at=r_created_iso,
                summary=r.goal,
            )
        )

        for ch in r.chapters:
            total_chapters += 1
            ch_id_str = f"chapter-{ch.id}"
            ch_created_iso = ch.created_at.isoformat()
            all_dates.append(ch_created_iso)

            # Chapter cluster node
            nodes.append(
                GraphNode(
                    id=ch_id_str,
                    raw_id=str(ch.id),
                    label=ch.title,
                    type="chapter",
                    status="cluster",
                    roadmap_id=str(r.id),
                    roadmap_title=r.title,
                    chapter_id=str(ch.id),
                    chapter_title=ch.title,
                    val=15.0,
                    growth_level=2,
                    color="#818cf8",  # Indigo cluster hub
                    created_at=ch_created_iso,
                )
            )

            # Structural link: Roadmap -> Chapter
            links.append(
                GraphLink(
                    source=r_id_str,
                    target=ch_id_str,
                    type="structural",
                    color="rgba(129, 140, 248, 0.4)",
                    curvature=0.0,
                    particles=2,
                )
            )

            prev_topic_id: str | None = None

            for tp in ch.topics:
                total_topics += 1
                tp_id_str = f"topic-{tp.id}"
                tp_created_iso = tp.created_at.isoformat()
                all_dates.append(tp_created_iso)
                topic_chapter_map[tp_id_str] = str(ch.id)

                m_count = msg_counts.get(tp.id, 0)
                keywords = _extract_concept_keywords(tp.title)
                if keywords:
                    topic_keywords[tp_id_str] = keywords

                if tp.status == "solid":
                    total_solid += 1
                    growth_level = 2
                    color = "#10b981"  # Emerald supernova
                    val = 9.0 + min(m_count * 0.6, 8.0)
                    link_color = "rgba(16, 185, 129, 0.55)"
                    particles = 3
                elif tp.status == "learning":
                    total_learning += 1
                    growth_level = 1
                    color = "#f59e0b"  # Amber pulsating star
                    val = 6.0 + min(m_count * 0.4, 5.0)
                    link_color = "rgba(245, 158, 11, 0.45)"
                    particles = 1
                else:
                    total_not_started += 1
                    growth_level = 0
                    color = "#52525b"  # Zinc dormant protostar
                    val = 4.0
                    link_color = "rgba(113, 113, 122, 0.22)"
                    particles = 0

                # Topic star node
                nodes.append(
                    GraphNode(
                        id=tp_id_str,
                        raw_id=str(tp.id),
                        label=tp.title,
                        type="topic",
                        status=tp.status,
                        roadmap_id=str(r.id),
                        roadmap_title=r.title,
                        chapter_id=str(ch.id),
                        chapter_title=ch.title,
                        val=val,
                        message_count=m_count,
                        growth_level=growth_level,
                        color=color,
                        created_at=tp_created_iso,
                        summary=tp.summary,
                    )
                )

                # Structural link: Chapter -> Topic
                links.append(
                    GraphLink(
                        source=ch_id_str,
                        target=tp_id_str,
                        type="structural",
                        color=link_color,
                        curvature=0.0,
                        particles=particles,
                    )
                )

                # Sequential progression link: Topic[i-1] -> Topic[i]
                if prev_topic_id is not None:
                    links.append(
                        GraphLink(
                            source=prev_topic_id,
                            target=tp_id_str,
                            type="sequential",
                            color="rgba(147, 197, 253, 0.3)",
                            curvature=0.08,
                            particles=1 if tp.status == "solid" else 0,
                        )
                    )
                prev_topic_id = tp_id_str

    # 3. Compute cross-chapter / cross-roadmap concept synapses
    seen_pairs: set[tuple[str, str]] = set()
    topic_ids = list(topic_keywords.keys())
    synapse_count_by_topic: dict[str, int] = {}

    for i in range(len(topic_ids)):
        t1_id = topic_ids[i]
        t1_words = topic_keywords[t1_id]
        t1_ch = topic_chapter_map.get(t1_id)

        for j in range(i + 1, len(topic_ids)):
            t2_id = topic_ids[j]
            t2_ch = topic_chapter_map.get(t2_id)

            # Only connect across different chapters
            if t1_ch == t2_ch:
                continue

            # Limit synapses per topic to prevent excessive visual clutter
            if (
                synapse_count_by_topic.get(t1_id, 0) >= 2
                or synapse_count_by_topic.get(t2_id, 0) >= 2
            ):
                continue

            shared_words = t1_words.intersection(topic_keywords[t2_id])
            if shared_words:
                pair_key = (min(t1_id, t2_id), max(t1_id, t2_id))
                if pair_key not in seen_pairs:
                    seen_pairs.add(pair_key)
                    synapse_count_by_topic[t1_id] = (
                        synapse_count_by_topic.get(t1_id, 0) + 1
                    )
                    synapse_count_by_topic[t2_id] = (
                        synapse_count_by_topic.get(t2_id, 0) + 1
                    )
                    links.append(
                        GraphLink(
                            source=t1_id,
                            target=t2_id,
                            type="synapse",
                            color="rgba(236, 72, 153, 0.5)",  # Cosmic magenta synapse filament
                            curvature=0.28,
                            particles=2,
                        )
                    )

    earliest_date = min(all_dates) if all_dates else None
    latest_date = max(all_dates) if all_dates else None

    return KnowledgeGraphResponse(
        nodes=nodes,
        links=links,
        total_nodes=len(nodes),
        total_roadmaps=len(roadmaps),
        total_chapters=total_chapters,
        total_topics=total_topics,
        total_solid=total_solid,
        total_learning=total_learning,
        total_not_started=total_not_started,
        earliest_date=earliest_date,
        latest_date=latest_date,
    )
