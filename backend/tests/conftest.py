import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.db import async_session_maker
from app.main import app
from app.models import Roadmap
from app.schemas import (
    CopilotChatMessage,
    ExplanationEvaluateResponse,
    GeneratedChapter,
    GeneratedRoadmap,
    GeneratedTopic,
    QuizOption,
    QuizQuestion,
    QuizResponse,
    TopicVideosResponse,
    YouTubeRecommendation,
)
from app.services import llm, study_tools


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(autouse=True, scope="session")
async def cleanup_test_data():
    yield
    async with async_session_maker() as session:
        await session.execute(
            delete(Roadmap).where(
                Roadmap.title.in_(
                    [
                        "Search Roadmap",
                        "Chat Test Roadmap",
                        "Python Mastery",
                        "Python 3.12 Mastery",
                        "Roadmap for Docker & Kubernetes",
                        "Study Tools Roadmap",
                    ]
                )
            )
        )
        await session.commit()


@pytest.fixture(autouse=True)
def mock_llm_services(monkeypatch):
    async def fake_stream_chat_completion(messages: list[dict[str, str]]):
        for token in ["Hello", " from", " AI", " tutor!"]:
            yield token

    async def fake_generate_structured_roadmap(
        goal: str,
        level: str | None = None,
        duration: str | None = None,
    ) -> GeneratedRoadmap:
        return GeneratedRoadmap(
            title=f"Roadmap for {goal}",
            chapters=[
                GeneratedChapter(
                    title="Basics",
                    topics=[
                        GeneratedTopic(title="Introduction"),
                        GeneratedTopic(title="Core Concepts"),
                    ],
                ),
                GeneratedChapter(
                    title="Advanced",
                    topics=[
                        GeneratedTopic(title="Deep Dive"),
                    ],
                ),
            ],
        )

    async def fake_generate_topic_quiz(
        topic_title: str,
        chapter_title: str,
        roadmap_title: str,
        summary: str | None = None,
    ) -> QuizResponse:
        return QuizResponse(
            topic_title=topic_title,
            questions=[
                QuizQuestion(
                    id=1,
                    question=f"What is the primary role of {topic_title}?",
                    options=[
                        QuizOption(id="A", text="Core functionality"),
                        QuizOption(id="B", text="Deprecated wrapper"),
                        QuizOption(id="C", text="Network socket"),
                        QuizOption(id="D", text="Compiler flag"),
                    ],
                    correct_option_id="A",
                    explanation="Option A is correct because it implements the primary role.",
                )
            ],
        )

    async def fake_evaluate_user_explanation(
        topic_title: str,
        chapter_title: str,
        roadmap_title: str,
        explanation: str,
    ) -> ExplanationEvaluateResponse:
        return ExplanationEvaluateResponse(
            rating="solid",
            summary=f"Accurate explanation of {topic_title}",
            strengths=["Clear clarity", "Accurate terms"],
            gaps_or_corrections=[],
            suggestion="Next step is to write a small project using it.",
        )

    async def fake_stream_copilot_chat(messages: list[CopilotChatMessage]):
        for token in ["Copilot: ", "use ", "uv ", "run ", "pytest"]:
            yield token

    async def fake_get_topic_videos(
        topic_title: str,
        chapter_title: str,
        roadmap_title: str,
    ) -> TopicVideosResponse:
        return TopicVideosResponse(
            topic_title=topic_title,
            chapter_title=chapter_title,
            recommended_search_queries=[
                f"{topic_title} tutorial",
                f"{topic_title} full course",
            ],
            videos=[
                YouTubeRecommendation(
                    title=f"Complete {topic_title} Guide",
                    channel_or_creator="freeCodeCamp",
                    search_query=f"{topic_title} full course freecodecamp",
                    why_recommended="Best overall hands-on tutorial with visual explanations.",
                    video_id="dQw4w9WgXcQ",
                )
            ],
        )

    monkeypatch.setattr(llm, "stream_chat_completion", fake_stream_chat_completion)
    monkeypatch.setattr(
        llm, "generate_structured_roadmap", fake_generate_structured_roadmap
    )
    monkeypatch.setattr(study_tools, "generate_topic_quiz", fake_generate_topic_quiz)
    monkeypatch.setattr(
        study_tools,
        "evaluate_user_explanation",
        fake_evaluate_user_explanation,
    )
    monkeypatch.setattr(study_tools, "stream_copilot_chat", fake_stream_copilot_chat)
    monkeypatch.setattr(study_tools, "get_topic_videos", fake_get_topic_videos)
