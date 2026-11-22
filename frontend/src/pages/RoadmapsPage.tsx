import React, { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import type { RoadmapTree, Topic } from '../api/types'
import { api } from '../api/client'
import { LearningHeatmap } from '../components/Dashboard/LearningHeatmap'

interface RoadmapsPageProps {
  currentRoadmap: RoadmapTree | null
  roadmaps: { id: string; title: string; goal: string; level?: string | null }[]
  onOpenNewRoadmap: () => void
}

interface RoadmapCardData {
  id: string
  title: string
  goal: string
  level?: string | null
  tree: RoadmapTree | null
  totalTopics: number
  solidCount: number
  learningCount: number
  percentComplete: number
  nextTopic: Topic | null
  nextChapterTitle: string | null
  firstTopic: Topic | null
}

export const RoadmapsPage: React.FC<RoadmapsPageProps> = ({
  currentRoadmap,
  roadmaps,
  onOpenNewRoadmap,
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch trees for all roadmaps in parallel
  const roadmapTreeQueries = useQueries({
    queries: roadmaps.map((r) => ({
      queryKey: ['roadmap', r.id],
      queryFn: () => api.getRoadmap(r.id),
      staleTime: 1000 * 60 * 2,
    })),
  })

  const deleteRoadmapMutation = useMutation({
    mutationFn: (id: string) => api.deleteRoadmap(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
      navigate('/')
    },
  })

  // Compute stats and "Up Next" per roadmap
  const roadmapsData: RoadmapCardData[] = useMemo(() => {
    return roadmaps.map((r, index) => {
      const tree = roadmapTreeQueries[index]?.data || (currentRoadmap?.id === r.id ? currentRoadmap : null)
      if (!tree) {
        return {
          id: r.id,
          title: r.title,
          goal: r.goal,
          level: r.level,
          tree: null,
          totalTopics: 0,
          solidCount: 0,
          learningCount: 0,
          percentComplete: 0,
          nextTopic: null,
          nextChapterTitle: null,
          firstTopic: null,
        }
      }

      const allTopics = tree.chapters.flatMap((ch) => ch.topics)
      const solidCount = allTopics.filter((t) => t.status === 'solid').length
      const learningCount = allTopics.filter((t) => t.status === 'learning').length
      const totalTopics = allTopics.length
      const percentComplete = totalTopics > 0 ? Math.round((solidCount / totalTopics) * 100) : 0

      // Find first unmastered topic across chapters in order
      let nextTopic: Topic | null = null
      let nextChapterTitle: string | null = null

      for (const chapter of tree.chapters) {
        const unmastered = chapter.topics.find((t) => t.status !== 'solid')
        if (unmastered) {
          nextTopic = unmastered
          nextChapterTitle = chapter.title
          break
        }
      }

      const firstTopic = allTopics[0] || null

      return {
        id: r.id,
        title: tree.title,
        goal: tree.goal,
        level: tree.level,
        tree,
        totalTopics,
        solidCount,
        learningCount,
        percentComplete,
        nextTopic,
        nextChapterTitle,
        firstTopic,
      }
    })
  }, [roadmaps, roadmapTreeQueries, currentRoadmap])

  // Total summary stats across all roadmaps
  const totalRoadmaps = roadmaps.length
  const totalSolidOverall = roadmapsData.reduce((acc, r) => acc + r.solidCount, 0)
  const totalTopicsOverall = roadmapsData.reduce((acc, r) => acc + r.totalTopics, 0)

  if (roadmaps.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-[#09090b]">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-white font-mono font-bold text-lg">
          LF
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">
          Welcome to LearnFlow
        </h1>
        <p className="mt-2 max-w-sm text-xs text-zinc-400 leading-relaxed">
          Structured learning roadmaps broken down into bite-sized topics.
          Each topic has its own persistent AI tutor chat, interactive quizzes, and Feynman conceptual reviews.
        </p>

        <button
          type="button"
          onClick={onOpenNewRoadmap}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition-colors"
        >
          Create Your First Roadmap
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-10 bg-[#09090b]">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        {/* Top Overview & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Learning Dashboard
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Track progress, continue from your next unmastered topic, or review concepts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50 text-xs font-mono">
              <span className="text-zinc-400">
                <strong className="text-white">{totalRoadmaps}</strong> {totalRoadmaps === 1 ? 'Roadmap' : 'Roadmaps'}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-emerald-400">
                <strong className="text-emerald-300">{totalSolidOverall}</strong>/{totalTopicsOverall} Mastered
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenNewRoadmap}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition-colors shrink-0"
            >
              <span>+</span>
              <span>New Roadmap</span>
            </button>
          </div>
        </div>

        {/* GitHub-Style Study Streak & Daily Activity Heatmap */}
        <LearningHeatmap />

        {/* Roadmap Cards Grid */}
        <div className="grid gap-5 md:grid-cols-2">
          {roadmapsData.map((roadmap) => {
            const hasNext = Boolean(roadmap.nextTopic)
            const targetTopic = roadmap.nextTopic || roadmap.firstTopic

            return (
              <div
                key={roadmap.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition-all hover:border-zinc-700/80 hover:bg-zinc-900/60"
              >
                {/* Header & Meta */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block rounded-md bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                      {roadmap.level || 'Custom Roadmap'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${roadmap.title}"?`)) {
                          deleteRoadmapMutation.mutate(roadmap.id)
                        }
                      }}
                      className="rounded-lg p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/60 transition-colors"
                      title="Delete roadmap"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div>
                    <Link
                      to={`/roadmaps/${roadmap.id}`}
                      className="text-base font-semibold text-white hover:text-zinc-200 transition-colors line-clamp-1"
                    >
                      {roadmap.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {roadmap.goal}
                    </p>
                  </div>

                  {/* Progress Bar & Counts */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 font-mono">
                      <span>
                        <strong className="text-zinc-200">{roadmap.solidCount}</strong>/{roadmap.totalTopics} mastered ({roadmap.percentComplete}%)
                      </span>
                      {roadmap.learningCount > 0 && (
                        <span className="text-amber-400">
                          {roadmap.learningCount} in progress
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${roadmap.percentComplete}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Up Next Section / Call to Action */}
                <div className="mt-5 pt-4 border-t border-zinc-800/80">
                  {hasNext && roadmap.nextTopic ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/90 bg-zinc-950/60 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>Up Next • {roadmap.nextChapterTitle}</span>
                        </div>
                        <h4 className="mt-0.5 text-xs font-medium text-zinc-100 truncate">
                          {roadmap.nextTopic.title}
                        </h4>
                      </div>

                      <Link
                        to={`/topics/${roadmap.nextTopic.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition-colors shrink-0"
                      >
                        <span>Continue</span>
                        <span>→</span>
                      </Link>
                    </div>
                  ) : roadmap.totalTopics > 0 && roadmap.solidCount === roadmap.totalTopics ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-300 font-mono">
                      <span className="flex items-center gap-1.5">
                        <span>🎉</span>
                        <span>All {roadmap.totalTopics} topics mastered!</span>
                      </span>
                      {targetTopic && (
                        <Link
                          to={`/topics/${targetTopic.id}`}
                          className="text-[11px] text-emerald-400 hover:underline"
                        >
                          Review Topics →
                        </Link>
                      )}
                    </div>
                  ) : (
                    targetTopic && (
                      <Link
                        to={`/topics/${targetTopic.id}`}
                        className="inline-flex items-center justify-center w-full gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60 p-2.5 text-xs font-medium text-zinc-300 transition-colors"
                      >
                        Start Learning →
                      </Link>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected Roadmap Full Breakdown */}
        {currentRoadmap && (
          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Curriculum Breakdown: {currentRoadmap.title}
                </h2>
                <p className="text-xs text-zinc-400">
                  All chapters and subtopics in this curriculum. Click any topic to open its chat and study accelerator.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                {currentRoadmap.chapters.length} Chapters
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {currentRoadmap.chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 transition-colors hover:border-zinc-700/80"
                >
                  <h3 className="text-xs font-semibold text-zinc-200 font-mono">
                    {chapter.title}
                  </h3>
                  <div className="mt-2.5 space-y-1">
                    {chapter.topics.map((t) => (
                      <Link
                        key={t.id}
                        to={`/topics/${t.id}`}
                        className="group flex items-center justify-between rounded-lg p-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
                      >
                        <span className="truncate font-medium">
                          {t.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                            {t.status === 'solid'
                              ? 'Solid'
                              : t.status === 'learning'
                              ? 'In Progress'
                              : 'Not Started'}
                          </span>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              t.status === 'solid'
                                ? 'bg-emerald-400'
                                : t.status === 'learning'
                                ? 'bg-amber-400'
                                : 'bg-zinc-700'
                            }`}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
