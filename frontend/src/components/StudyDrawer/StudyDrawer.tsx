import React from 'react'
import type { Topic } from '../../api/types'
import { FeynmanView } from './FeynmanView'
import { QuizView } from './QuizView'
import { CopilotView } from './CopilotView'
import { DiagramView } from './DiagramView'
import { YouTubeView } from './YouTubeView'

export type TabType = 'feynman' | 'quiz' | 'copilot' | 'diagram' | 'youtube'

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
  return (
    <div className="relative flex h-full shrink-0">
      {/* Drawer Panel */}
      {isOpen && (
        <aside
          className="flex flex-col w-[340px] sm:w-[420px] h-full border-l border-zinc-800 bg-[#0c0c0e] shadow-2xl z-20 animate-in slide-in-from-right-4 duration-200"
          aria-label="Study Accelerator Drawer"
        >
          {/* Drawer Top Navigation Bar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-zinc-950/40">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => onTabChange('feynman')}
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
                onClick={() => onTabChange('quiz')}
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
                onClick={() => onTabChange('copilot')}
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
                onClick={() => onTabChange('diagram')}
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
                onClick={() => onTabChange('youtube')}
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

            <button
              type="button"
              onClick={() => onToggleOpen()}
              className="h-6 w-6 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center text-xs transition-colors shrink-0 ml-1"
              title="Close drawer"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'feynman' && <FeynmanView topic={topic} />}
            {activeTab === 'quiz' && <QuizView topic={topic} />}
            {activeTab === 'copilot' && <CopilotView />}
            {activeTab === 'diagram' && (
              <DiagramView code={diagramCode} onClear={onClearDiagram} />
            )}
            {activeTab === 'youtube' && (
              <YouTubeView
                key={topic.id}
                topic={topic}
                chapterTitle={chapterTitle}
                roadmapTitle={roadmapTitle}
              />
            )}
          </div>
        </aside>
      )}

      {/* Docked Icon Strip */}
      <div className="flex flex-col items-center py-3 px-1 border-l border-zinc-800/80 bg-[#09090b] space-y-2 z-10">
        <button
          type="button"
          onClick={() => onToggleOpen('feynman')}
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
          onClick={() => onToggleOpen('quiz')}
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
          onClick={() => onToggleOpen('copilot')}
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
          onClick={() => onToggleOpen('diagram')}
          className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'diagram'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Flowchart & Diagram Canvas"
        >
          📊
          {diagramCode && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onToggleOpen('youtube')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm transition-all ${
            isOpen && activeTab === 'youtube'
              ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Related YouTube Videos & Lectures"
        >
          ▶️
        </button>
      </div>
    </div>
  )
}
