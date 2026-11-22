import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QuizResponse, Topic } from '../../api/types'
import { api } from '../../api/client'

interface QuizViewProps {
  topic: Topic
}

export const QuizView: React.FC<QuizViewProps> = ({ topic }) => {
  const queryClient = useQueryClient()
  const [quiz, setQuiz] = useState<QuizResponse | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const quizMutation = useMutation({
    mutationFn: () => api.getTopicQuiz(topic.id),
    onSuccess: (data) => {
      setQuiz(data)
      setSelectedAnswers({})
      setError(null)
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to generate quiz. Please try again.')
    },
  })

  const markSolidMutation = useMutation({
    mutationFn: () => api.updateTopic(topic.id, { status: 'solid' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap'] })
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
    },
  })

  const handleSelectOption = (questionId: number, optionId: string) => {
    // Only allow selecting once per question to preserve quiz test integrity
    if (selectedAnswers[questionId]) return
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  // Calculate score
  const totalQuestions = quiz?.questions.length || 0
  const answeredCount = Object.keys(selectedAnswers).length
  const correctCount = quiz?.questions.reduce((acc, q) => {
    return selectedAnswers[q.id] === q.correct_option_id ? acc + 1 : acc
  }, 0) || 0

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-xs">
              📝
            </span>
            <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider font-mono">
              Knowledge Check
            </h3>
          </div>
          {quiz && (
            <button
              type="button"
              onClick={() => quizMutation.mutate()}
              disabled={quizMutation.isPending}
              className="text-[11px] text-zinc-400 hover:text-white transition-colors font-mono"
            >
              ↻ New Questions
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
          Multiple-choice conceptual questions for <span className="text-zinc-200 font-medium font-mono">{topic.title}</span>.
        </p>
      </div>

      {!quiz && !quizMutation.isPending && (
        <div className="flex flex-col items-center justify-center flex-1 py-10 text-center space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-base">
            🎯
          </div>
          <div className="max-w-xs space-y-1">
            <h4 className="text-xs font-medium text-zinc-200">Test Your Conceptual Grasp</h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Generate a fast 3-question quiz with instant answers and deep explanations.
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-[11px] text-rose-300">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={() => quizMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 transition-colors"
          >
            Generate Quiz →
          </button>
        </div>
      )}

      {quizMutation.isPending && (
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center space-y-3">
          <div className="h-6 w-6 rounded-full border-2 border-zinc-600 border-t-white animate-spin" />
          <p className="text-xs text-zinc-400 font-mono">Crafting targeted questions...</p>
        </div>
      )}

      {quiz && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Progress / Score Bar */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 font-mono">
              Answered: {answeredCount}/{totalQuestions}
            </span>
            <span className="text-[11px] font-mono font-medium text-emerald-400">
              Score: {correctCount}/{answeredCount}
            </span>
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {quiz.questions.map((q, qIndex) => {
              const selected = selectedAnswers[q.id]
              const hasAnswered = !!selected
              const isCorrect = selected === q.correct_option_id

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3.5 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300 shrink-0 mt-0.5">
                      Q{qIndex + 1}
                    </span>
                    <h4 className="text-xs font-medium text-zinc-100 leading-relaxed">
                      {q.question}
                    </h4>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5 pt-1">
                    {q.options.map((opt) => {
                      const isOptionSelected = selected === opt.id
                      const isOptionCorrect = opt.id === q.correct_option_id

                      let cardStyle = 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/50 text-zinc-300'
                      let badgeStyle = 'bg-zinc-800 text-zinc-400'

                      if (hasAnswered) {
                        if (isOptionCorrect) {
                          cardStyle = 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200 font-medium'
                          badgeStyle = 'bg-emerald-500/20 text-emerald-400 font-bold'
                        } else if (isOptionSelected && !isCorrect) {
                          cardStyle = 'border-rose-500/50 bg-rose-950/20 text-rose-200'
                          badgeStyle = 'bg-rose-500/20 text-rose-400'
                        } else {
                          cardStyle = 'border-zinc-800/50 bg-zinc-900/20 text-zinc-500 opacity-60'
                          badgeStyle = 'bg-zinc-900 text-zinc-600'
                        }
                      }

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(q.id, opt.id)}
                          disabled={hasAnswered}
                          className={`w-full flex items-start gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-all ${cardStyle}`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-mono ${badgeStyle}`}
                          >
                            {opt.id}
                          </span>
                          <span className="leading-snug pt-0.5">{opt.text}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Feedback Explanation */}
                  {hasAnswered && (
                    <div
                      className={`rounded-xl border p-3 text-[11px] leading-relaxed space-y-1 animate-in fade-in duration-150 ${
                        isCorrect
                          ? 'border-emerald-900/40 bg-emerald-950/10 text-emerald-300'
                          : 'border-amber-900/40 bg-amber-950/10 text-amber-300'
                      }`}
                    >
                      <div className="font-semibold font-mono flex items-center gap-1.5">
                        <span>{isCorrect ? '✓ Correct' : '✕ Incorrect'}</span>
                        <span className="text-[10px] text-zinc-400">
                          (Correct Answer: Option {q.correct_option_id})
                        </span>
                      </div>
                      <p className="text-zinc-300">{q.explanation}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Completion banner */}
          {answeredCount === totalQuestions && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center space-y-3">
              <div className="text-xs font-medium text-zinc-200">
                Quiz Complete! You got {correctCount} out of {totalQuestions} correct ({Math.round((correctCount / totalQuestions) * 100)}%).
              </div>
              {correctCount === totalQuestions && topic.status !== 'solid' && (
                <button
                  type="button"
                  onClick={() => markSolidMutation.mutate()}
                  disabled={markSolidMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition-colors"
                >
                  {markSolidMutation.isPending ? 'Marking Solid...' : 'Mark Topic as Solid ✓'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
