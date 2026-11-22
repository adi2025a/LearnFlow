import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Chapter, RoadmapTree, Topic, TopicStatus } from '../../api/types'
import { api } from '../../api/client'

const SIDEBAR_STORAGE_KEY = 'learnflow_sidebar_width'
const DEFAULT_SIDEBAR_WIDTH = 280
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 480

function getInitialSidebarWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH
  try {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        return parsed
      }
    }
  } catch {}
  return DEFAULT_SIDEBAR_WIDTH
}

interface SidebarProps {
  roadmap: RoadmapTree | null
  roadmaps: { id: string; title: string }[]
  onOpenNewRoadmap: () => void
  onOpenSearch: () => void
  isOpen: boolean
  onClose: () => void
}

const STATUS_CONFIG: Record<TopicStatus, { label: string; dotClass: string; next: TopicStatus }> = {
  not_started: {
    label: 'Not Started',
    dotClass: 'bg-zinc-700 hover:bg-zinc-600',
    next: 'learning',
  },
  learning: {
    label: 'In Progress',
    dotClass: 'bg-amber-400 ring-2 ring-amber-400/20',
    next: 'solid',
  },
  solid: {
    label: 'Solid',
    dotClass: 'bg-emerald-400 ring-2 ring-emerald-400/20',
    next: 'not_started',
  },
}

export const Sidebar: React.FC<SidebarProps> = ({
  roadmap,
  roadmaps,
  onOpenNewRoadmap,
  onOpenSearch,
  isOpen,
  onClose,
}) => {
  const { topicId } = useParams<{ topicId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [addingChapter, setAddingChapter] = useState(false)
  const [addingTopicChapterId, setAddingTopicChapterId] = useState<string | null>(null)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingChapterTitle, setEditingChapterTitle] = useState('')
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [editingTopicTitle, setEditingTopicTitle] = useState('')

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState<number>(getInitialSidebarWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const dragStartWidthRef = useRef<number>(DEFAULT_SIDEBAR_WIDTH)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = sidebarWidth
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartXRef.current
      const rawWidth = dragStartWidthRef.current + delta
      const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, rawWidth))
      setSidebarWidth(clamped)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarWidth.toString())
    } catch {}
  }, [sidebarWidth])

  // Mutations
  const updateTopicMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Topic> }) =>
      api.updateTopic(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', roadmap?.id] })
    },
  })

  const createChapterMutation = useMutation({
    mutationFn: (title: string) => {
      if (!roadmap) throw new Error('No roadmap selected')
      return api.createChapter(roadmap.id, { title })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', roadmap?.id] })
      setNewChapterTitle('')
      setAddingChapter(false)
    },
  })

  const updateChapterMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.updateChapter(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', roadmap?.id] })
      setEditingChapterId(null)
    },
  })

  const deleteChapterMutation = useMutation({
    mutationFn: (id: string) => api.deleteChapter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', roadmap?.id] })
    },
  })

  const createTopicMutation = useMutation({
    mutationFn: ({ chapterId, title }: { chapterId: string; title: string }) =>
      api.createTopic(chapterId, { title }),
    onSuccess: (newTopic) => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', roadmap?.id] })
      setAddingTopicChapterId(null)
      setNewTopicTitle('')
      navigate(`/topics/${newTopic.id}`)
    },
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (id: string) => api.deleteTopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', roadmap?.id] })
      if (topicId) {
        navigate('/')
      }
    },
  })

  const handleStatusCycle = (e: React.MouseEvent, topic: Topic) => {
    e.preventDefault()
    e.stopPropagation()
    const nextStatus = STATUS_CONFIG[topic.status].next
    updateTopicMutation.mutate({
      id: topic.id,
      data: { status: nextStatus },
    })
  }

  return (
    <>
      {/* Invisible global overlay during active dragging */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize select-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        />
      )}

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`relative fixed inset-y-0 left-0 z-30 flex flex-col border-r border-zinc-800/80 bg-[#0c0c0e] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isDragging ? 'select-none transition-none' : ''}`}
      >
        {/* Vertical Draggable Border Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          className="hidden lg:flex absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize z-40 group items-center justify-center select-none"
          title="Drag to resize sidebar (Double click to reset to 280px)"
        >
          {/* Dividing line with hover and drag glow */}
          <div
            className={`h-full w-[2px] transition-colors ${
              isDragging
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                : 'bg-zinc-800/80 group-hover:bg-emerald-500'
            }`}
          />

          {/* Tactile 3-dot grip pill */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1 rounded-full border px-0.5 py-2.5 transition-all shadow-md ${
              isDragging
                ? 'border-emerald-500 bg-zinc-900 text-emerald-400 scale-110 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:border-emerald-500 group-hover:text-emerald-400'
            }`}
          >
            <span className="w-0.5 h-1 rounded-full bg-current" />
            <span className="w-0.5 h-1 rounded-full bg-current" />
            <span className="w-0.5 h-1 rounded-full bg-current" />
          </div>

          {/* Width indicator tooltip */}
          {isDragging && (
            <div className="absolute top-4 left-4 px-2 py-0.5 rounded-md bg-zinc-900/95 border border-zinc-700 text-[10px] font-mono text-zinc-100 shadow-xl pointer-events-none whitespace-nowrap backdrop-blur-md">
              {sidebarWidth}px
            </div>
          )}
        </div>
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800/80 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-white tracking-tight text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-[11px] font-mono font-bold text-zinc-100 border border-zinc-700/60">
              LF
            </div>
            <span>LearnFlow</span>
          </Link>

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
            title="Search messages (Ctrl+K)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="font-mono text-[10px] hidden sm:inline">Ctrl K</span>
          </button>
        </div>

        {/* Roadmap selector */}
        <div className="border-b border-zinc-800/80 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 font-mono">
              Roadmap
            </span>
            <button
              type="button"
              onClick={onOpenNewRoadmap}
              className="text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              + New
            </button>
          </div>

          {roadmaps.length > 0 ? (
            <select
              aria-label="Select roadmap"
              value={roadmap?.id || ''}
              onChange={(e) => {
                if (e.target.value) {
                  navigate(`/roadmaps/${e.target.value}`)
                }
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 focus:border-zinc-700 focus:outline-none cursor-pointer"
            >
              {roadmaps.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-zinc-500">No roadmaps created yet</div>
          )}

          {roadmap && (
            <p className="mt-1.5 line-clamp-2 text-[11px] text-zinc-400 leading-snug">
              {roadmap.goal}
            </p>
          )}
        </div>

        {/* Chapters & Topics Tree */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {roadmap ? (
            <div className="space-y-4">
              {roadmap.chapters.map((chapter: Chapter) => (
                <div key={chapter.id} className="space-y-1">
                  {/* Chapter Header */}
                  <div className="group flex items-center justify-between rounded-md px-2 py-1 hover:bg-zinc-900/60 transition-colors">
                    {editingChapterId === chapter.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (editingChapterTitle.trim()) {
                            updateChapterMutation.mutate({
                              id: chapter.id,
                              title: editingChapterTitle.trim(),
                            })
                          }
                        }}
                        className="flex flex-1 items-center gap-1"
                      >
                        <input
                          type="text"
                          value={editingChapterTitle}
                          onChange={(e) => setEditingChapterTitle(e.target.value)}
                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                          onBlur={() => setEditingChapterId(null)}
                        />
                      </form>
                    ) : (
                      <span className="text-xs font-medium text-zinc-300 truncate">
                        {chapter.title}
                      </span>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTopicChapterId(chapter.id)
                          setNewTopicTitle('')
                        }}
                        className="p-1 text-zinc-500 hover:text-zinc-200"
                        title="Add topic"
                        aria-label="Add topic"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingChapterId(chapter.id)
                          setEditingChapterTitle(chapter.title)
                        }}
                        className="p-1 text-zinc-500 hover:text-zinc-200"
                        title="Rename chapter"
                        aria-label="Rename chapter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete chapter "${chapter.title}" and its topics?`)) {
                            deleteChapterMutation.mutate(chapter.id)
                          }
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400"
                        title="Delete chapter"
                        aria-label="Delete chapter"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Topics List */}
                  <div className="space-y-0.5 pl-2">
                    {chapter.topics.map((topic: Topic) => {
                      const isActive = topic.id === topicId
                      const statusInfo = STATUS_CONFIG[topic.status]

                      return (
                        <div
                          key={topic.id}
                          className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                            isActive
                              ? 'bg-zinc-800 text-white font-medium shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-2 overflow-hidden">
                            {/* Status Dot */}
                            <button
                              type="button"
                              onClick={(e) => handleStatusCycle(e, topic)}
                              title={`Status: ${statusInfo.label} (Click to toggle)`}
                              aria-label={`Status: ${statusInfo.label} (Click to toggle)`}
                              className={`h-2 w-2 shrink-0 rounded-full transition-transform hover:scale-125 ${statusInfo.dotClass}`}
                            />

                            {editingTopicId === topic.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  if (editingTopicTitle.trim()) {
                                    updateTopicMutation.mutate({
                                      id: topic.id,
                                      data: { title: editingTopicTitle.trim() },
                                    })
                                    setEditingTopicId(null)
                                  }
                                }}
                                className="flex-1"
                              >
                                <input
                                  type="text"
                                  value={editingTopicTitle}
                                  onChange={(e) => setEditingTopicTitle(e.target.value)}
                                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-white focus:outline-none"
                                  autoFocus
                                  onBlur={() => setEditingTopicId(null)}
                                />
                              </form>
                            ) : (
                              <Link
                                to={`/topics/${topic.id}`}
                                onClick={onClose}
                                className="truncate flex-1"
                              >
                                {topic.title}
                              </Link>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTopicId(topic.id)
                                setEditingTopicTitle(topic.title)
                              }}
                              className="p-1 text-zinc-500 hover:text-zinc-200"
                              title="Rename topic"
                              aria-label="Rename topic"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete topic "${topic.title}"?`)) {
                                  deleteTopicMutation.mutate(topic.id)
                                }
                              }}
                              className="p-1 text-zinc-500 hover:text-rose-400"
                              title="Delete topic"
                              aria-label="Delete topic"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add topic form under chapter */}
                    {addingTopicChapterId === chapter.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (newTopicTitle.trim()) {
                            createTopicMutation.mutate({
                              chapterId: chapter.id,
                              title: newTopicTitle.trim(),
                            })
                          }
                        }}
                        className="mt-1 flex items-center gap-1.5 px-1"
                      >
                        <input
                          type="text"
                          placeholder="Topic title..."
                          value={newTopicTitle}
                          onChange={(e) => setNewTopicTitle(e.target.value)}
                          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!newTopicTitle.trim()}
                          className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingTopicChapterId(null)}
                          className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
                        >
                          ✕
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Chapter Button / Form */}
              {addingChapter ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (newChapterTitle.trim()) {
                      createChapterMutation.mutate(newChapterTitle.trim())
                    }
                  }}
                  className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5"
                >
                  <input
                    type="text"
                    placeholder="Chapter title..."
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAddingChapter(false)}
                      className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newChapterTitle.trim()}
                      className="rounded bg-white px-2.5 py-0.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingChapter(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-800 py-2 text-xs font-medium text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
                >
                  + Add Chapter
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <p className="text-xs text-zinc-500">Select or create a roadmap</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
