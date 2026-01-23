'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useMemo, useState, useTransition } from 'react'
import {
  getUserTimezone,
  getLocalDayBoundaries,
  getLocalWeekStart,
  getLocalMonthStart,
} from '@/lib/timezone'

type FilterOption = {
  label: string
  value: string
  getRange: (timezone: string) => { from: string; to: string } | null
}

const filterOptions: FilterOption[] = [
  {
    label: 'All time',
    value: 'all',
    getRange: () => null
  },
  {
    label: 'Today',
    value: 'today',
    getRange: (timezone: string) => {
      const { start, end } = getLocalDayBoundaries(timezone, 0)
      return { from: start.toISOString(), to: end.toISOString() }
    }
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: (timezone: string) => {
      const { start, end } = getLocalDayBoundaries(timezone, 1)
      return { from: start.toISOString(), to: end.toISOString() }
    }
  },
  {
    label: 'This week',
    value: 'week',
    getRange: (timezone: string) => {
      const start = getLocalWeekStart(timezone)
      const now = new Date()
      return { from: start.toISOString(), to: now.toISOString() }
    }
  },
  {
    label: 'This month',
    value: 'month',
    getRange: (timezone: string) => {
      const start = getLocalMonthStart(timezone)
      const now = new Date()
      return { from: start.toISOString(), to: now.toISOString() }
    }
  },
  {
    label: 'Last 30 days',
    value: '30days',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return { from: start.toISOString(), to: now.toISOString() }
    }
  }
]

export function DateRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialLoadDone = useRef(false)
  const [isPending, startTransition] = useTransition()

  // Get user's timezone once on mount (stable across renders)
  const timezone = useMemo(() => getUserTimezone(), [])

  // URL-based filter (source of truth after navigation completes)
  const urlFilter = searchParams.get('filter') || 'today'

  // Optimistic local state for instant UI feedback
  const [optimisticFilter, setOptimisticFilter] = useState(urlFilter)

  // Sync optimistic state when URL changes (e.g., back/forward navigation)
  useEffect(() => {
    setOptimisticFilter(urlFilter)
  }, [urlFilter])

  // On initial load only, redirect to today if no filter param
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    if (!searchParams.get('filter')) {
      const todayOption = filterOptions.find(o => o.value === 'today')!
      const range = todayOption.getRange(timezone)!
      router.replace(`?filter=today&from=${range.from}&to=${range.to}`, { scroll: false })
    }
  }, [router, searchParams, timezone])

  const handleFilterChange = useCallback((value: string) => {
    const option = filterOptions.find(o => o.value === value)
    if (!option) return

    // Update UI immediately (optimistic)
    setOptimisticFilter(value)

    const range = option.getRange(timezone)

    // Navigate in transition (non-blocking)
    startTransition(() => {
      if (range) {
        router.push(`?filter=${value}&from=${range.from}&to=${range.to}`, { scroll: false })
      } else {
        router.push(`?filter=${value}`, { scroll: false })
      }
    })
  }, [router, timezone])

  return (
    <div className="relative">
      {/* Filter buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            disabled={isPending}
            className={`
              flex-shrink-0
              px-3 py-1.5
              text-sm
              rounded-full
              border
              transition-all duration-150
              ${optimisticFilter === option.value
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-line)] hover:border-[var(--color-muted)] hover:text-[var(--color-text)]'
              }
              ${isPending ? 'opacity-70' : ''}
            `}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Loading indicator - small dot next to filters */}
      {isPending && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 pr-1">
          <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-pulse" />
        </div>
      )}
    </div>
  )
}

/**
 * Hook to check if date filter navigation is pending.
 * Use this in sibling components to show loading states.
 */
export function useDateFilterPending() {
  const searchParams = useSearchParams()
  const [lastFilter, setLastFilter] = useState(searchParams.get('filter'))
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    const currentFilter = searchParams.get('filter')
    if (currentFilter !== lastFilter) {
      setLastFilter(currentFilter)
      setIsPending(false)
    }
  }, [searchParams, lastFilter])

  return isPending
}
