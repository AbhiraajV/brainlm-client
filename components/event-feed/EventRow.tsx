'use client'

import { ChevronDown, Layers } from 'lucide-react'
import { AnalysisPanel } from './AnalysisPanel'
import { TimeTag } from '@/components/ui/TimeTag'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useEventAnalysis } from '@/hooks/useEventAnalysis'
import { useUiStore, type FullscreenContent } from '@/store/ui.store'

type Event = { id: string; content: string; createdAt: Date; occurredAt: Date | null }

// Parse session log format
interface SessionLogData {
  title: string
  goal?: string
  coach?: string
  eventCount: number
  firstEvent?: string
}

function parseSessionLog(content: string): SessionLogData | null {
  // Check if it's a session log (starts with # and has ## Session Log)
  if (!content.startsWith('# ') || !content.includes('## Session Log')) {
    return null
  }

  const lines = content.split('\n')

  // Extract title (first line after #)
  const title = lines[0]?.replace(/^#\s+/, '').trim() || 'Session'

  // Extract goal
  const goalMatch = content.match(/\*\*Goal:\*\*\s*(.+)/)
  const goal = goalMatch?.[1]?.trim()

  // Extract coach
  const coachMatch = content.match(/\*\*Coach:\*\*\s*(.+)/)
  const coach = coachMatch?.[1]?.trim()

  // Count events (lines starting with "- " that aren't coach comments)
  const eventLines = lines.filter(line => line.match(/^- (?!.*_Coach:)/))
  const eventCount = eventLines.length

  // Get first event content
  const firstEvent = eventLines[0]?.replace(/^-\s+/, '').trim()

  return { title, goal, coach, eventCount, firstEvent }
}

// Session log excerpt component
function SessionLogExcerpt({
  data,
  onClick
}: {
  data: SessionLogData
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-full text-left
        p-3
        border border-[var(--color-line)]
        rounded-[var(--radius-sm)]
        transition-all duration-150
        hover:border-[var(--color-accent)]/50
        focus:outline-none
        cursor-pointer
      "
    >
      {/* Header with icon and title */}
      <div className="flex items-start gap-2.5 mb-2">
        <Layers className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-serif font-semibold text-[var(--color-text)] truncate">
            {data.title}
          </p>
          {data.coach && (
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
              with {data.coach}
            </p>
          )}
        </div>
      </div>

      {/* Goal preview */}
      {data.goal && (
        <p className="text-sm text-[var(--color-muted)] mb-2 line-clamp-1">
          {data.goal}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted)]">
          {data.eventCount} {data.eventCount === 1 ? 'entry' : 'entries'} logged
        </span>
        <span className="text-[11px] text-[var(--color-accent)]">
          View Details
        </span>
      </div>
    </button>
  )
}

export function EventRow({
  event,
  isExpanded,
  onToggle,
  isFirst = false
}: {
  event: Event
  isExpanded: boolean
  onToggle: () => void
  isFirst?: boolean
}) {
  // Use occurredAt if available, otherwise fall back to createdAt
  const displayDate = event.occurredAt || event.createdAt

  // Only poll for recent events (less than 1 day old)
  const isRecentEvent = Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000
  const shouldPoll = isExpanded && isRecentEvent

  // Get polling state for the pulsating dot
  const { isPolling } = useEventAnalysis(event.id, shouldPoll)

  const { openFullscreenReader } = useUiStore()

  // Check if this is a session log
  const sessionLogData = parseSessionLog(event.content)

  // Check if content has markdown (multi-line or contains markdown syntax)
  const hasRichContent = event.content.includes('\n') ||
    event.content.includes('#') ||
    event.content.includes('**') ||
    event.content.includes('- ')

  const handleOpenEvent = () => {
    openFullscreenReader('event', {
      id: event.id,
      content: event.content,
      title: sessionLogData?.title,
      occurredAt: displayDate,
    } as FullscreenContent)
  }

  return (
    <article
      className={`
        px-2.5 py-4
        bg-[var(--color-surface)]
        ${isExpanded ? 'bg-[var(--color-accent)]/[0.02]' : ''}
      `}
    >
      {/* Header row: dot, time, expand button */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          {/* Event dot - pulses when polling */}
          <div
            className={`
              w-2.5 h-2.5 rounded-full flex-shrink-0
              ${isExpanded
                ? 'bg-[var(--color-accent)]'
                : 'bg-[var(--color-line)]'
              }
              ${isExpanded && isPolling ? 'animate-pulse' : ''}
              transition-colors duration-200
            `}
          />
          <TimeTag date={displayDate} />
        </div>

        <button
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse analysis' : 'Expand analysis'}
          className="
            flex items-center gap-1
            text-[11px] font-medium
            text-[var(--color-accent-secondary)]
            transition-all duration-200
            hover:text-[var(--color-accent)]
          "
        >
          <span>{isExpanded ? 'Hide Analysis' : 'Read Analysis'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Event content - full width */}
      {sessionLogData ? (
        <SessionLogExcerpt data={sessionLogData} onClick={handleOpenEvent} />
      ) : hasRichContent ? (
        <button
          onClick={handleOpenEvent}
          className="
            w-full text-left
            py-2 rounded-[var(--radius-sm)]
            transition-all duration-150
            hover:bg-[var(--color-line)]/30
            focus:outline-none
            cursor-pointer
          "
        >
          <div className="markdown-content truncated">
            <MarkdownRenderer content={event.content} truncate />
          </div>
          <p className="text-[11px] text-[var(--color-accent)] mt-2">
            tap to read more
          </p>
        </button>
      ) : (
        <div className="w-full">
          <MarkdownRenderer content={event.content} />
        </div>
      )}

      {/* Analysis section */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
          <div className="flex">
            {/* Continuous thread line */}
            <div className="flex flex-col items-center mr-2">
              <div className="w-0.5 bg-[var(--color-accent-secondary)] rounded-full flex-1" />
            </div>

            {/* Analysis content */}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-accent-secondary)] mb-3 block">
                Analysis
              </span>
              <AnalysisPanel eventId={event.id} enablePolling={isRecentEvent} />
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
