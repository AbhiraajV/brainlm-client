'use client'

import { useState } from 'react'
import { ChevronDown, Layers, PlayCircle, BrainCircuit } from 'lucide-react'
import { AnalysisPanel } from './AnalysisPanel'
import { TimeTag } from '@/components/ui/TimeTag'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { useEventAnalysis } from '@/hooks/useEventAnalysis'
import { useUiStore, type FullscreenContent } from '@/store/ui.store'
import { enqueueEvent } from '@/server/actions/event.actions'

type Event = { id: string; content: string; createdAt: Date; occurredAt: Date | null; trackedType?: string | null }

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

// Tracker type emoji mapping
const TRACKER_EMOJI: Record<string, string> = {
  GYM: '\uD83C\uDFCB\uFE0F',
  DIET: '\uD83C\uDF7D\uFE0F',
  HABIT: '\u2705',
  GENERAL: '\uD83D\uDCAC',
  ADDICTION: '\uD83D\uDCAC',
}

// Session log excerpt component
function SessionLogExcerpt({
  data,
  trackedType,
  onClick
}: {
  data: SessionLogData
  trackedType?: string | null
  onClick: () => void
}) {
  const emoji = trackedType ? TRACKER_EMOJI[trackedType] : null

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
        {emoji ? (
          <span className="text-base flex-shrink-0 mt-0.5">{emoji}</span>
        ) : (
          <Layers className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
        )}
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

  // TEMP: Enqueue button state
  const [enqueueStatus, setEnqueueStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [enqueueError, setEnqueueError] = useState<string | null>(null)

  const handleEnqueue = async () => {
    setEnqueueStatus('loading')
    setEnqueueError(null)
    try {
      const result = await enqueueEvent(event.id)
      if (result.success) {
        setEnqueueStatus('success')
      } else {
        setEnqueueStatus('error')
        setEnqueueError(result.error)
      }
    } catch (err) {
      setEnqueueStatus('error')
      setEnqueueError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

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

        {/* TEMP: Enqueue button commented out - uncomment to manually fix orphaned events
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnqueue}
            disabled={enqueueStatus === 'loading' || enqueueStatus === 'success'}
            title={enqueueError || 'Enqueue for processing'}
            className={`
              flex items-center gap-1
              text-[10px] font-medium
              px-1.5 py-0.5
              rounded
              transition-all duration-200
              ${enqueueStatus === 'success'
                ? 'text-green-600 bg-green-100'
                : enqueueStatus === 'error'
                ? 'text-red-600 bg-red-100'
                : 'text-orange-600 bg-orange-100 hover:bg-orange-200'}
              disabled:opacity-50
            `}
          >
            <PlayCircle className="w-3 h-3" />
            {enqueueStatus === 'loading' ? '...' : enqueueStatus === 'success' ? 'Queued' : enqueueStatus === 'error' ? 'Err' : 'Q'}
          </button>
        </div>
        */}

      </div>

      {/* Event content - full width */}
      {sessionLogData ? (
        <SessionLogExcerpt data={sessionLogData} trackedType={event.trackedType} onClick={handleOpenEvent} />
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

      {/* Deep Analysis button - below event content */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse analysis' : 'Expand analysis'}
        className={`
          flex items-center gap-1.5 mt-3
          text-[11px] font-medium
          px-2.5 py-1 rounded-full
          transition-all duration-200
          ${isExpanded
            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            : 'bg-[var(--color-accent-secondary)]/10 text-[var(--color-accent-secondary)] hover:bg-[var(--color-accent-secondary)]/20'}
        `}
      >
        <BrainCircuit className="w-3.5 h-3.5" />
        <span>{isExpanded ? 'Hide' : 'Deep Analysis'}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

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
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-accent-secondary)] mb-3 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" />
                Deep Analysis
              </span>
              <AnalysisPanel eventId={event.id} enablePolling={isRecentEvent} />
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
