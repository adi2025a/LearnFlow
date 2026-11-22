import React, { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Message as MessageType, Topic, TopicStatus } from '../../api/types'
import { api } from '../../api/client'
import { streamChat } from '../../api/chat'
import { Message } from '../Message'
import { StudyDrawer, type TabType } from '../StudyDrawer/StudyDrawer'

interface ChatViewProps {
  topic: Topic
  chapterTitle?: string
  roadmapTitle?: string
}

export const ChatView: React.FC<ChatViewProps> = ({
  topic,
  chapterTitle,
  roadmapTitle,
}) => {
  const queryClient = useQueryClient()
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamError, setStreamError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('feynman')
  const [activeDiagram, setActiveDiagram] = useState<string | null>(null)

  const handleToggleDrawer = (tab?: TabType) => {
    if (!tab) {
      setDrawerOpen(false)
      return
    }
    if (drawerOpen && activeTab === tab) {
      setDrawerOpen(false)
    } else {
      setActiveTab(tab)
      setDrawerOpen(true)
    }
  }

  const handleOpenDiagram = (code: string) => {
    setActiveDiagram(code)
    setActiveTab('diagram')
    setDrawerOpen(true)
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const shouldAutoScrollRef = useRef(true)

  // Fetch messages
  const {
    data: messages = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['messages', topic.id, pinnedOnly],
    queryFn: () => api.listMessages(topic.id, pinnedOnly ? true : undefined),
  })

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      api.updateMessagePin(messageId, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', topic.id] })
    },
  })

  // Topic status mutation
  const statusMutation = useMutation({
    mutationFn: (status: TopicStatus) => api.updateTopic(topic.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap'] })
    },
  })

  // Auto-scroll logic
  const handleScroll = () => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 80
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior })
    }
  }

  useEffect(() => {
    scrollToBottom('auto')
  }, [messages, streamingContent])

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = inputValue.trim()
    if (!content || isStreaming) return

    setInputValue('')
    setStreamError(null)
    setIsStreaming(true)
    setStreamingContent('')
    shouldAutoScrollRef.current = true

    const controller = new AbortController()
    abortControllerRef.current = controller

    await streamChat({
      topicId: topic.id,
      content,
      signal: controller.signal,
      onDelta: (delta) => {
        setStreamingContent((prev) => prev + delta)
      },
      onDone: () => {
        setIsStreaming(false)
        setStreamingContent('')
        queryClient.invalidateQueries({ queryKey: ['messages', topic.id] })
      },
      onError: (err) => {
        setIsStreaming(false)
        setStreamError(err)
        queryClient.invalidateQueries({ queryKey: ['messages', topic.id] })
      },
    })
  }

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
      setStreamingContent('')
      queryClient.invalidateQueries({ queryKey: ['messages', topic.id] })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-[#09090b]">
      {/* Main Chat Area */}
      <div className="flex h-full flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#09090b]/80 px-6 backdrop-blur-md">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
            {roadmapTitle && <span className="truncate max-w-[150px]">{roadmapTitle}</span>}
            {chapterTitle && (
              <>
                <span>/</span>
                <span className="truncate max-w-[150px]">{chapterTitle}</span>
              </>
            )}
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-white truncate max-w-md">
            {topic.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Status selector */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1">
            <select
              aria-label="Topic status"
              value={topic.status}
              onChange={(e) => statusMutation.mutate(e.target.value as TopicStatus)}
              className="bg-transparent text-xs font-medium text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="not_started">⚪ Not Started</option>
              <option value="learning">🟡 In Progress</option>
              <option value="solid">🟢 Solid</option>
            </select>
          </div>

          {/* Pinned filter toggle */}
          <button
            type="button"
            onClick={() => setPinnedOnly(!pinnedOnly)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              pinnedOnly
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <span>📌</span>
            <span>{pinnedOnly ? 'Pinned only' : 'All'}</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-6"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            </div>
          ) : isError ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="text-xs text-rose-400 font-medium">Failed to load topic conversation.</p>
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-24">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-200">
                {pinnedOnly ? 'No pinned messages' : 'Your conversation is your notebook'}
              </h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-500">
                {pinnedOnly
                  ? 'Click the pin icon on any tutor response to highlight key takeaways here.'
                  : 'Ask the tutor for explanations, intuitive analogies, or practice questions.'}
              </p>
            </div>
          ) : (
            <>
              {messages.map((message: MessageType) => (
                <Message
                  key={message.id}
                  message={message}
                  onTogglePin={(id, pinned) => pinMutation.mutate({ messageId: id, pinned })}
                  onOpenDiagram={handleOpenDiagram}
                />
              ))}

              {/* In-flight streaming message */}
              {isStreaming && (
                <div className="py-4 pl-1">
                  <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300 border border-zinc-700/50">
                      T
                    </div>
                    <span className="font-medium text-zinc-300">Tutor</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  </div>
                  <div className="markdown-body text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
                    {streamingContent || 'Thinking...'}
                  </div>
                </div>
              )}

              {streamError && (
                <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
                  {streamError}
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Box Bar */}
      <div className="border-t border-zinc-800/80 bg-[#09090b]/95 p-4 backdrop-blur-md">
        <form onSubmit={handleSendMessage} className="mx-auto max-w-3xl">
          <div className="relative flex items-end rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg focus-within:border-zinc-700 transition-all">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your tutor... (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />

            <div className="flex items-center gap-1.5 p-2 shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-zinc-950 transition-all hover:bg-zinc-200 disabled:opacity-20 disabled:hover:bg-white"
                  aria-label="Send message"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>

    {/* Study Accelerator Drawer */}
    <StudyDrawer
      topic={topic}
      isOpen={drawerOpen}
      onToggleOpen={handleToggleDrawer}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      diagramCode={activeDiagram}
      onClearDiagram={() => setActiveDiagram(null)}
      chapterTitle={chapterTitle}
      roadmapTitle={roadmapTitle}
    />
  </div>
)
}
