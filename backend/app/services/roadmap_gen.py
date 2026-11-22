from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Chapter, Roadmap, Topic
from app.services import llm


async def generate_and_save_roadmap(
    db: AsyncSession,
    goal: str,
    level: str | None = None,
    duration: str | None = None,
) -> Roadmap:
    structured = await llm.generate_structured_roadmap(
        goal=goal,
        level=level,
        duration=duration,
    )

    roadmap = Roadmap(
        title=structured.title,
        goal=goal,
        level=level,
    )
    db.add(roadmap)
    await db.flush()

    for ch_idx, ch_data in enumerate(structured.chapters):
        chapter = Chapter(
            roadmap_id=roadmap.id,
            title=ch_data.title,
            position=ch_idx,
        )
        db.add(chapter)
        await db.flush()

        for top_idx, top_data in enumerate(ch_data.topics):
            topic = Topic(
                chapter_id=chapter.id,
                title=top_data.title,
                position=top_idx,
                status="not_started",
            )
            db.add(topic)

    await db.commit()

    # Query with selectinload to return full tree
    stmt = (
        select(Roadmap)
        .options(selectinload(Roadmap.chapters).selectinload(Chapter.topics))
        .where(Roadmap.id == roadmap.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()
