import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { CopilotChatMessage } from '../../api/types'
import { streamCopilot } from '../../api/copilot'

export const CopilotView: React.FC = () => {
  const [messages, setMessages] = useState<CopilotChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = input.trim()
    if (!content || isStreaming) return

    setInput('')
    setError(null)

    const updatedMessages: CopilotChatMessage[] = [
      ...messages,
      { role: 'user', content },
    ]
    setMessages(updatedMessages)
    setIsStreaming(true)
    setStreamingContent('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    await streamCopilot({
      messages: updatedMessages,
      signal: controller.signal,
      onDelta: (delta) => {
        setStreamingContent((prev) => prev + delta)
      },
      onDone: () => {
        setIsStreaming(false)
        setStreamingContent((finalContent) => {
          if (finalContent) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: finalContent },
            ])
          }
          return ''
        })
      },
      onError: (err) => {
        setIsStreaming(false)
        setError(err)
        setStreamingContent((finalContent) => {
          if (finalContent) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: finalContent },
            ])
          }
          return ''
        })
      },
    })
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
      if (streamingContent) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: streamingContent },
        ])
      }
      setStreamingContent('')
    }
  }

  const handleClear = () => {
    handleStop()
    setMessages([])
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 p-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-xs">
            ⚡
          </span>
          <div>
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Direct Copilot
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">Zero-context scratchpad</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-mono text-zinc-500 hover:text-rose-400 transition-colors"
            title="Clear scratchpad"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center text-zinc-500 space-y-2">
            <span className="text-2xl">⚡</span>
            <p className="text-xs max-w-[220px] leading-relaxed">
              Ask quick syntax questions, compiler flags, or algorithms without polluting topic chat.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              {[
                'cudaMemcpy async syntax',
                'atomicAdd example',
                'nvcc -arch flags',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-xl p-3 text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/40 ml-4'
                : 'bg-zinc-900/40 text-zinc-300 border border-zinc-800 mr-2 prose prose-invert max-w-none text-xs'
            }`}
          >
            {m.role === 'assistant' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap">{m.content}</div>
            )}
          </div>
        ))}

        {streamingContent && (
          <div className="rounded-xl p-3 text-xs leading-relaxed bg-zinc-900/40 text-zinc-300 border border-zinc-800 mr-2 prose prose-invert max-w-none text-xs animate-in fade-in">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {streamingContent}
            </ReactMarkdown>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-900/20 shrink-0">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask quick question... (Enter to send)"
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors pr-10"
          />
          <div className="absolute right-2 flex items-center">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="h-6 w-6 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                title="Stop generation"
              >
                ■
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-6 w-6 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs transition-colors"
                title="Send"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
