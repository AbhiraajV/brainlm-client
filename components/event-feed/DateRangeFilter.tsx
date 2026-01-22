'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

type FilterOption = {
  label: string
  value: string
  getRange: () => { from: string; to: string } | null
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
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { from: start.toISOString(), to: now.toISOString() }
    }
  },
  {
    label: 'Yesterday',
    value: 'yesterday',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { from: start.toISOString(), to: end.toISOString() }
    }
  },
  {
    label: 'This week',
    value: 'week',
    getRange: () => {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
      return { from: start.toISOString(), to: now.toISOString() }
    }
  },
  {
    label: 'This month',
    value: 'month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
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

  // Read filter from URL, no fallback needed after initial redirect
  const currentFilter = searchParams.get('filter') || 'today'

  // On initial load only, redirect to today if no filter param
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    if (!searchParams.get('filter')) {
      const todayOption = filterOptions.find(o => o.value === 'today')!
      const range = todayOption.getRange()!
      router.replace(`?filter=today&from=${range.from}&to=${range.to}`, { scroll: false })
    }
  }, [router, searchParams])

  const handleFilterChange = useCallback((value: string) => {
    const option = filterOptions.find(o => o.value === value)
    if (!option) return

    const range = option.getRange()

    if (range) {
      router.push(`?filter=${value}&from=${range.from}&to=${range.to}`, { scroll: false })
    } else {
      // "All time" - no date range
      router.push(`?filter=${value}`, { scroll: false })
    }
  }, [router])

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      {filterOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => handleFilterChange(option.value)}
          className={`
            flex-shrink-0
            px-3 py-1.5
            text-sm
            rounded-full
            border
            transition-all duration-150
            ${currentFilter === option.value
              ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
              : 'bg-transparent text-[var(--color-muted)] border-[var(--color-line)] hover:border-[var(--color-muted)] hover:text-[var(--color-text)]'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
