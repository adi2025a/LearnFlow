import React, { useMemo, useState } from 'react'
import type { Topic } from '../../api/types'

interface YouTubeViewProps {
  topic: Topic
  chapterTitle?: string
  roadmapTitle?: string
}

function parseYouTubeInput(input: string): { type: 'video'; videoId: string } | { type: 'search'; query: string } {
  const trimmed = input.trim()
  if (!trimmed) return { type: 'search', query: '' }

  // 11-char direct video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', videoId: trimmed }
  }

  // YouTube URLs (watch?v=, embed/, youtu.be/, shorts/)
  const match = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.exec(trimmed)
  if (match) {
    return { type: 'video', videoId: match[1] }
  }

  // Otherwise, search query
  return { type: 'search', query: trimmed }
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({
  topic,
  chapterTitle,
  roadmapTitle,
}) => {
  // Compute default search based on current topic
  const defaultTopicQuery = useMemo(() => {
    return topic.title.trim()
  }, [topic.title])

  const [searchQuery, setSearchQuery] = useState(defaultTopicQuery)
  const [activePlayerTarget, setActivePlayerTarget] = useState<{
    type: 'video' | 'search'
    value: string
    label: string
  }>({
    type: 'search',
    value: defaultTopicQuery,
    label: defaultTopicQuery,
  })

  const handleApplySearch = (rawInput: string, customLabel?: string) => {
    const parsed = parseYouTubeInput(rawInput)
    if (parsed.type === 'video') {
      setActivePlayerTarget({
        type: 'video',
        value: parsed.videoId,
        label: customLabel || `Video (${parsed.videoId})`,
      })
    } else {
      const q = parsed.query || defaultTopicQuery
      setSearchQuery(q)
      setActivePlayerTarget({
        type: 'search',
        value: q,
        label: customLabel || q,
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

  // Build the live iframe source URL
  const iframeSrc = activePlayerTarget.type === 'video'
    ? `https://www.youtube-nocookie.com/embed/${activePlayerTarget.value}?autoplay=1&rel=0`
    : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(activePlayerTarget.value)}&rel=0`

  // Quick search variant chips
  const quickSearchFilters = useMemo(() => {
    const title = topic.title.trim()
    return [
      { label: 'Exact Topic', query: title },
      { label: 'Tutorial', query: `${title} tutorial` },
      { label: 'Visual Guide', query: `${title} visual animation` },
      ...(chapterTitle ? [{ label: 'Chapter Context', query: `${chapterTitle} ${title}` }] : []),
      ...(roadmapTitle ? [{ label: 'Full Course', query: `${roadmapTitle} ${title} course` }] : []),
    ]
  }, [topic.title, chapterTitle, roadmapTitle])

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-[#0c0c0e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-950/60 border border-red-800/40 text-xs text-red-400">
            ▶
          </span>
          <div>
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              YouTube Search
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">Direct YouTube video player</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenExternal}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
          title="Open results directly on YouTube.com"
        >
          <span>YouTube</span>
          <span>↗</span>
        </button>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (searchQuery.trim()) {
            handleApplySearch(searchQuery.trim())
          }
        }}
        className="relative flex items-center shrink-0"
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search YouTube or paste URL..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors pr-16"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {searchQuery !== defaultTopicQuery && (
            <button
              type="button"
              onClick={() => handleApplySearch(defaultTopicQuery)}
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

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {quickSearchFilters.map((filter) => {
          const isActive =
            activePlayerTarget.type === 'search' &&
            activePlayerTarget.value === filter.query

          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => handleApplySearch(filter.query, filter.label)}
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

      {/* Compact YouTube Player Canvas */}
      <div className="rounded-2xl border border-zinc-800 bg-black overflow-hidden shadow-2xl shrink-0">
        <div className="relative w-full aspect-video bg-zinc-950">
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title={activePlayerTarget.label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>

        {/* Player Status Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/90 border-t border-zinc-900 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 truncate pr-2 text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="truncate">{activePlayerTarget.label}</span>
          </div>

          <span className="shrink-0 text-zinc-500">
            {activePlayerTarget.type === 'video' ? 'Direct Video' : 'YouTube Live Playlist'}
          </span>
        </div>
      </div>

      {/* Helpful Controls & Instructions Box */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3 space-y-2 text-xs text-zinc-400 shrink-0">
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          <span className="text-sm">💡</span>
          <span>Browsing Search Results</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">
          This player directly queries YouTube for <strong className="text-zinc-200">{topic.title}</strong>. Click the <span className="text-zinc-200 font-mono">playlist icon</span> inside the top-right of the player to browse and switch between all videos returned by YouTube.
        </p>
        <div className="pt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={handleOpenExternal}
            className="text-[11px] text-red-400 hover:text-red-300 hover:underline font-mono"
          >
            Open in Full YouTube Tab →
          </button>
          <span className="text-[10px] text-zinc-500 font-mono">Zero AI • 100% Native</span>
        </div>
      </div>
    </div>
  )
}
