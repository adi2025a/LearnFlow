from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Chapter, Roadmap, Topic
from app.schemas import (
    ChapterCreate,
    ChapterResponse,
    ChapterUpdate,
    RoadmapCreate,
    RoadmapGenerateRequest,
    RoadmapResponse,
    RoadmapTreeResponse,
    RoadmapUpdate,
    TopicCreate,
    TopicResponse,
    TopicUpdate,
)
from app.services import roadmap_gen

router = APIRouter(tags=["roadmaps"])


# --- Roadmaps ---
@router.get("/roadmaps", response_model=list[RoadmapResponse])
async def list_roadmaps(db: AsyncSession = Depends(get_db)):
    stmt = select(Roadmap).order_by(Roadmap.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/roadmaps", response_model=RoadmapResponse, status_code=status.HTTP_201_CREATED
)
async def create_roadmap(payload: RoadmapCreate, db: AsyncSession = Depends(get_db)):
    roadmap = Roadmap(
        title=payload.title,
        goal=payload.goal,
        level=payload.level,
    )
    db.add(roadmap)
    await db.commit()
    await db.refresh(roadmap)
    return roadmap


@router.post(
    "/roadmaps/generate",
    response_model=RoadmapTreeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_roadmap(
    payload: RoadmapGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    roadmap = await roadmap_gen.generate_and_save_roadmap(
        db=db,
        goal=payload.goal,
        level=payload.level,
        duration=payload.duration,
    )
    return roadmap


@router.get("/roadmaps/{roadmap_id}", response_model=RoadmapTreeResponse)
async def get_roadmap(roadmap_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Roadmap)
        .options(selectinload(Roadmap.chapters).selectinload(Chapter.topics))
        .where(Roadmap.id == roadmap_id)
    )
    result = await db.execute(stmt)
    roadmap = result.scalar_one_or_none()
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found",
        )
    return roadmap


@router.patch("/roadmaps/{roadmap_id}", response_model=RoadmapResponse)
async def update_roadmap(
    roadmap_id: UUID,
    payload: RoadmapUpdate,
    db: AsyncSession = Depends(get_db),
):
    roadmap = await db.get(Roadmap, roadmap_id)
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found",
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(roadmap, field, value)

    await db.commit()
    await db.refresh(roadmap)
    return roadmap


@router.delete("/roadmaps/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roadmap(roadmap_id: UUID, db: AsyncSession = Depends(get_db)):
    roadmap = await db.get(Roadmap, roadmap_id)
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found",
        )
    await db.delete(roadmap)
    await db.commit()


# --- Chapters ---
@router.post(
    "/roadmaps/{roadmap_id}/chapters",
    response_model=ChapterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_chapter(
    roadmap_id: UUID,
    payload: ChapterCreate,
    db: AsyncSession = Depends(get_db),
):
    roadmap = await db.get(Roadmap, roadmap_id)
    if not roadmap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roadmap not found",
        )

    position = payload.position
    if position is None:
        max_pos_stmt = select(func.coalesce(func.max(Chapter.position), -1)).where(
            Chapter.roadmap_id == roadmap_id
        )
        max_pos = (await db.execute(max_pos_stmt)).scalar_one()
        position = max_pos + 1

    chapter = Chapter(
        roadmap_id=roadmap_id,
        title=payload.title,
        position=position,
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.patch("/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: UUID,
    payload: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
):
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(chapter, field, value)

    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chapter(chapter_id: UUID, db: AsyncSession = Depends(get_db)):
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )
    await db.delete(chapter)
    await db.commit()


# --- Topics ---
@router.post(
    "/chapters/{chapter_id}/topics",
    response_model=TopicResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_topic(
    chapter_id: UUID,
    payload: TopicCreate,
    db: AsyncSession = Depends(get_db),
):
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chapter not found",
        )

    position = payload.position
    if position is None:
        max_pos_stmt = select(func.coalesce(func.max(Topic.position), -1)).where(
            Topic.chapter_id == chapter_id
        )
        max_pos = (await db.execute(max_pos_stmt)).scalar_one()
        position = max_pos + 1

    topic = Topic(
        chapter_id=chapter_id,
        title=payload.title,
        position=position,
        status="not_started",
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.patch("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: UUID,
    payload: TopicUpdate,
    db: AsyncSession = Depends(get_db),
):
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(topic, field, value)

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )
    await db.delete(topic)
    await db.commit()
