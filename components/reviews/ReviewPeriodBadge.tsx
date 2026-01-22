'use client'

import { ReviewType } from '@prisma/client'

interface ReviewPeriodBadgeProps {
  type: ReviewType
  periodStart: Date
  periodEnd: Date
}

export function formatReviewPeriod(
  type: ReviewType,
  periodStart: Date,
  periodEnd: Date
): string {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  if (type === 'DAILY') {
    return start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (type === 'WEEKLY') {
    const startStr = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const endStr = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    return `Week of ${startStr} - ${endStr}`
  }

  return start.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function ReviewPeriodBadge({
  type,
  periodStart,
  periodEnd,
}: ReviewPeriodBadgeProps) {
  return (
    <span className="text-[11px] text-[var(--color-muted)]">
      {formatReviewPeriod(type, periodStart, periodEnd)}
    </span>
  )
}
