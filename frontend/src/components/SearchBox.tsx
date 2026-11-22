import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { SearchResult } from '../api/types'

interface SearchBoxProps {
  isOpen: boolean
  onClose: () => void
}

export const SearchBox: React.FC<SearchBoxProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 200)
    return () => clearTimeout(handler)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  })

  if (!isOpen) return null

  const handleSelectResult = (result: SearchResult) => {
    navigate(`/topics/${result.topic_id}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#09090b] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-zinc-800 px-4 py-3.5">
          <svg className="w-4 h-4 text-zinc-500 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes across all topics..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
          <kbd className="ml-3 hidden sm:inline-block rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            </div>
          ) : debouncedQuery && results.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No results found for &ldquo;{debouncedQuery}&rdquo;
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((res: SearchResult) => (
                <button
                  type="button"
                  key={res.message_id}
                  onClick={() => handleSelectResult(res)}
                  className="flex w-full flex-col items-start rounded-xl p-3 text-left transition-colors hover:bg-zinc-850/70"
                >
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                    <span className="truncate max-w-[120px]">{res.roadmap_title}</span>
                    <span>/</span>
                    <span className="truncate max-w-[120px]">{res.chapter_title}</span>
                    <span>/</span>
                    <span className="font-semibold text-zinc-200">
                      {res.topic_title}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed [&>b]:text-white [&>b]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: res.snippet }}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-zinc-600">
              Type keywords to search across your past answers and explanations.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
