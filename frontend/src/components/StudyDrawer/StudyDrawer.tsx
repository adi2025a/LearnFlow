import React, { useEffect, useRef, useState } from 'react'
import type { Topic } from '../../api/types'
import { FeynmanView } from './FeynmanView'
import { QuizView } from './QuizView'
import { CopilotView } from './CopilotView'
import { DiagramView } from './DiagramView'
import { YouTubeView } from './YouTubeView'

export type TabType = 'feynman' | 'quiz' | 'copilot' | 'diagram' | 'youtube'

const STORAGE_KEY = 'learnflow_study_drawer_width'
const DEFAULT_WIDTH = 440
const MIN_WIDTH = 340

function getInitialWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= MIN_WIDTH) {
        return Math.min(parsed, Math.floor(window.innerWidth * 0.55))
      }
    }
  } catch {}
  return DEFAULT_WIDTH
}

interface StudyDrawerProps {
  topic: Topic
  isOpen: boolean
  onToggleOpen: (tab?: TabType) => void
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  diagramCode?: string | null
  onClearDiagram?: () => void
  chapterTitle?: string
  roadmapTitle?: string
}

export const StudyDrawer: React.FC<StudyDrawerProps> = ({
  topic,
  isOpen,
  onToggleOpen,
  activeTab,
  onTabChange,
  diagramCode = null,
  onClearDiagram,
  chapterTitle,
  roadmapTitle,
}) => {
  const [drawerWidth, setDrawerWidth] = useState<number>(getInitialWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef<number>(0)
  const dragStartWidthRef = useRef<number>(DEFAULT_WIDTH)

  // Floating mini-player states
  const [hasOpenedYouTube, setHasOpenedYouTube] = useState(false)
  const [isMiniDismissed, setIsMiniDismissed] = useState(false)

  // Reset mini-player state on topic change
  const [prevTopicId, setPrevTopicId] = useState(topic.id)
  if (prevTopicId !== topic.id) {
    setPrevTopicId(topic.id)
    setHasOpenedYouTube(false)
    setIsMiniDismissed(false)
  }

  // Handle switching tabs and activating YouTube
  const handleTabClick = (tab: TabType) => {
    if (tab === 'youtube') {
      setHasOpenedYouTube(true)
      setIsMiniDismissed(false)
    }
    onTabChange(tab)
  }

  // Handle docked icon strip toggle
  const handleToggle = (tab?: TabType) => {
    if (tab === 'youtube') {
      setHasOpenedYouTube(true)
      setIsMiniDismissed(false)
    }
    onToggleOpen(tab)
  }

  // Mini-player actions
  const handleExpandMiniPlayer = () => {
    setHasOpenedYouTube(true)
    setIsMiniDismissed(false)
    onTabChange('youtube')
    if (!isOpen) {
      onToggleOpen('youtube')
    }
  }

  const handleDismissMiniPlayer = () => {
    setIsMiniDismissed(true)
  }

  const isFloatingMini = activeTab !== 'youtube' || !isOpen
  const shouldShowMini = isFloatingMini && hasOpenedYouTube && !isMiniDismissed

  // Start dragging handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = drawerWidth
  }

  // Double-click resets back to default width
  const handleResetWidth = () => {
    setDrawerWidth(DEFAULT_WIDTH)
  }

  // Toggle 50/50 split screen shortcut
  const handleToggleSplit = () => {
    const halfWidth = Math.floor(window.innerWidth * 0.5)
    setDrawerWidth((prev) => (prev >= halfWidth - 25 ? DEFAULT_WIDTH : halfWidth))
  }

  // Mouse move and mouse up listeners for smooth resizing across the entire screen
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartXRef.current - e.clientX
      const maxWidth = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.55))
      const rawWidth = dragStartWidthRef.current + delta
      const clamped = Math.min(maxWidth, Math.max(MIN_WIDTH, rawWidth))
      setDrawerWidth(clamped)
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

  // Persist chosen drawer width to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, drawerWidth.toString())
    } catch {}
  }, [drawerWidth])

  // Adjust width if window is resized smaller than current drawer width
  useEffect(() => {
    const handleWindowResize = () => {
      const maxWidth = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.55))
      setDrawerWidth((prev) => Math.min(prev, maxWidth))
    }
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  return (
    <div className="relative flex h-full shrink-0">
      {/* Invisible global overlay while dragging to prevent iframes from stealing mouse events */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize select-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        />
      )}

      {/* Drawer Panel */}
      <aside
        style={{ width: isOpen ? `${drawerWidth}px` : '0px' }}
        className={`relative flex flex-col h-full border-zinc-800 shadow-2xl z-20 ${
          isOpen ? 'border-l bg-[#0c0c0e]' : 'border-l-0 bg-transparent shadow-none overflow-visible pointer-events-none'
        } ${
          isDragging ? 'select-none transition-none' : 'animate-in slide-in-from-right-4 duration-200'
        }`}
        aria-label="Study Accelerator Drawer"
      >
        {isOpen && (
          <>
            {/* Vertical Draggable Border Handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={handleMouseDown}
              onDoubleClick={handleResetWidth}
              className="absolute -left-2 top-0 bottom-0 w-4 cursor-col-resize z-40 group flex items-center justify-center select-none"
              title="Drag to resize drawer (Double click to reset to 440px)"
            >
              {/* Visual dividing line with hover and drag glow */}
              <div
                className={`h-full w-[2px] transition-colors ${
                  isDragging
                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                    : 'bg-zinc-800/80 group-hover:bg-emerald-500'
                }`}
              />

              {/* Tactile 3-dot grip pill in center - ALWAYS visible so user sees it can be resized */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1 rounded-full border px-0.5 py-2.5 transition-all shadow-md ${
                  isDragging
                    ? 'border-emerald-500 bg-zinc-900 text-emerald-400 scale-110 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 group-hover:border-emerald-500 group-hover:text-emerald-400'
                }`}
              >
                <span className="w-0.5 h-1 rounded-full bg-current" />
                <span className="w-0.5 h-1 rounded-full bg-current" />
                <span className="w-0.5 h-1 rounded-full bg-current" />
              </div>

              {/* Live Width Indicator Tooltip while dragging */}
              {isDragging && (
                <div className="absolute top-4 -left-3 -translate-x-full px-2.5 py-1 rounded-md bg-zinc-900/95 border border-zinc-700 text-[11px] font-mono text-zinc-100 shadow-2xl pointer-events-none whitespace-nowrap backdrop-blur-md">
                  {drawerWidth}px {drawerWidth >= Math.floor(window.innerWidth * 0.48) ? '(50/50 Split)' : ''}
                </div>
              )}
            </div>

            {/* Drawer Top Navigation Bar */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleTabClick('feynman')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-colors shrink-0 ${
                    activeTab === 'feynman'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>✍️</span>
                  <span>Feynman</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('quiz')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-colors shrink-0 ${
                    activeTab === 'quiz'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>📝</span>
                  <span>Quiz</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('copilot')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-colors shrink-0 ${
                    activeTab === 'copilot'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>⚡</span>
                  <span>Copilot</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('diagram')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-colors shrink-0 ${
                    activeTab === 'diagram'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>📊</span>
                  <span>Diagram</span>
                  {diagramCode && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('youtube')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-colors shrink-0 ${
                    activeTab === 'youtube'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>▶️</span>
                  <span>Videos</span>
                </button>
              </div>

              <div className="flex items-center gap-1 ml-1 shrink-0">
                {/* Quick 50/50 Split toggle button */}
                <button
                  type="button"
                  onClick={handleToggleSplit}
                  className="h-6 px-1.5 rounded-lg text-[10px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center transition-colors"
                  title={drawerWidth >= Math.floor(window.innerWidth * 0.48) ? 'Reset to default width' : 'Expand to 50/50 split screen'}
                >
                  {drawerWidth >= Math.floor(window.innerWidth * 0.48) ? '440px' : '50/50'}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleOpen()}
                  className="h-6 w-6 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center text-xs transition-colors"
                  title="Close drawer"
                >
                  ✕
                </button>
              </div>
            </div>
          </>
        )}

        {/* Drawer Body Content */}
        <div className={`flex-1 relative ${isOpen ? 'overflow-hidden' : 'overflow-visible'}`}>
          {isOpen && activeTab === 'feynman' && <FeynmanView topic={topic} />}
          {isOpen && activeTab === 'quiz' && <QuizView topic={topic} />}
          {isOpen && activeTab === 'copilot' && <CopilotView />}
          {isOpen && activeTab === 'diagram' && (
            <DiagramView code={diagramCode} onClear={onClearDiagram} />
          )}

          {/* Persistent YouTube Component across inline drawer and floating mini-player */}
          <div className={activeTab === 'youtube' && isOpen ? 'h-full' : 'contents pointer-events-auto'}>
            <YouTubeView
              key={topic.id}
              topic={topic}
              chapterTitle={chapterTitle}
              roadmapTitle={roadmapTitle}
              isFloatingMini={isFloatingMini}
              shouldShowMini={shouldShowMini}
              onExpandToDrawer={handleExpandMiniPlayer}
              onDismissMiniPlayer={handleDismissMiniPlayer}
            />
          </div>
        </div>
      </aside>

      {/* Docked Icon Strip */}
      <div className="flex flex-col items-center py-3 px-1 border-l border-zinc-800/80 bg-[#09090b] space-y-2 z-10">
        <button
          type="button"
          onClick={() => handleToggle('feynman')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'feynman'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Feynman Review (Explain in your own words)"
        >
          ✍️
        </button>

        <button
          type="button"
          onClick={() => handleToggle('quiz')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'quiz'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Concept MCQ Quiz"
        >
          📝
        </button>

        <button
          type="button"
          onClick={() => handleToggle('copilot')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'copilot'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Direct Copilot (Zero-context scratchpad)"
        >
          ⚡
        </button>

        <button
          type="button"
          onClick={() => handleToggle('diagram')}
          className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'diagram'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Flowchart & Diagram Canvas"
        >
          <span>📊</span>
          {diagramCode && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleToggle('youtube')}
          className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'youtube'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Related YouTube Videos & Lectures"
        >
          <span>▶️</span>
          {shouldShowMini && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </div>
    </div>
  )
}
