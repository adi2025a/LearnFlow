import type {
  Chapter,
  ChapterCreate,
  ChapterUpdate,
  ExplanationEvaluateResponse,
  Message,
  QuizResponse,
  Roadmap,
  RoadmapCreate,
  RoadmapGenerateRequest,
  RoadmapTree,
  RoadmapUpdate,
  SearchResult,
  Topic,
  TopicCreate,
  TopicUpdate,
  TopicVideosResponse,
} from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    let errorMessage = `HTTP error ${res.status}`
    try {
      const errorData = await res.json()
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail)
      }
    } catch {
      // ignore json parse errors on non-json responses
    }
    throw new Error(errorMessage)
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

export const api = {
  // Roadmaps
  listRoadmaps: () => request<Roadmap[]>('/api/roadmaps'),
  getRoadmap: (id: string) => request<RoadmapTree>(`/api/roadmaps/${id}`),
  createRoadmap: (data: RoadmapCreate) =>
    request<Roadmap>('/api/roadmaps', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateRoadmap: (data: RoadmapGenerateRequest) =>
    request<RoadmapTree>('/api/roadmaps/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRoadmap: (id: string, data: RoadmapUpdate) =>
    request<Roadmap>(`/api/roadmaps/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteRoadmap: (id: string) =>
    request<void>(`/api/roadmaps/${id}`, { method: 'DELETE' }),

  // Chapters
  createChapter: (roadmapId: string, data: ChapterCreate) =>
    request<Chapter>(`/api/roadmaps/${roadmapId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateChapter: (chapterId: string, data: ChapterUpdate) =>
    request<Chapter>(`/api/chapters/${chapterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteChapter: (chapterId: string) =>
    request<void>(`/api/chapters/${chapterId}`, { method: 'DELETE' }),

  // Topics
  createTopic: (chapterId: string, data: TopicCreate) =>
    request<Topic>(`/api/chapters/${chapterId}/topics`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTopic: (topicId: string, data: TopicUpdate) =>
    request<Topic>(`/api/topics/${topicId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTopic: (topicId: string) =>
    request<void>(`/api/topics/${topicId}`, { method: 'DELETE' }),

  // Messages
  listMessages: (topicId: string, pinned?: boolean) => {
    const params = pinned !== undefined ? `?pinned=${pinned}` : ''
    return request<Message[]>(`/api/topics/${topicId}/messages${params}`)
  },
  updateMessagePin: (messageId: string, pinned: boolean) =>
    request<Message>(`/api/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned }),
    }),

  // Search
  search: (q: string) =>
    request<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),

  // Study Tools
  getTopicQuiz: (topicId: string) =>
    request<QuizResponse>(`/api/topics/${topicId}/quiz`, {
      method: 'POST',
    }),
  evaluateExplanation: (topicId: string, explanation: string) =>
    request<ExplanationEvaluateResponse>(`/api/topics/${topicId}/evaluate-explanation`, {
      method: 'POST',
      body: JSON.stringify({ explanation }),
    }),
  getTopicVideos: (topicId: string) =>
    request<TopicVideosResponse>(`/api/topics/${topicId}/videos`),
}



