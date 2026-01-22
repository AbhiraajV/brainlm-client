'use client'

import { ReviewType } from '@prisma/client'
import { formatReviewPeriod } from './ReviewPeriodBadge'

export interface ReviewCardData {
  id: string
  type: ReviewType
  periodKey: string
  periodStart: Date
  periodEnd: Date
  summary: string
  renderedMarkdown: string
  eventIds: string[]
  interpretationIds: string[]
  patternIds: string[]
  insightIds: string[]
  createdAt: Date
}

interface ReviewCardProps {
  review: ReviewCardData
  onClick: () => void
}

const typeColors: Record<ReviewType, { bg: string; text: string; label: string }> = {
  DAILY: {
    bg: 'bg-[var(--color-accent)]/15',
    text: 'text-[var(--color-accent)]',
    label: 'Daily',
  },
  WEEKLY: {
    bg: 'bg-[var(--color-accent-secondary)]/15',
    text: 'text-[var(--color-accent-secondary)]',
    label: 'Weekly',
  },
  MONTHLY: {
    bg: 'bg-[var(--color-warn)]/15',
    text: 'text-[var(--color-warn)]',
    label: 'Monthly',
  },
}

function truncateMarkdown(markdown: string, maxLength: number = 150): string {
  const plainText = markdown
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()

  if (plainText.length <= maxLength) return plainText
  return plainText.slice(0, maxLength).trim() + '...'
}

export function ReviewCard({ review, onClick }: ReviewCardProps) {
  const typeStyle = typeColors[review.type]

  const eventCount = review.eventIds.length
  const patternCount = review.patternIds.length
  const insightCount = review.insightIds.length

  const referenceCounts = [
    eventCount > 0 && `${eventCount} event${eventCount !== 1 ? 's' : ''}`,
    patternCount > 0 && `${patternCount} pattern${patternCount !== 1 ? 's' : ''}`,
    insightCount > 0 && `${insightCount} insight${insightCount !== 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      onClick={onClick}
      className="
        w-full text-left
        px-5 sm:px-7 py-4
        hover:bg-[var(--color-bg)]
        transition-colors duration-150
        focus:outline-none focus:bg-[var(--color-bg)]
      "
    >
      {/* Header: Type badge + Period */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`
            inline-flex px-2 py-0.5
            text-[10px] font-medium uppercase tracking-wide
            rounded-full
            ${typeStyle.bg} ${typeStyle.text}
          `}
        >
          {typeStyle.label}
        </span>
        <span className="text-[11px] text-[var(--color-muted)]">
          {formatReviewPeriod(review.type, review.periodStart, review.periodEnd)}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm text-[var(--color-text)] leading-relaxed mb-2">
        {review.summary}
      </p>

      {/* Markdown preview */}
      <p className="text-[13px] text-[var(--color-muted)] leading-relaxed line-clamp-2 mb-3">
        {truncateMarkdown(review.renderedMarkdown)}
      </p>

      {/* Footer: Reference counts + tap hint */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--color-muted)]">
          {referenceCounts || 'No references'}
        </span>
        <span className="text-[11px] text-[var(--color-muted)] opacity-60">
          tap to read
        </span>
      </div>
    </button>
  )
}
