import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { DailyActivity } from '../../api/types'

interface HeatmapCell extends DailyActivity {
  isPadding?: boolean
}

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export const LearningHeatmap: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: () => api.getActivityStats(112), // 16 weeks
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Format and pad history to align properly with 7-day week columns (Sun - Sat)
  const { paddedCells, monthHeaders } = useMemo(() => {
    if (!data?.history || data.history.length === 0) {
      return { paddedCells: [], monthHeaders: [] }
    }

    const raw = data.history
    const firstDate = new Date(raw[0].date)
    const firstDayOfWeek = firstDate.getDay() // 0 = Sunday, ..., 6 = Saturday

    const cells: HeatmapCell[] = []

    // Prepend empty padding days so week starts on Sunday
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        date: `pad-start-${i}`,
        count: 0,
        messages_count: 0,
        topics_completed: 0,
        isPadding: true,
      })
    }

    // Add actual days
    cells.push(...raw)

    // Append empty padding days to finish final week on Saturday
    const lastDate = new Date(raw[raw.length - 1].date)
    const lastDayOfWeek = lastDate.getDay()
    for (let i = lastDayOfWeek + 1; i <= 6; i++) {
      cells.push({
        date: `pad-end-${i}`,
        count: 0,
        messages_count: 0,
        topics_completed: 0,
        isPadding: true,
      })
    }

    // Compute month label positions across columns (every 7 cells = 1 week column)
    const headers: { label: string; colIndex: number }[] = []
    let lastMonth = -1
    const totalCols = Math.ceil(cells.length / 7)

    for (let col = 0; col < totalCols; col++) {
      // Look at middle of the week in that column
      const sampleIndex = col * 7
      if (sampleIndex < cells.length) {
        const item = cells[sampleIndex]
        if (!item.isPadding) {
          const parts = item.date.split('-').map(Number)
          const m = parts[1] - 1
          if (m !== lastMonth) {
            const dateObj = new Date(parts[0], m, parts[2])
            headers.push({
              label: dateObj.toLocaleDateString(undefined, { month: 'short' }),
              colIndex: col,
            })
            lastMonth = m
          }
        }
      }
    }

    return { paddedCells: cells, monthHeaders: headers }
  }, [data?.history])

  const currentStreak = data?.current_streak ?? 0
  const longestStreak = data?.longest_streak ?? 0
  const totalSolid = data?.total_topics_solid ?? 0
  const totalMessages = data?.total_messages ?? 0
  const totalActiveDays = data?.total_active_days ?? 0

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-5 shadow-xl">
      {/* Top Header: Streak Status & Key Milestones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4 mb-5">
        {/* Streak Counter Pill */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all ${
              currentStreak > 0
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
            }`}
          >
            🔥
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-white font-mono">
                {currentStreak > 0 ? `${currentStreak} Day Streak` : 'Start Your Streak Today'}
              </h3>
              {currentStreak >= 3 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-300 border border-amber-500/40">
                  On Fire
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              {longestStreak > 0 ? (
                <>
                  Best streak: <span className="text-zinc-200 font-semibold">{longestStreak} days</span> •{' '}
                  <span className="text-zinc-200 font-semibold">{totalActiveDays}</span> total active days
                </>
              ) : (
                'Review lessons or message tutor to build your daily study habit'
              )}
            </p>
          </div>
        </div>

        {/* Milestone Quick Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 font-mono">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Mastered</span>
            <span className="text-xs font-semibold text-emerald-400">
              🟢 {totalSolid}
            </span>
          </div>

          <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 font-mono">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Messages</span>
            <span className="text-xs font-semibold text-zinc-200">
              💬 {totalMessages}
            </span>
          </div>
        </div>
      </div>

      {/* GitHub-Style Activity Heatmap Grid */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="min-w-[620px]">
          {/* Month Header Labels */}
          <div className="relative h-4 mb-1 pl-8 text-[10px] font-mono text-zinc-500">
            {monthHeaders.map((header) => (
              <span
                key={`${header.label}-${header.colIndex}`}
                className="absolute"
                style={{ left: `${header.colIndex * 18 + 32}px` }}
              >
                {header.label}
              </span>
            ))}
          </div>

          {/* Grid Container: Weekday labels on left, 7-row calendar grid on right */}
          <div className="flex items-center gap-2">
            {/* Day of Week Labels (Mon, Wed, Fri) */}
            <div className="flex flex-col justify-between h-[112px] text-[9px] font-mono text-zinc-500 pr-1 w-6 shrink-0 select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Heatmap 7-row grid */}
            {isLoading ? (
              <div className="flex h-[112px] w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : (
              <div className="grid grid-rows-7 grid-flow-col gap-1 sm:gap-1.5">
                {paddedCells.map((cell) => {
                  if (cell.isPadding) {
                    return (
                      <div
                        key={cell.date}
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-0 pointer-events-none"
                      />
                    )
                  }

                  const count = cell.count
                  let colorClass = 'bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-500'
                  if (count === 1) {
                    colorClass = 'bg-emerald-950 border-emerald-900/90 hover:border-emerald-600'
                  } else if (count >= 2 && count <= 3) {
                    colorClass = 'bg-emerald-800 border-emerald-700 hover:border-emerald-500'
                  } else if (count >= 4 && count <= 6) {
                    colorClass = 'bg-emerald-600 border-emerald-500 hover:border-emerald-400'
                  } else if (count >= 7) {
                    colorClass =
                      'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.4)] hover:brightness-110'
                  }

                  return (
                    <div
                      key={cell.date}
                      className="group relative"
                    >
                      <div
                        className={`h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-xs sm:rounded-sm border transition-all cursor-pointer ${colorClass}`}
                      />

                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 pointer-events-none whitespace-nowrap">
                        <div className="rounded-lg bg-zinc-950/95 border border-zinc-700 px-2.5 py-1 text-[10px] font-mono text-zinc-200 shadow-2xl backdrop-blur-md">
                          <span className="font-semibold text-white">
                            {count} {count === 1 ? 'study activity' : 'study activities'}
                          </span>
                          <span className="text-zinc-400 block text-[9px]">
                            {formatDate(cell.date)}
                          </span>
                          {(cell.messages_count > 0 || cell.topics_completed > 0) && (
                            <span className="text-emerald-400 block text-[9px] mt-0.5">
                              {cell.messages_count > 0 ? `${cell.messages_count} msgs` : ''}
                              {cell.messages_count > 0 && cell.topics_completed > 0 ? ' • ' : ''}
                              {cell.topics_completed > 0 ? `${cell.topics_completed} solid` : ''}
                            </span>
                          )}
                        </div>
                        {/* Downward triangle arrow */}
                        <div className="w-1.5 h-1.5 rotate-45 bg-zinc-950 border-r border-b border-zinc-700 -mt-1" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Footer Legend */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-500">
        <span>Activity over the past 16 weeks</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="h-2.5 w-2.5 rounded-xs bg-zinc-900 border border-zinc-800/80" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-950 border border-emerald-900" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-800 border border-emerald-700" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-600 border border-emerald-500" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-400 border border-emerald-300" />
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
