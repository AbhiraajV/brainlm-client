import { create } from 'zustand'
import { getUserTimezone, getLocalDayBoundaries, getLocalWeekStart, getLocalMonthStart } from '@/lib/timezone'

export type FilterValue = 'all' | 'today' | 'yesterday' | 'week' | 'month' | '30days'

export interface DateFilter {
  from?: string
  to?: string
}

interface FilterState {
  filterValue: FilterValue
  dateFilter: DateFilter | undefined
  setFilter: (value: FilterValue) => void
}

function computeDateFilter(value: FilterValue): DateFilter | undefined {
  if (value === 'all') return undefined

  const timezone = getUserTimezone()

  switch (value) {
    case 'today': {
      const { start, end } = getLocalDayBoundaries(timezone, 0)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    case 'yesterday': {
      const { start, end } = getLocalDayBoundaries(timezone, 1)
      return { from: start.toISOString(), to: end.toISOString() }
    }
    case 'week': {
      const start = getLocalWeekStart(timezone)
      return { from: start.toISOString(), to: new Date().toISOString() }
    }
    case 'month': {
      const start = getLocalMonthStart(timezone)
      return { from: start.toISOString(), to: new Date().toISOString() }
    }
    case '30days': {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      return { from: start.toISOString(), to: new Date().toISOString() }
    }
  }
}

export const useFilterStore = create<FilterState>((set) => ({
  filterValue: 'today',
  dateFilter: computeDateFilter('today'),
  setFilter: (value) => set({
    filterValue: value,
    dateFilter: computeDateFilter(value),
  }),
}))
