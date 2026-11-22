import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ExplanationEvaluateResponse, Topic } from '../../api/types'
import { api } from '../../api/client'

interface FeynmanViewProps {
  topic: Topic
}

export const FeynmanView: React.FC<FeynmanViewProps> = ({ topic }) => {
  const queryClient = useQueryClient()
  const [explanation, setExplanation] = useState('')
  const [evaluation, setEvaluation] = useState<ExplanationEvaluateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const evaluateMutation = useMutation({
    mutationFn: (text: string) => api.evaluateExplanation(topic.id, text),
    onSuccess: (data) => {
      setEvaluation(data)
      setError(null)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Evaluation failed. Please try again.')
    },
  })

  const markSolidMutation = useMutation({
    mutationFn: () => api.updateTopic(topic.id, { status: 'solid' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap'] })
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (explanation.trim().length < 10) {
      setError('Please provide at least 10 characters so the AI can evaluate your understanding.')
      return
    }
    setError(null)
    evaluateMutation.mutate(explanation.trim())
  }

  const handleReset = () => {
    setEvaluation(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-xs">
            ✍️
          </span>
          <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
            Feynman Review
          </h3>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
          Explain <span className="text-zinc-200 font-medium font-mono">{topic.title}</span> in your own words as if teaching someone else. The AI will evaluate your conceptual clarity.
        </p>
      </div>

      {/* Input or Result */}
      {!evaluation ? (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 space-y-3">
          <div className="relative flex-1 min-h-[160px]">
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. When a thread block runs in CUDA, all threads execute in lockstep warps of 32. Divergence happens when..."
              className="w-full h-full min-h-[160px] resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none transition-colors leading-relaxed"
              disabled={evaluateMutation.isPending}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-500 font-mono">
              {explanation.trim().length} chars
            </span>
            <button
              type="submit"
              disabled={evaluateMutation.isPending || explanation.trim().length < 10}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-950 shadow-xs hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {evaluateMutation.isPending ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-zinc-950 animate-ping" />
                  Evaluating...
                </>
              ) : (
                'Critique My Words →'
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Rating Badge */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <span className="text-[11px] text-zinc-400 font-mono">Mastery Assessment:</span>
            {evaluation.rating === 'solid' && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Solid Intuition
              </span>
            )}
            {evaluation.rating === 'almost' && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Almost There
              </span>
            )}
            {evaluation.rating === 'needs_work' && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Needs Polish
              </span>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
            <p className="text-xs text-zinc-300 leading-relaxed">{evaluation.summary}</p>
          </div>

          {/* Strengths */}
          {evaluation.strengths.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                Key Concepts Grasped
              </span>
              <ul className="space-y-1">
                {evaluation.strengths.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30 p-2 text-[11px] text-emerald-300 leading-relaxed"
                  >
                    <span className="text-emerald-400 select-none">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps / Corrections */}
          {evaluation.gaps_or_corrections.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 font-mono">
                Subtleties & Gaps
              </span>
              <ul className="space-y-1">
                {evaluation.gaps_or_corrections.map((g, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-lg bg-amber-950/20 border border-amber-900/30 p-2 text-[11px] text-amber-300 leading-relaxed"
                  >
                    <span className="text-amber-400 select-none">!</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestion */}
          {evaluation.suggestion && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
                Actionable Tip
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">{evaluation.suggestion}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
            {topic.status !== 'solid' && (
              <button
                type="button"
                onClick={() => markSolidMutation.mutate()}
                disabled={markSolidMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition-colors"
              >
                {markSolidMutation.isPending ? 'Marking Solid...' : 'Mark Topic as Solid ✓'}
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Refine Explanation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
