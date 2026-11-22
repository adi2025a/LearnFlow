import React from 'react'
import { useParams, Link } from 'react-router-dom'
import type { RoadmapTree, Topic, Chapter } from '../api/types'
import { ChatView } from '../components/Chat/ChatView'

interface TopicPageProps {
  roadmap: RoadmapTree | null
  isLoading: boolean
}

export const TopicPage: React.FC<TopicPageProps> = ({ roadmap, isLoading }) => {
  const { topicId } = useParams<{ topicId: string }>()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#09090b]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      </div>
    )
  }

  // Find topic and chapter in current roadmap tree
  let foundTopic: Topic | null = null
  let foundChapter: Chapter | null = null

  if (roadmap) {
    for (const chapter of roadmap.chapters) {
      const t = chapter.topics.find((item) => item.id === topicId)
      if (t) {
        foundTopic = t
        foundChapter = chapter
        break
      }
    }
  }

  if (!foundTopic) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#09090b]">
        <h2 className="text-base font-semibold tracking-tight text-white">
          Topic Not Found
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          This topic may have been removed or belongs to a different roadmap.
        </p>
        <Link
          to="/"
          className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
        >
          Back to Roadmaps
        </Link>
      </div>
    )
  }

  return (
    <ChatView
      topic={foundTopic}
      chapterTitle={foundChapter?.title}
      roadmapTitle={roadmap?.title}
    />
  )
}
