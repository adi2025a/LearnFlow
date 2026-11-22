from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import HTTPException
from openai import AsyncOpenAI, OpenAIError

from app.config import settings
from app.schemas import GeneratedRoadmap

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def stream_chat_completion(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    client = get_client()
    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
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


async def generate_structured_roadmap(
    goal: str,
    level: str | None = None,
    duration: str | None = None,
) -> GeneratedRoadmap:
    client = get_client()
    prompt_path = PROMPTS_DIR / "roadmap.md"
    system_prompt = (
        prompt_path.read_text(encoding="utf-8")
        if prompt_path.exists()
        else "You are an expert curriculum designer. Generate a structured learning roadmap."
    )

    user_content = f"Goal: {goal}\nTarget Level: {level or 'Not specified'}\nDuration/Timeframe: {duration or 'Not specified'}"

    try:
        completion = await client.beta.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=GeneratedRoadmap,
        )
        message = completion.choices[0].message
        if message.parsed:
            return message.parsed
        raise HTTPException(
            status_code=502,
            detail="Could not parse AI response into structured roadmap.",
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to generate roadmap from AI provider.",
        ) from exc
