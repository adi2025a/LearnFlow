import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { DailyActivity } from '../../api/types'

interface HeatmapDay extends DailyActivity {
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

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const LearningHeatmap: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: () => api.getActivityStats(364), // Full 52-week year (364 days)
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Format 364 days into 52-53 weeks of 7 days (Sunday - Saturday)
  const { weeks, monthHeaders } = useMemo(() => {
    if (!data?.history || data.history.length === 0) {
      return { weeks: [], monthHeaders: [] }
    }

    const raw = data.history
    const firstDate = new Date(raw[0].date)
    const firstDayOfWeek = firstDate.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    const allDays: HeatmapDay[] = []

    // Prepend padding days so the first week starts on Sunday
    for (let i = 0; i < firstDayOfWeek; i++) {
      allDays.push({
        date: `pad-start-${i}`,
        count: 0,
        messages_count: 0,
        topics_completed: 0,
        isPadding: true,
      })
    }

    allDays.push(...raw)

    // Append padding days so the final week ends on Saturday
    const lastDate = new Date(raw[raw.length - 1].date)
    const lastDayOfWeek = lastDate.getDay()
    for (let i = lastDayOfWeek + 1; i <= 6; i++) {
      allDays.push({
        date: `pad-end-${i}`,
        count: 0,
        messages_count: 0,
        topics_completed: 0,
        isPadding: true,
      })
    }

    // Chunk all days into weeks (columns) of 7 days each
    const computedWeeks: HeatmapDay[][] = []
    for (let i = 0; i < allDays.length; i += 7) {
      computedWeeks.push(allDays.slice(i, i + 7))
    }

    // Determine month labels for each column
    let prevMonth = -1
    const computedMonthHeaders: (string | null)[] = computedWeeks.map((week) => {
      // Find the first non-padding day in this week
      const sample = week.find((d) => !d.isPadding)
      if (!sample) return null

      const parts = sample.date.split('-').map(Number)
      const currentMonth = parts[1] - 1 // 0-indexed month
      if (currentMonth !== prevMonth) {
        prevMonth = currentMonth
        return MONTH_NAMES[currentMonth]
      }
      return null
    })

    return { weeks: computedWeeks, monthHeaders: computedMonthHeaders }
  }, [data?.history])

  const currentStreak = data?.current_streak ?? 0
  const longestStreak = data?.longest_streak ?? 0
  const totalSolid = data?.total_topics_solid ?? 0
  const totalMessages = data?.total_messages ?? 0
  const totalActiveDays = data?.total_active_days ?? 0
  const totalContributions = totalMessages + totalSolid

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-5 shadow-2xl">
      {/* Top Header: Streak Status & Milestone Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4 mb-4">
        {/* Streak Counter Pill */}
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-all shrink-0 ${
              currentStreak > 0
                ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.25)]'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
            }`}
          >
            🔥
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-white font-mono">
                {currentStreak > 0
                  ? `${currentStreak} Day${currentStreak === 1 ? '' : 's'} Streak`
                  : 'Start Your Streak Today'}
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
                  Best streak:{' '}
                  <span className="text-zinc-200 font-semibold">{longestStreak} day{longestStreak === 1 ? '' : 's'}</span>{' '}
                  •{' '}
                  <span className="text-zinc-200 font-semibold">{totalActiveDays}</span> total active day{totalActiveDays === 1 ? '' : 's'}
                </>
              ) : (
                'Review topics or chat with your tutor to build a daily study habit'
              )}
            </p>
          </div>
        </div>

        {/* Milestone Quick Badges */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
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

          <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 font-mono">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Activity</span>
            <span className="text-xs font-semibold text-amber-300">
              ⚡ {totalContributions}
            </span>
          </div>
        </div>
      </div>

      {/* Full-Year 52-Week GitHub-Style Activity Heatmap */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="w-fit min-w-full">
          {/* Month Header Row (aligned 1:1 with week columns) */}
          <div className="flex gap-1 sm:gap-1.5 pl-7 sm:pl-8 text-[10px] font-mono text-zinc-500 mb-1.5 h-4 select-none">
            {monthHeaders.map((month, colIdx) => (
              <div
                key={colIdx}
                className="w-3 sm:w-3.5 shrink-0 relative"
              >
                {month && (
                  <span className="absolute left-0 top-0 whitespace-nowrap font-medium text-zinc-400">
                    {month}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Grid Container: Weekday labels on left, 7-row columns on right */}
          <div className="flex items-start gap-1.5 sm:gap-2">
            {/* Weekday Labels (Mon, Wed, Fri) aligned with 7 rows */}
            <div className="flex flex-col justify-between h-[104px] sm:h-[116px] text-[9px] font-mono text-zinc-500 pr-1 w-6 sm:w-7 shrink-0 select-none py-1">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Heatmap Columns (1 column per week, 7 cells per column) */}
            {isLoading ? (
              <div className="flex h-[104px] sm:h-[116px] w-full items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : (
              <div className="flex gap-1 sm:gap-1.5">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1 sm:gap-1.5 shrink-0">
                    {week.map((cell) => {
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
                        colorClass = 'bg-emerald-950 border-emerald-900 hover:border-emerald-600'
                      } else if (count >= 2 && count <= 3) {
                        colorClass = 'bg-emerald-800 border-emerald-700 hover:border-emerald-500'
                      } else if (count >= 4 && count <= 6) {
                        colorClass = 'bg-emerald-600 border-emerald-500 hover:border-emerald-400'
                      } else if (count >= 7) {
                        colorClass =
                          'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)] hover:brightness-110'
                      }

                      return (
                        <div key={cell.date} className="group relative">
                          <div
                            className={`h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-xs sm:rounded-sm border transition-all cursor-pointer ${colorClass}`}
                          />

                          {/* Hover Tooltip */}
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
                            <div className="w-1.5 h-1.5 rotate-45 bg-zinc-950 border-r border-b border-zinc-700 -mt-1" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Footer Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 mt-3 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-500 gap-2">
        <span>364 Days of Continuous Learning Activity</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="h-2.5 w-2.5 rounded-xs bg-zinc-900 border border-zinc-800/80" title="0 activities" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-950 border border-emerald-900" title="1 activity" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-800 border border-emerald-700" title="2-3 activities" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-600 border border-emerald-500" title="4-6 activities" />
          <div className="h-2.5 w-2.5 rounded-xs bg-emerald-400 border border-emerald-300" title="7+ activities" />
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
