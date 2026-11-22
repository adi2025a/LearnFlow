import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Topic, YouTubeRecommendation } from '../../api/types'
import { api } from '../../api/client'

interface YouTubeViewProps {
  topic: Topic
  chapterTitle?: string
  roadmapTitle?: string
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  topic,
  chapterTitle,
  roadmapTitle,
}) => {
  const [activeVideo, setActiveVideo] = useState<YouTubeRecommendation | null>(null)
  const [customSearch, setCustomSearch] = useState('')

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['topic-videos', topic.id],
    queryFn: () => api.getTopicVideos(topic.id),
    staleTime: 1000 * 60 * 30, // 30 minutes
  })

  const defaultSearchQuery = `${roadmapTitle ? roadmapTitle + ' ' : ''}${chapterTitle ? chapterTitle + ' ' : ''}${topic.title} tutorial`

  const handleOpenYouTubeSearch = (query: string) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handlePlayVideo = (video: YouTubeRecommendation) => {
    if (video.video_id) {
      setActiveVideo(video)
    } else {
      handleOpenYouTubeSearch(video.search_query)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-[#0c0c0e]">
      {/* Header Bar */}
      <div className="border-b border-zinc-800 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-xs text-red-400">
              ▶
            </span>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                YouTube Lessons
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">Curated video lectures & walkthroughs</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
            title="Refresh recommendations"
          >
            {isFetching ? '↻ Fetching...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Embedded In-Drawer Video Player */}
      {activeVideo?.video_id && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 overflow-hidden shadow-xl animate-in fade-in duration-200 shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/40">
            <span className="text-[11px] font-medium text-zinc-200 truncate pr-2">
              {activeVideo.title}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://www.youtube.com/watch?v=${activeVideo.video_id}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
                className="text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
                title="Open in new tab"
              >
                Open ↗
              </button>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="h-5 w-5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center text-xs transition-colors"
                title="Close player"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="relative w-full aspect-video bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${activeVideo.video_id}?autoplay=1&rel=0`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center space-y-3">
          <div className="h-6 w-6 rounded-full border-2 border-red-500 border-t-white animate-spin" />
          <p className="text-xs text-zinc-400 font-mono">Finding the best tutorials & lectures...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 text-xs text-rose-300 space-y-2">
          <div className="font-semibold font-mono text-[11px] flex items-center gap-1.5">
            <span>✕</span>
            <span>Failed to load video recommendations</span>
          </div>
          <p className="text-[11px] text-rose-400">
            {error instanceof Error ? error.message : 'Please try again later.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recommended Videos List */}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Recommended for {topic.title}</span>
            <span>{data.videos.length} videos</span>
          </div>

          <div className="space-y-2.5">
            {data.videos.map((v, idx) => {
              const isPlaying = activeVideo?.video_id === v.video_id && Boolean(v.video_id)

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 transition-all space-y-2 ${
                    isPlaying
                      ? 'border-red-500/50 bg-red-950/10'
                      : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-zinc-100 leading-snug">
                      {v.title}
                    </h4>
                    <span className="shrink-0 rounded-md bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                      {v.channel_or_creator}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {v.why_recommended}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => handlePlayVideo(v)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        v.video_id
                          ? 'bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30'
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                      }`}
                    >
                      <span>{v.video_id ? '▶ Play In Drawer' : '🔍 Find on YouTube'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenYouTubeSearch(v.search_query)}
                      className="text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
                      title="Search directly on YouTube"
                    >
                      Open YouTube ↗
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Targeted Search Chips */}
          {data.recommended_search_queries.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                Suggested Search Queries
              </span>
              <div className="flex flex-wrap gap-1.5">
                {data.recommended_search_queries.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenYouTubeSearch(q)}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                  >
                    🔍 {q} ↗
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Quick Search Footer */}
      <div className="pt-3 border-t border-zinc-800/80 mt-auto shrink-0 space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 font-mono">
          Direct YouTube Search
        </span>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const query = customSearch.trim() || defaultSearchQuery
            handleOpenYouTubeSearch(query)
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
            placeholder={defaultSearchQuery}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors pr-16"
          />
          <button
            type="submit"
            className="absolute right-1.5 rounded-lg bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
          >
            Search ↗
          </button>
        </form>
      </div>
    </div>
  )
}
