'use client'

import { useFilterStore, type FilterValue } from '@/store/filter.store'

type FilterOption = {
  label: string
  value: FilterValue
}

const filterOptions: FilterOption[] = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'Last 30 days', value: '30days' }
]

export function DateRangeFilter() {
  const { filterValue, setFilter } = useFilterStore()

  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`
              flex-shrink-0
              px-3 py-1.5
              text-sm
              rounded-full
              border
              transition-all duration-150
              ${filterValue === option.value
                ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-line)] hover:border-[var(--color-muted)] hover:text-[var(--color-text)]'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
