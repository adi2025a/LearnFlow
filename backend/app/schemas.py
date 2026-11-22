from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- OpenAI Structured Output Schemas ---
class GeneratedTopic(BaseModel):
    title: str = Field(description="Specific, focused title learnable in one sitting")


class GeneratedChapter(BaseModel):
    title: str = Field(description="Chapter title ordered logically")
    topics: list[GeneratedTopic] = Field(
        min_length=1, description="List of topics under this chapter"
    )


class GeneratedRoadmap(BaseModel):
    title: str = Field(description="Comprehensive title for the learning roadmap")
    chapters: list[GeneratedChapter] = Field(
        min_length=1,
        description="Ordered list of chapters from prerequisites to advanced",
    )


# --- Roadmap Schemas ---
class RoadmapBase(BaseModel):
    title: str
    goal: str
    level: str | None = None


class RoadmapCreate(RoadmapBase):
    pass


class RoadmapUpdate(BaseModel):
    title: str | None = None
    goal: str | None = None
    level: str | None = None


class RoadmapResponse(RoadmapBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class RoadmapGenerateRequest(BaseModel):
    goal: str
    level: str | None = None
    duration: str | None = None


# --- Chapter Schemas ---
class ChapterCreate(BaseModel):
    title: str
    position: int | None = None


class ChapterUpdate(BaseModel):
    title: str | None = None
    position: int | None = None


class ChapterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    roadmap_id: UUID
    title: str
    position: int
    created_at: datetime


# --- Topic Schemas ---
TopicStatus = Literal["not_started", "learning", "solid"]


class TopicCreate(BaseModel):
    title: str
    position: int | None = None


class TopicUpdate(BaseModel):
    title: str | None = None
    position: int | None = None
    status: TopicStatus | None = None


class TopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chapter_id: UUID
    title: str
    position: int
    status: str
    summary: str | None = None
    created_at: datetime


# --- Full Tree Schemas ---
class TopicTreeResponse(TopicResponse):
    pass


class ChapterTreeResponse(ChapterResponse):
    topics: list[TopicTreeResponse] = []


class RoadmapTreeResponse(RoadmapResponse):
    chapters: list[ChapterTreeResponse] = []


# --- Message Schemas ---
class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    topic_id: UUID
    role: str
    content: str
    pinned: bool
    created_at: datetime


class MessageChatRequest(BaseModel):
    content: str


class MessagePinUpdate(BaseModel):
    pinned: bool


# --- Search Schemas ---
class SearchResult(BaseModel):
    message_id: UUID
    snippet: str
    topic_id: UUID
    topic_title: str
    chapter_title: str
    roadmap_title: str


# --- Quiz Schemas ---
class QuizOption(BaseModel):
    id: str = Field(description="Option identifier: A, B, C, or D")
    text: str = Field(description="Option text description")


class QuizQuestion(BaseModel):
    id: int = Field(description="Question number starting from 1")
    question: str = Field(description="Multiple-choice question prompt")
    options: list[QuizOption] = Field(
        min_length=4, max_length=4, description="Four options: A, B, C, D"
    )
    correct_option_id: str = Field(
        description="The ID of the correct option: 'A', 'B', 'C', or 'D'"
    )
    explanation: str = Field(
        description="Concise explanation of why the correct option is right and others are wrong"
    )


class QuizResponse(BaseModel):
    topic_title: str
    questions: list[QuizQuestion] = Field(
        description="3-4 challenging questions testing deep understanding"
    )


# --- Explanation Evaluation (Feynman) Schemas ---
class ExplanationEvaluateRequest(BaseModel):
    explanation: str = Field(
        min_length=10, description="The learner's own explanation of the topic"
    )


class ExplanationEvaluateResponse(BaseModel):
    rating: Literal["solid", "almost", "needs_work"] = Field(
        description="Mastery rating based on accuracy and completeness"
    )
    summary: str = Field(description="Quick summary of what the user explained")
    strengths: list[str] = Field(description="Key concepts correctly understood")
    gaps_or_corrections: list[str] = Field(
        description="Misconceptions, inaccuracies, or critical missed details"
    )
    suggestion: str = Field(
        description="Actionable advice or mental model to lock in understanding"
    )


# --- Copilot Schemas ---
class CopilotChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class CopilotChatRequest(BaseModel):
    messages: list[CopilotChatMessage]


# --- YouTube Video Recommendation Schemas ---
class YouTubeRecommendation(BaseModel):
    title: str = Field(
        description="Descriptive title of the recommended YouTube video or lecture"
    )
    channel_or_creator: str = Field(
        description="Channel or instructor name (e.g., 3Blue1Brown, freeCodeCamp, MIT OpenCourseWare, NVIDIA Developer)"
    )
    search_query: str = Field(
        description="Exact search query to locate this video or relevant tutorial on YouTube"
    )
    why_recommended: str = Field(
        description="1-2 sentences explaining why this video is helpful for understanding this topic"
    )
    video_id: str | None = Field(
        default=None,
        description="Known 11-character YouTube video ID if known, otherwise null",
    )


class TopicVideosResponse(BaseModel):
    topic_title: str
    chapter_title: str
    recommended_search_queries: list[str] = Field(
        description="3-4 targeted search queries for this topic"
    )
    videos: list[YouTubeRecommendation] = Field(
        description="List of 4-6 high quality video recommendations"
    )
