from pathlib import Path

from app.config import settings
from app.models import Chapter, Message, Roadmap, Topic

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def get_tutor_system_prompt() -> str:
    prompt_path = PROMPTS_DIR / "tutor.md"
    if prompt_path.exists():
        return prompt_path.read_text(encoding="utf-8").strip()
    return "You are a patient tutor helping one learner study the current topic."


def build_topic_context(
    roadmap: Roadmap,
    chapter: Chapter,
    topic: Topic,
    recent_messages: list[Message],
    limit: int | None = None,
) -> list[dict[str, str]]:
    prompt_limit = limit or settings.CONTEXT_MESSAGES
    context: list[dict[str, str]] = []

    # 1. Base tutor prompt
    context.append(
        {
            "role": "system",
            "content": get_tutor_system_prompt(),
        }
    )

    # 2. Orientation
    orientation = (
        f"Roadmap: {roadmap.title}. Chapter: {chapter.title}. Topic: {topic.title}."
    )
    context.append(
        {
            "role": "system",
            "content": orientation,
        }
    )

    # 3. Topic summary if present
    if topic.summary and topic.summary.strip():
        context.append(
            {
                "role": "system",
                "content": f"Summary of earlier discussion: {topic.summary.strip()}",
            }
        )

    # 4. Last CONTEXT_MESSAGES messages, oldest first
    trimmed_messages = (
        recent_messages[-prompt_limit:]
        if len(recent_messages) > prompt_limit
        else recent_messages
    )
    for msg in trimmed_messages:
        context.append(
            {
                "role": msg.role,
                "content": msg.content,
            }
        )

    return context
