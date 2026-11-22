import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Topic, YouTubeRecommendation } from '../../api/types'
import { api } from '../../api/client'

interface YouTubeViewProps {
  topic: Topic
  chapterTitle?: string
  roadmapTitle?: string
}

function parseYouTubeInput(input: string): { type: 'video'; videoId: string } | { type: 'search'; query: string } {
  const trimmed = input.trim()
  if (!trimmed) return { type: 'search', query: '' }

  // Check for 11-char video ID directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', videoId: trimmed }
  }

  // Check for YouTube URLs (youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...)
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.exec(trimmed)
  if (match) {
    return { type: 'video', videoId: match[1] }
  }

  // Otherwise, treat as search query
  return { type: 'search', query: trimmed }
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  topic,
  chapterTitle,
  roadmapTitle,
}) => {
  const defaultQuery = useMemo(() => {
    const parts = [roadmapTitle, chapterTitle, topic.title, 'tutorial'].filter(Boolean)
    return parts.join(' ')
  }, [roadmapTitle, chapterTitle, topic.title])

  const [activePlayerTarget, setActivePlayerTarget] = useState<{
    type: 'video' | 'search'
    value: string
    title: string
  }>({
    type: 'search',
    value: `${topic.title} tutorial`,
    title: `${topic.title} Tutorial`,
  })

  const [inputVal, setInputVal] = useState('')

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
    staleTime: 1000 * 60 * 30, // 30 mins
  })

  // Handle user submitting search or pasting URL
  const handleLoadTarget = (rawInput: string, title?: string) => {
    const parsed = parseYouTubeInput(rawInput)
    if (parsed.type === 'video') {
      setActivePlayerTarget({
        type: 'video',
        value: parsed.videoId,
        title: title || `YouTube Video (${parsed.videoId})`,
      })
    } else {
      const q = parsed.query || defaultQuery
      setActivePlayerTarget({
        type: 'search',
        value: q,
        title: title || q,
      })
    }
  }

  const handleOpenExternal = () => {
    let url = ''
    if (activePlayerTarget.type === 'video') {
      url = `https://www.youtube.com/watch?v=${activePlayerTarget.value}`
    } else {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(activePlayerTarget.value)}`
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Construct iframe source
  const iframeSrc = activePlayerTarget.type === 'video'
    ? `https://www.youtube-nocookie.com/embed/${activePlayerTarget.value}?autoplay=1&rel=0`
    : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(activePlayerTarget.value)}&rel=0`

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3.5 space-y-3.5 bg-[#0c0c0e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-xs text-red-400">
            ▶
          </span>
          <div>
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              YouTube Player
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px]">
              {topic.title}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenExternal}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
          title="Open in full YouTube tab"
        >
          <span>Open</span>
          <span>↗</span>
        </button>
      </div>

      {/* Hero Small YouTube iFrame Player */}
      <div className="rounded-2xl border border-zinc-800 bg-black overflow-hidden shadow-2xl shrink-0">
        <div className="relative w-full aspect-video bg-zinc-950">
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title={activePlayerTarget.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>

        {/* Player Info Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/80 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
          <span className="truncate pr-2 text-zinc-300">
            {activePlayerTarget.title}
          </span>
          <span className="shrink-0 text-zinc-500">
            {activePlayerTarget.type === 'video' ? 'Direct Video' : 'Search Playlist'}
          </span>
        </div>
      </div>

      {/* Search / Paste URL Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (inputVal.trim()) {
            handleLoadTarget(inputVal.trim())
            setInputVal('')
          }
        }}
        className="relative flex items-center shrink-0"
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Search YouTube or paste URL..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors pr-14"
        />
        <button
          type="submit"
          disabled={!inputVal.trim()}
          className="absolute right-1 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white transition-colors"
        >
          Play
        </button>
      </form>

      {/* Quick Search Chips */}
      <div className="flex flex-wrap gap-1 shrink-0">
        {[
          `${topic.title} tutorial`,
          `${topic.title} visual guide`,
          `${topic.title} crash course`,
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleLoadTarget(chip, chip)}
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ▶ {chip}
          </button>
        ))}
      </div>

      {/* Curated Recommendations Section */}
      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Relatable Lessons
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            {isFetching ? '↻ Fetching...' : '↻ Refresh'}
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-6 text-center space-x-2">
            <div className="h-4 w-4 rounded-full border-2 border-red-500 border-t-white animate-spin" />
            <span className="text-[11px] font-mono text-zinc-500">Curating top lectures...</span>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-2.5 text-[11px] text-zinc-400">
            {error instanceof Error ? error.message : 'Could not fetch suggestions.'}
          </div>
        )}

        {data && (
          <div className="space-y-2">
            {data.videos.map((v: YouTubeRecommendation, idx: number) => {
              const isCurrent =
                (v.video_id && activePlayerTarget.value === v.video_id) ||
                activePlayerTarget.value === v.search_query

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-2.5 transition-all space-y-1.5 ${
                    isCurrent
                      ? 'border-red-500/50 bg-red-950/20'
                      : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h4 className="text-xs font-semibold text-zinc-200 leading-snug line-clamp-2">
                      {v.title}
                    </h4>
                    <span className="shrink-0 rounded bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300">
                      {v.channel_or_creator}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                    {v.why_recommended}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleLoadTarget(
                          v.video_id || v.search_query,
                          v.title
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        isCurrent
                          ? 'bg-red-500/30 text-red-200 border border-red-500/40'
                          : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700/60'
                      }`}
                    >
                      <span>{isCurrent ? '● Now Playing' : '▶ Play Here'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const targetUrl = v.video_id
                          ? `https://www.youtube.com/watch?v=${v.video_id}`
                          : `https://www.youtube.com/results?search_query=${encodeURIComponent(v.search_query)}`
                        window.open(targetUrl, '_blank', 'noopener,noreferrer')
                      }}
                      className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                    >
                      YouTube ↗
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
