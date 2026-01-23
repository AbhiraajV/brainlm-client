'use client'

import { ReviewType } from '@prisma/client'

type FilterOption = {
  label: string
  value: ReviewType | 'ALL'
  color?: string
}

const filterOptions: FilterOption[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Daily', value: 'DAILY', color: 'var(--color-accent)' },
  { label: 'Weekly', value: 'WEEKLY', color: 'var(--color-accent-secondary)' },
  { label: 'Monthly', value: 'MONTHLY', color: 'var(--color-warn)' },
]

interface ReviewTypeFilterProps {
  value?: ReviewType
  onChange: (value: ReviewType | undefined) => void
  counts?: {
    total: number
    daily: number
    weekly: number
    monthly: number
  }
}

export function ReviewTypeFilter({ value, onChange, counts }: ReviewTypeFilterProps) {
  const currentFilter = value || 'ALL'

  const handleFilterChange = (filterValue: ReviewType | 'ALL') => {
    onChange(filterValue === 'ALL' ? undefined : filterValue)
  }

  const getCount = (value: ReviewType | 'ALL'): number | undefined => {
    if (!counts) return undefined
    switch (value) {
      case 'ALL':
        return counts.total
      case 'DAILY':
        return counts.daily
      case 'WEEKLY':
        return counts.weekly
      case 'MONTHLY':
        return counts.monthly
      default:
        return undefined
    }
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {filterOptions.map((option) => {
        const count = getCount(option.value)
        const isActive = currentFilter === option.value

        return (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            className={`
              flex-shrink-0
              flex items-center gap-1.5
              px-3 py-1.5
              text-sm
              rounded-full
              border
              transition-all duration-150
              ${
                isActive
                  ? option.color
                    ? `bg-[${option.color}] text-white border-[${option.color}]`
                    : 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-transparent text-[var(--color-muted)] border-[var(--color-line)] hover:border-[var(--color-muted)] hover:text-[var(--color-text)]'
              }
            `}
            style={
              isActive && option.color
                ? {
                    backgroundColor: option.color,
                    borderColor: option.color,
                  }
                : undefined
            }
          >
            {option.label}
            {count !== undefined && count > 0 && (
              <span
                className={`
                  text-[10px] font-medium
                  px-1.5 py-0.5
                  rounded-full
                  ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
                  }
                `}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
