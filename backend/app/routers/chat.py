import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

from app.db import async_session_maker, get_db
from app.models import Chapter, Message, Topic
from app.schemas import (
    MessageChatRequest,
    MessagePinUpdate,
    MessageResponse,
)
from app.services import llm
from app.services.context import build_topic_context

router = APIRouter(tags=["chat"])


@router.get("/topics/{topic_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    topic_id: UUID,
    pinned: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    topic = await db.get(Topic, topic_id)
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )

    stmt = select(Message).where(Message.topic_id == topic_id)
    if pinned is not None:
        stmt = stmt.where(Message.pinned == pinned)
    stmt = stmt.order_by(Message.created_at.asc())

    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message_pin(
    message_id: UUID,
    payload: MessagePinUpdate,
    db: AsyncSession = Depends(get_db),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )
    message.pinned = payload.pinned
    await db.commit()
    await db.refresh(message)
    return message


@router.post("/topics/{topic_id}/chat")
async def chat_topic(
    topic_id: UUID,
    payload: MessageChatRequest,
    db: AsyncSession = Depends(get_db),
):
    # Verify topic exists and fetch hierarchy for orientation
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

    # 1. Save user message first using request db session
    user_message = Message(
        topic_id=topic_id,
        role="user",
        content=payload.content,
        pinned=False,
    )
    db.add(user_message)
    await db.commit()

    # Gather data needed for context before streaming
    chapter = topic.chapter
    roadmap = chapter.roadmap

    # Fetch recent messages including the new one
    msg_stmt = (
        select(Message)
        .where(Message.topic_id == topic_id)
        .order_by(Message.created_at.asc())
    )
    all_msgs_result = await db.execute(msg_stmt)
    recent_messages = list(all_msgs_result.scalars().all())

    prompt_messages = build_topic_context(
        roadmap=roadmap,
        chapter=chapter,
        topic=topic,
        recent_messages=recent_messages,
    )

    async def event_generator():
        accumulated_text = ""
        # The generator uses its own DB session so it outlives the request
        async with async_session_maker() as session:
            try:
                stream = llm.stream_chat_completion(prompt_messages)
                async for chunk in stream:
                    accumulated_text += chunk
                    event = {"delta": chunk}
                    yield f"data: {json.dumps(event)}\n\n"

                # Stream completed successfully, save assistant message
                assistant_message = Message(
                    topic_id=topic_id,
                    role="assistant",
                    content=accumulated_text,
                    pinned=False,
                )
                session.add(assistant_message)
                await session.commit()
                await session.refresh(assistant_message)

                done_event = {
                    "done": True,
                    "message_id": str(assistant_message.id),
                }
                yield f"data: {json.dumps(done_event)}\n\n"

            except (asyncio.CancelledError, GeneratorExit):
                # Client disconnected mid-stream; save whatever text was generated
                if accumulated_text.strip():
                    assistant_message = Message(
                        topic_id=topic_id,
                        role="assistant",
                        content=accumulated_text,
                        pinned=False,
                    )
                    session.add(assistant_message)
                    await session.commit()
                raise
            except Exception as exc:  # noqa: BLE001
                if accumulated_text.strip():
                    try:
                        assistant_message = Message(
                            topic_id=topic_id,
                            role="assistant",
                            content=accumulated_text,
                            pinned=False,
                        )
                        session.add(assistant_message)
                        await session.commit()
                    except Exception as save_err:  # noqa: BLE001
                        logger.warning("Failed to save partial message: %s", save_err)
                err_event = {"error": str(exc) or "Chat completion failed"}
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
