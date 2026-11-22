import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Message as MessageType } from '../api/types'

interface MessageProps {
  message: MessageType
  onTogglePin?: (id: string, pinned: boolean) => void
  onOpenDiagram?: (code: string) => void
}

function extractNodeText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractNodeText).join('')
  if (React.isValidElement(node) && node.props && 'children' in (node.props as Record<string, unknown>)) {
    return extractNodeText((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export const Message: React.FC<MessageProps> = ({ message, onTogglePin, onOpenDiagram }) => {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  if (isUser) {
    return (
      <div className="group flex w-full flex-col items-end py-2">
        <div className="flex max-w-xl flex-col items-end gap-1.5">
          <div className="rounded-2xl bg-zinc-800/90 px-4 py-2.5 text-sm text-zinc-100 shadow-xs border border-zinc-700/40">
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          </div>
          <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="hover:text-zinc-300"
              title="Copy"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {onTogglePin && (
              <button
                type="button"
                onClick={() => onTogglePin(message.id, !message.pinned)}
                className={`transition-colors ${message.pinned ? 'text-amber-400' : 'hover:text-zinc-300'}`}
                title={message.pinned ? 'Unpin' : 'Pin'}
              >
                {message.pinned ? 'Pinned' : 'Pin'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative flex w-full flex-col gap-2 py-4 transition-colors ${
        message.pinned
          ? 'border-l-2 border-amber-400/70 pl-4 my-1'
          : 'pl-1'
      }`}
    >
      {/* Header bar: Sender + Actions */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300 border border-zinc-700/50">
            T
          </div>
          <span className="font-medium text-zinc-300">Tutor</span>
          {message.pinned && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              📌 Pinned
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            title="Copy response"
            aria-label="Copy response"
          >
            {copied ? (
              <span className="text-zinc-200">Copied</span>
            ) : (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </span>
            )}
          </button>

          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(message.id, !message.pinned)}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors flex items-center gap-1 ${
                message.pinned
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title={message.pinned ? 'Unpin' : 'Pin'}
              aria-label={message.pinned ? 'Unpin' : 'Pin'}
            >
              <svg className="w-3.5 h-3.5" fill={message.pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {message.pinned ? 'Pinned' : 'Pin'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="markdown-body text-sm leading-relaxed text-zinc-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            pre({ children, ...props }) {
              const codeChild = React.Children.toArray(children)[0]
              if (React.isValidElement(codeChild)) {
                const childProps = codeChild.props as { className?: string; children?: React.ReactNode }
                const childClass = String(childProps.className || '')
                if (childClass.includes('language-mermaid')) {
                  const mermaidText = extractNodeText(childProps.children).replace(/\n$/, '')
                  return (
                    <div className="my-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 hover:border-zinc-700/80 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800/90 text-base shadow-xs">
                          📊
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-zinc-100 font-mono flex items-center gap-2">
                            <span>Flowchart / Architecture Diagram</span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">
                              Mermaid
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Click to open and interact in the right study drawer
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenDiagram?.(mermaidText)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
                      >
                        <span>Open Diagram</span>
                        <span>↗</span>
                      </button>
                    </div>
                  )
                }
              }

              return (
                <div className="relative my-3 rounded-lg overflow-hidden border border-zinc-800/80 bg-[#121215]">
                  <pre {...props} className="overflow-x-auto p-3 text-xs leading-relaxed font-mono">
                    {children}
                  </pre>
                </div>
              )
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
