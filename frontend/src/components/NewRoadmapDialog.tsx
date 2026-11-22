import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { RoadmapGenerateRequest } from '../api/types'

interface NewRoadmapDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const NewRoadmapDialog: React.FC<NewRoadmapDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'generate' | 'blank'>('generate')

  // Generate form state
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState('Beginner to Intermediate')
  const [duration, setDuration] = useState('4 weeks')

  // Blank form state
  const [blankTitle, setBlankTitle] = useState('')
  const [blankGoal, setBlankGoal] = useState('')

  const [error, setError] = useState<string | null>(null)

  const generateMutation = useMutation({
    mutationFn: (data: RoadmapGenerateRequest) => api.generateRoadmap(data),
    onSuccess: (roadmapTree) => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
      onClose()
      const firstTopic = roadmapTree.chapters[0]?.topics[0]
      if (firstTopic) {
        navigate(`/topics/${firstTopic.id}`)
      } else {
        navigate(`/roadmaps/${roadmapTree.id}`)
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to generate roadmap')
    },
  })

  const createBlankMutation = useMutation({
    mutationFn: (data: { title: string; goal: string; level: string }) =>
      api.createRoadmap(data),
    onSuccess: (newRoadmap) => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
      onClose()
      navigate(`/roadmaps/${newRoadmap.id}`)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create roadmap')
    },
  })

  if (!isOpen) return null

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim()) return
    setError(null)
    generateMutation.mutate({
      goal: goal.trim(),
      level: level || undefined,
      duration: duration || undefined,
    })
  }

  const handleBlankSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!blankTitle.trim() || !blankGoal.trim()) return
    setError(null)
    createBlankMutation.mutate({
      title: blankTitle.trim(),
      goal: blankGoal.trim(),
      level,
    })
  }

  const isPending = generateMutation.isPending || createBlankMutation.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#09090b] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <h2 className="text-base font-semibold tracking-tight text-white">
            Create Learning Roadmap
          </h2>
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="my-4 flex rounded-xl bg-zinc-900 border border-zinc-800 p-1">
          <button
            type="button"
            onClick={() => setMode('generate')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              mode === 'generate'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI Curriculum
          </button>
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              mode === 'blank'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manual Roadmap
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-950/40 border border-rose-900/60 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {mode === 'generate' ? (
          <form onSubmit={handleGenerateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                What do you want to learn?
              </label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Master asynchronous Python, coroutines, and distributed workers"
                rows={3}
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Target Level
                </label>
                <select
                  aria-label="Target Level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none cursor-pointer"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Beginner to Intermediate">Beginner to Intermediate</option>
                  <option value="Intermediate to Advanced">Intermediate to Advanced</option>
                  <option value="Advanced / Expert">Advanced / Expert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Pacing
                </label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 4 weeks"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !goal.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 disabled:opacity-40 transition-colors"
              >
                {isPending ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  'Generate Roadmap'
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBlankSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Roadmap Title
              </label>
              <input
                type="text"
                value={blankTitle}
                onChange={(e) => setBlankTitle(e.target.value)}
                placeholder="e.g. Distributed Systems"
                required
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Goal Description
              </label>
              <textarea
                value={blankGoal}
                onChange={(e) => setBlankGoal(e.target.value)}
                placeholder="Key outcomes you want to achieve"
                rows={3}
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !blankTitle.trim() || !blankGoal.trim()}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-xs hover:bg-zinc-200 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Creating...' : 'Create Roadmap'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
