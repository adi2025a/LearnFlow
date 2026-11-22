export type TopicStatus = 'not_started' | 'learning' | 'solid'

export interface Topic {
  id: string
  chapter_id: string
  title: string
  position: number
  status: TopicStatus
  summary: string | null
  created_at: string
}

export interface Chapter {
  id: string
  roadmap_id: string
  title: string
  position: number
  created_at: string
  topics: Topic[]
}

export interface Roadmap {
  id: string
  title: string
  goal: string
  level: string | null
  created_at: string
  updated_at: string
}

export interface RoadmapTree extends Roadmap {
  chapters: Chapter[]
}

export interface RoadmapCreate {
  title: string
  goal: string
  level?: string | null
}

export interface RoadmapUpdate {
  title?: string
  goal?: string
  level?: string | null
}

export interface RoadmapGenerateRequest {
  goal: string
  level?: string | null
  duration?: string | null
}

export interface ChapterCreate {
  title: string
  position?: number
}

export interface ChapterUpdate {
  title?: string
  position?: number
}

export interface TopicCreate {
  title: string
  position?: number
}

export interface TopicUpdate {
  title?: string
  position?: number
  status?: TopicStatus
}

export interface Message {
  id: string
  topic_id: string
  role: 'user' | 'assistant'
  content: string
  pinned: boolean
  created_at: string
}

export interface SearchResult {
  message_id: string
  snippet: string
  topic_id: string
  topic_title: string
  chapter_title: string
  roadmap_title: string
}

export interface SSEDeltaEvent {
  delta: string
}

export interface SSEDoneEvent {
  done: true
  message_id: string
}

// --- Study Tools Types ---
export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestion {
  id: number
  question: string
  options: QuizOption[]
  correct_option_id: string
  explanation: string
}

export interface QuizResponse {
  topic_title: string
  questions: QuizQuestion[]
}

export type ExplanationRating = 'solid' | 'almost' | 'needs_work'

export interface ExplanationEvaluateRequest {
  explanation: string
}

export interface ExplanationEvaluateResponse {
  rating: ExplanationRating
  summary: string
  strengths: string[]
  gaps_or_corrections: string[]
  suggestion: string
}

export interface CopilotChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CopilotChatRequest {
  messages: CopilotChatMessage[]
}

// --- YouTube Recommendation Types ---
export interface YouTubeRecommendation {
  title: string
  channel_or_creator: string
  search_query: string
  why_recommended: string
  video_id: string | null
}

export interface TopicVideosResponse {
  topic_title: string
  chapter_title: string
  recommended_search_queries: string[]
  videos: YouTubeRecommendation[]
}



export interface SSEErrorEvent {
  error: string
}

export type SSEChatEvent = SSEDeltaEvent | SSEDoneEvent | SSEErrorEvent

