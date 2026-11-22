import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Topic, YouTubeVideoItem } from '../../api/types'
import { api } from '../../api/client'

interface YouTubeViewProps {
  topic: Topic
  chapterTitle?: string
  roadmapTitle?: string
  isFloatingMini?: boolean
  shouldShowMini?: boolean
  onExpandToDrawer?: () => void
  onDismissMiniPlayer?: () => void
}

function extractVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.exec(trimmed)
  return match ? match[1] : null
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  topic,
  chapterTitle,
  roadmapTitle,
  isFloatingMini = false,
  shouldShowMini = false,
  onExpandToDrawer,
  onDismissMiniPlayer,
}) => {
  const defaultTopicQuery = useMemo(() => {
    return topic.title.trim()
  }, [topic.title])

  const [searchQuery, setSearchQuery] = useState(defaultTopicQuery)
  const [inputVal, setInputVal] = useState(defaultTopicQuery)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [autoPlay, setAutoPlay] = useState(0)

  // Direct YouTube Search via backend proxy (Zero LLM, 100% Real YouTube results)
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['youtube-direct-search', searchQuery],
    queryFn: () => api.searchYouTube(searchQuery),
    staleTime: 1000 * 60 * 30, // 30 minutes
  })

  // Resolve active video: either user-selected video or the #1 ranked result
  const activeVideo: YouTubeVideoItem | null = useMemo(() => {
    const list = data?.results || []
    if (selectedVideoId) {
      const found = list.find((v) => v.id === selectedVideoId)
      if (found) return found
    }
    return list[0] || null
  }, [selectedVideoId, data?.results])

  const results = data?.results || []

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputVal.trim()
    if (!trimmed) return

    // If user pasted a direct video URL or ID, load that video directly
    const directId = extractVideoId(trimmed)
    if (directId) {
      setSelectedVideoId(directId)
      return
    }

    setSearchQuery(trimmed)
    setSelectedVideoId(null) // reset to pick #1 of new search
  }

  const handleChipClick = (query: string) => {
    setInputVal(query)
    setSearchQuery(query)
    setSelectedVideoId(null)
  }

  const handleOpenExternal = (videoId?: string) => {
    const url = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Quick search variant chips
  const quickSearchFilters = useMemo(() => {
    const title = topic.title.trim()
    return [
      { label: 'Topic', query: title },
      { label: 'Tutorial', query: `${title} tutorial` },
      { label: 'Full Course', query: `${title} full course` },
      ...(chapterTitle ? [{ label: 'Chapter', query: `${chapterTitle} ${title}` }] : []),
      ...(roadmapTitle ? [{ label: 'Roadmap', query: `${roadmapTitle} ${title}` }] : []),
    ]
  }, [topic.title, chapterTitle, roadmapTitle])

  return (
    <div
      className={
        isFloatingMini
          ? (shouldShowMini && activeVideo ? 'contents' : 'hidden')
          : 'flex flex-col h-full overflow-y-auto p-3.5 space-y-3.5 bg-[#0c0c0e]'
      }
    >
      {/* Header (hidden in floating mini mode) */}
      {!isFloatingMini && (
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-xs text-red-400">
              ▶
            </span>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
                YouTube Lessons
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                Live YouTube search • Zero AI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenExternal(activeVideo?.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
            title="Open in YouTube tab"
          >
            <span>YouTube</span>
            <span>↗</span>
          </button>
        </div>
      )}

      {/* Video Player: Persistent across both inline and floating mini modes */}
      <div
        className={
          isFloatingMini
            ? 'fixed bottom-5 right-14 sm:right-16 w-80 sm:w-96 rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl z-40 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200'
            : 'rounded-2xl border border-zinc-800 bg-black overflow-hidden shadow-2xl shrink-0'
        }
      >
        {/* Floating Mini Player Top Bar */}
        {isFloatingMini && (
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 text-[11px] font-mono">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-zinc-200 font-medium truncate">
                {activeVideo?.title || 'YouTube Lesson'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onExpandToDrawer}
                className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 hover:text-white transition-colors cursor-pointer"
                title="Expand to Study Drawer"
              >
                Expand ↗
              </button>
              <button
                type="button"
                onClick={onDismissMiniPlayer}
                className="h-5 w-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs transition-colors cursor-pointer"
                title="Close mini-player"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Video Frame */}
        <div className="relative w-full aspect-video bg-zinc-950">
          {activeVideo ? (
            <iframe
              key={activeVideo.id}
              src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=${autoPlay}&rel=0`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 p-4 text-center">
              {isLoading ? (
                <>
                  <div className="h-6 w-6 rounded-full border-2 border-red-500 border-t-white animate-spin" />
                  <span className="text-xs font-mono text-zinc-400">
                    Searching YouTube for {topic.title}...
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl">📺</span>
                  <span className="text-xs text-zinc-400 font-mono">
                    No videos found. Try a different search below.
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Inline Drawer Player Status Bar */}
        {!isFloatingMini && activeVideo && (
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/90 border-t border-zinc-900 text-[10px] font-mono">
            <div className="truncate pr-2">
              <span className="text-zinc-200 font-medium truncate block">
                {activeVideo.title}
              </span>
              <span className="text-zinc-500">
                {activeVideo.channel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleOpenExternal(activeVideo.id)}
              className="shrink-0 text-red-400 hover:text-red-300 transition-colors ml-2"
            >
              Pop out ↗
            </button>
          </div>
        )}

        {/* Floating Mini Player Footer */}
        {isFloatingMini && activeVideo && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/90 border-t border-zinc-800/80 text-[10px] font-mono">
            <span className="text-zinc-400 truncate max-w-[200px]">
              {activeVideo.channel}
            </span>
            <span className="text-zinc-500 text-[9px]">
              Playing in Mini Player
            </span>
          </div>
        )}
      </div>

      {/* Search Input Bar, Quick Chips, and Results (hidden in floating mini mode) */}
      {!isFloatingMini && (
        <>
          {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center shrink-0">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Search YouTube or paste URL..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors pr-16"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {inputVal !== defaultTopicQuery && (
            <button
              type="button"
              onClick={() => {
                setInputVal(defaultTopicQuery)
                setSearchQuery(defaultTopicQuery)
                setSelectedVideoId(null)
              }}
              className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 px-1"
              title="Reset to topic title"
            >
              Reset
            </button>
          )}
          <button
            type="submit"
            className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Search
          </button>
        </div>
      </form>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {quickSearchFilters.map((filter) => {
          const isActive = searchQuery === filter.query
          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => handleChipClick(filter.query)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-mono transition-all ${
                isActive
                  ? 'bg-red-500/20 border border-red-500/50 text-red-300 font-semibold shadow-xs'
                  : 'border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ▶ {filter.label}
            </button>
          )
        })}
      </div>

      {/* Live YouTube Results List */}
      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span>Results for "{searchQuery}"</span>
          <div className="flex items-center gap-2">
            {isFetching && (
              <span className="text-zinc-500 animate-pulse">Refreshing...</span>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ↻
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-2 pt-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-2.5 flex gap-2.5 animate-pulse"
              >
                <div className="w-20 h-12 rounded-lg bg-zinc-800/60 shrink-0" />
                <div className="flex-1 space-y-1.5 py-1">
                  <div className="h-2.5 w-3/4 rounded bg-zinc-800/60" />
                  <div className="h-2 w-1/2 rounded bg-zinc-800/40" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-3 text-xs text-rose-300 space-y-1.5">
            <p className="font-mono text-[11px]">Could not load YouTube results.</p>
            <p className="text-[10px] text-zinc-400">
              {error instanceof Error ? error.message : 'Network error'}
            </p>
            <button
              type="button"
              onClick={() => handleOpenExternal()}
              className="text-[11px] text-red-400 hover:underline font-mono block pt-1"
            >
              Search directly on YouTube.com ↗
            </button>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((video) => {
              const isSelected = activeVideo?.id === video.id

              return (
                <div
                  key={video.id}
                  onClick={() => {
                    setSelectedVideoId(video.id)
                    setAutoPlay(1)
                  }}
                  className={`group rounded-xl border p-2 flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-red-500/60 bg-red-950/20 ring-1 ring-red-500/30'
                      : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  {/* Video Thumbnail */}
                  <div className="relative w-22 h-13 rounded-lg overflow-hidden bg-black shrink-0 border border-zinc-800">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    {video.duration && (
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.2 text-[8px] font-mono text-white">
                        {video.duration}
                      </span>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[9px]">
                          ▶
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0 pr-1">
                    <h4
                      className={`text-xs font-medium leading-snug line-clamp-2 ${
                        isSelected ? 'text-red-200 font-semibold' : 'text-zinc-200 group-hover:text-white'
                      }`}
                    >
                      {video.title}
                    </h4>
                    <span className="text-[10px] text-zinc-500 truncate block mt-0.5 font-mono">
                      {video.channel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )}
</div>
)
}
