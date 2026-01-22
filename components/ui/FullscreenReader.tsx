'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useUiStore } from '@/store/ui.store'

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1d ago'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function formatReviewPeriod(type: 'DAILY' | 'WEEKLY' | 'MONTHLY', periodStart: Date, periodEnd: Date): string {
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  if (type === 'DAILY') {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (type === 'WEEKLY') {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `Week of ${startStr} - ${endStr}`
  }
  return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function PatternDropdown({
  description,
  status,
  eventCount,
  reinforcementCount,
  firstDetectedAt,
  lastReinforcedAt
}: {
  description: string
  status?: string
  eventCount?: number
  reinforcementCount?: number
  firstDetectedAt?: Date
  lastReinforcedAt?: Date
}) {
  const [isExpanded, setIsExpanded] = useState(true) // Default expanded

  return (
    <div className="mt-6 border border-[var(--color-line)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          w-full flex items-center justify-between
          px-4 py-3
          bg-[var(--color-bg)]
          text-left
          hover:bg-[var(--color-line)]/30
          transition-colors
        "
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text)]">
            Pattern Created From This Event
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-[var(--color-line)]">
          <div className="markdown-content">
            <MarkdownRenderer content={description} />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--color-line)]/50">
            {status && (
              <span className={`
                inline-flex px-2 py-0.5
                text-[10px] font-medium uppercase tracking-wide
                rounded-full
                ${status === 'ACTIVE' ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' :
                  'bg-[var(--color-muted)]/15 text-[var(--color-muted)]'}
              `}>
                {status.toLowerCase()}
              </span>
            )}
            {eventCount !== undefined && (
              <span className="text-[11px] text-[var(--color-muted)]">
                {eventCount} {eventCount === 1 ? 'event' : 'events'}
              </span>
            )}
            {reinforcementCount !== undefined && reinforcementCount > 0 && (
              <>
                <span className="text-[var(--color-line)]">·</span>
                <span className="text-[11px] text-[var(--color-accent)]">
                  {reinforcementCount}× reinforced
                </span>
              </>
            )}
            {firstDetectedAt && (
              <>
                <span className="text-[var(--color-line)]">·</span>
                <span className="text-[11px] text-[var(--color-muted)]">
                  First detected {formatRelativeTime(firstDetectedAt)}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function FullscreenReader() {
  const { fullscreenReader, closeFullscreenReader } = useUiStore()
  const { isOpen, contentType, content } = fullscreenReader
  const [isClosing, setIsClosing] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      closeFullscreenReader()
      setIsClosing(false)
    }, 200)
  }

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  // Handle swipe to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart(touch.clientY)
    setTouchCurrent(touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const touch = e.touches[0]
    setTouchCurrent(touch.clientY)
  }

  const handleTouchEnd = () => {
    if (touchStart !== null && touchCurrent !== null) {
      const diff = touchCurrent - touchStart
      if (diff > 100) {
        handleClose()
      }
    }
    setTouchStart(null)
    setTouchCurrent(null)
  }

  const translateY = touchStart !== null && touchCurrent !== null
    ? Math.max(0, touchCurrent - touchStart)
    : 0

  if (!isOpen && !isClosing) return null

  const titles: Record<string, string> = {
    interpretation: 'Interpretation',
    insight: 'Insight',
    pattern: 'Pattern',
    review: 'Review',
    event: 'Event',
    plan: 'Daily Plan',
  }

  const reviewTypeColors: Record<string, string> = {
    DAILY: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]',
    WEEKLY: 'bg-[var(--color-accent-secondary)]/15 text-[var(--color-accent-secondary)]',
    MONTHLY: 'bg-[var(--color-warn)]/15 text-[var(--color-warn)]',
  }

  return (
    <div
      className={`
        fixed inset-0 z-50
        bg-black/40 backdrop-blur-sm
        ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}
      `}
      onClick={handleClose}
    >
      <div
        ref={contentRef}
        className={`
          absolute inset-0
          bg-[var(--color-surface)]
          overflow-hidden
          ${isClosing ? 'fullscreen-reader-exit' : 'fullscreen-reader-enter'}
        `}
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: translateY > 0 ? 'none' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe indicator - only on mobile */}
        <div className="flex justify-center py-2 sm:hidden">
          <div className="w-10 h-1 bg-[var(--color-line)] rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-line)] px-5 pt-4 sm:pt-5 pb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="
                flex items-center gap-2
                text-sm text-[var(--color-muted)]
                hover:text-[var(--color-text)]
                transition-colors
              "
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>

          {/* Title with accent indicator */}
          <div className="flex items-center gap-2 mt-3">
            {contentType === 'insight' && (
              <div className="w-1 h-5 rounded-full bg-[var(--color-accent-secondary)]" />
            )}
            {contentType === 'event' && (
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
            )}
            {contentType === 'plan' && (
              <div className="w-1 h-5 rounded-full bg-[var(--color-warn)]" />
            )}
            <h2 className="font-serif text-xl">
              {contentType === 'event' && content?.title ? content.title :
               contentType === 'plan' && content?.planTitle ? content.planTitle :
               (titles[contentType] || 'Details')}
            </h2>
          </div>

          {/* Event occurred at */}
          {contentType === 'event' && content?.occurredAt && (
            <p className="text-xs text-[var(--color-muted)] mt-1">
              {new Date(content.occurredAt).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </p>
          )}

          {/* Plan target date */}
          {contentType === 'plan' && content?.targetDate && (
            <p className="text-xs text-[var(--color-muted)] mt-1">
              {new Date(content.targetDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}

          {/* Metadata badges */}
          {content && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Review type badge */}
              {contentType === 'review' && content.reviewType && (
                <span className={`
                  inline-flex px-2 py-0.5
                  text-[10px] font-medium uppercase tracking-wide
                  rounded-full
                  ${reviewTypeColors[content.reviewType]}
                `}>
                  {content.reviewType.toLowerCase()}
                </span>
              )}
              {/* Review period */}
              {contentType === 'review' && content.reviewType && content.periodStart && content.periodEnd && (
                <span className="text-[11px] text-[var(--color-muted)]">
                  {formatReviewPeriod(content.reviewType, content.periodStart, content.periodEnd)}
                </span>
              )}
              {content.source && (
                <span className="
                  inline-flex px-2 py-0.5
                  text-[10px] font-medium uppercase tracking-wide
                  bg-[var(--color-bg)] text-[var(--color-muted)]
                  rounded-full
                ">
                  {content.source}
                </span>
              )}
              {content.confidence && (
                <span className={`
                  inline-flex px-2 py-0.5
                  text-[10px] font-medium uppercase tracking-wide
                  rounded-full
                  ${content.confidence === 'HIGH' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' :
                    content.confidence === 'MEDIUM' ? 'bg-[var(--color-warn)]/15 text-[var(--color-warn)]' :
                    'bg-[var(--color-muted)]/15 text-[var(--color-muted)]'}
                `}>
                  {content.confidence.toLowerCase()}
                </span>
              )}
              {content.status && (
                <span className={`
                  inline-flex px-2 py-0.5
                  text-[10px] font-medium uppercase tracking-wide
                  rounded-full
                  ${content.status === 'ACTIVE' ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]' :
                    'bg-[var(--color-muted)]/15 text-[var(--color-muted)]'}
                `}>
                  {content.status.toLowerCase()}
                </span>
              )}
              {content.category && (
                <span className="
                  inline-flex px-2 py-0.5
                  text-[10px] font-medium uppercase tracking-wide
                  bg-[var(--color-bg)] text-[var(--color-muted)]
                  rounded-full
                ">
                  {content.category}
                </span>
              )}
              {content.temporalScope && (
                <span className="
                  inline-flex px-2 py-0.5
                  text-[10px] font-medium uppercase tracking-wide
                  bg-[var(--color-bg)] text-[var(--color-muted)]
                  rounded-full
                ">
                  {content.temporalScope}
                </span>
              )}
              {content.firstDetectedAt && (
                <span className="text-[11px] text-[var(--color-muted)]">
                  First detected {formatRelativeTime(content.firstDetectedAt)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-3 py-4 overflow-y-auto h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)]">
          {content?.content && (
            <MarkdownRenderer content={content.content} />
          )}
          {content?.statement && (
            <div className="mb-4">
              <h3 className="font-serif text-lg font-semibold mb-2 text-[var(--color-accent-secondary)]">
                {content.statement}
              </h3>
            </div>
          )}
          {/* Review summary */}
          {contentType === 'review' && content?.summary && (
            <div className="mb-6 p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-line)]">
              <p className="text-sm text-[var(--color-text)] leading-relaxed italic">
                {content.summary}
              </p>
            </div>
          )}
          {content?.explanation && (
            <MarkdownRenderer content={content.explanation} />
          )}
          {/* For pattern content type, show description directly */}
          {contentType === 'pattern' && content?.description && (
            <MarkdownRenderer content={content.description} />
          )}

          {/* Pattern dropdown for origin events - shown when event has pattern info */}
          {contentType === 'event' && content?.description && (
            <PatternDropdown
              description={content.description}
              status={content.status}
              eventCount={content.eventCount}
              reinforcementCount={content.reinforcementCount}
              firstDetectedAt={content.firstDetectedAt}
              lastReinforcedAt={content.lastReinforcedAt}
            />
          )}

          {/* Event count and reinforcement for patterns (not for events with pattern info) */}
          {contentType === 'pattern' && content?.eventCount !== undefined && (
            <div className="mt-6 pt-4 border-t border-[var(--color-line)]">
              <p className="text-sm text-[var(--color-muted)]">
                Detected in <span className="font-medium text-[var(--color-text)]">{content.eventCount}</span> {content.eventCount === 1 ? 'event' : 'events'}
              </p>
              {content?.reinforcementCount !== undefined && (
                <p className="text-sm text-[var(--color-muted)] mt-1">
                  Reinforced <span className="font-medium text-[var(--color-accent)]">{content.reinforcementCount}</span> {content.reinforcementCount === 1 ? 'time' : 'times'}
                </p>
              )}
            </div>
          )}

          {/* Last reinforced at (for pattern content type only) */}
          {contentType === 'pattern' && content?.lastReinforcedAt && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Last reinforced {formatRelativeTime(content.lastReinforcedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
