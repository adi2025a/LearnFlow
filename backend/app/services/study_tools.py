from collections.abc import AsyncIterator

from fastapi import HTTPException
from openai import OpenAIError

from app.config import settings
from app.schemas import (
    CopilotChatMessage,
    ExplanationEvaluateResponse,
    QuizResponse,
    TopicVideosResponse,
)
from app.services import llm


async def generate_topic_quiz(
    topic_title: str,
    chapter_title: str,
    roadmap_title: str,
    summary: str | None = None,
) -> QuizResponse:
    client = llm.get_client()
    system_prompt = (
        "You are an expert technical educator creating rigorous multiple-choice questions "
        "to test a student's conceptual mastery and problem-solving ability on a specific topic. "
        "Avoid trivial syntax trivia; focus on underlying mechanisms, common pitfalls, and architectural choices. "
        "Always generate exactly 3 or 4 high-quality questions with 4 distinct options (A, B, C, D), "
        "specifying the single correct option ID and an enlightening explanation."
    )

    user_content = (
        f"Roadmap: {roadmap_title}\nChapter: {chapter_title}\nTopic: {topic_title}\n"
    )
    if summary and summary.strip():
        user_content += f"Prior Topic Discussion Summary: {summary.strip()}\n"
    user_content += "Create 3-4 multiple-choice questions for this topic."

    try:
        completion = await client.beta.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=QuizResponse,
        )
        message = completion.choices[0].message
        if message.parsed:
            return message.parsed
        raise HTTPException(
            status_code=502,
            detail="Could not parse AI response into structured quiz.",
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to generate quiz from AI provider.",
        ) from exc


async def evaluate_user_explanation(
    topic_title: str,
    chapter_title: str,
    roadmap_title: str,
    explanation: str,
) -> ExplanationEvaluateResponse:
    client = llm.get_client()
    system_prompt = (
        "You are a master Feynman-technique learning mentor. The user is explaining a technical concept "
        "in their own words to verify their understanding. "
        "Analyze their explanation with high technical precision while remaining encouraging. "
        "Rate their mastery as:\n"
        "- 'solid': Accurate, clearly articulated, demonstrates real intuition with minimal to no errors.\n"
        "- 'almost': Mostly correct intuition, but missing a key subtlety or slightly imprecise.\n"
        "- 'needs_work': Contains significant misconceptions or fails to capture core mechanics.\n"
        "Provide specific strengths, point out gaps or misconceptions directly, and give one actionable tip."
    )

    user_content = (
        f"Roadmap: {roadmap_title}\n"
        f"Chapter: {chapter_title}\n"
        f"Topic: {topic_title}\n\n"
        f'User\'s Explanation:\n"""{explanation}"""'
    )

    try:
        completion = await client.beta.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=ExplanationEvaluateResponse,
        )
        message = completion.choices[0].message
        if message.parsed:
            return message.parsed
        raise HTTPException(
            status_code=502,
            detail="Could not parse AI response into structured evaluation.",
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to evaluate explanation from AI provider.",
        ) from exc


async def stream_copilot_chat(
    messages: list[CopilotChatMessage],
) -> AsyncIterator[str]:
    client = llm.get_client()
    copilot_system_prompt = (
        "You are LearnFlow Copilot: a fast, direct, and zero-context technical assistant. "
        "Answer questions directly, accurately, and concisely. "
        "Provide working code snippets, CLI command flags, or quick explanations. "
        "Avoid conversational pleasantries or preamble."
    )

    formatted_messages = [
        {"role": "system", "content": copilot_system_prompt},
        *[{"role": m.role, "content": m.content} for m in messages],
    ]

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=formatted_messages,
            stream=True,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to communicate with AI provider.",
        ) from exc


async def get_topic_videos(
    topic_title: str,
    chapter_title: str,
    roadmap_title: str,
) -> TopicVideosResponse:
    client = llm.get_client()
    system_prompt = (
        "You are an expert technical curator who recommends the best YouTube videos, tutorials, "
        "and university lectures for learning engineering and computer science concepts. "
        "Recommend top-rated, highly visual, and comprehensive videos from reputable channels "
        "(such as 3Blue1Brown, freeCodeCamp, MIT OpenCourseWare, Stanford, Computerphile, Traversy, Fireship, NVIDIA Developer, etc.). "
        "Provide exact, actionable search queries that will immediately yield the best videos on YouTube, "
        "and if you know the exact standard 11-character YouTube video ID with confidence, include it."
    )

    user_content = (
        f"Roadmap: {roadmap_title}\n"
        f"Chapter: {chapter_title}\n"
        f"Topic: {topic_title}\n"
        f"Curate 4-6 of the most relatable and clear YouTube videos/lectures that explain this topic."
    )

    try:
        completion = await client.beta.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=TopicVideosResponse,
        )
        message = completion.choices[0].message
        if message.parsed:
            return message.parsed
        raise HTTPException(
            status_code=502,
            detail="Could not parse AI response into structured video recommendations.",
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to get video recommendations from AI provider.",
        ) from exc
