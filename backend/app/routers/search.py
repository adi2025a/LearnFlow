from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Chapter, Message, Roadmap, Topic
from app.schemas import SearchResult

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchResult])
async def search_messages(
    q: str = Query(..., min_length=1, description="Search query string"),
    db: AsyncSession = Depends(get_db),
):
    cleaned_q = q.strip()
    if not cleaned_q:
        return []

    ts_query = func.websearch_to_tsquery("english", cleaned_q)
    snippet_func = func.coalesce(
        func.ts_headline(
            "english",
            Message.content,
            ts_query,
            "StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15",
        ),
        func.substr(Message.content, 1, 150),
    )

    stmt = (
        select(
            Message.id.label("message_id"),
            snippet_func.label("snippet"),
            Topic.id.label("topic_id"),
            Topic.title.label("topic_title"),
            Chapter.title.label("chapter_title"),
            Roadmap.title.label("roadmap_title"),
        )
        .join(Topic, Message.topic_id == Topic.id)
        .join(Chapter, Topic.chapter_id == Chapter.id)
        .join(Roadmap, Chapter.roadmap_id == Roadmap.id)
        .where(Message.search_vector.op("@@")(ts_query))
        .limit(50)
    )

    result = await db.execute(stmt)
    rows = result.all()
    return [
        SearchResult(
            message_id=row.message_id,
            snippet=row.snippet,
            topic_id=row.topic_id,
            topic_title=row.topic_title,
            chapter_title=row.chapter_title,
            roadmap_title=row.roadmap_title,
        )
        for row in rows
    ]
