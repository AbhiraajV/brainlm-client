'use client'

import { useEventAnalysis } from '@/hooks/useEventAnalysis'
import { ThinkingIndicator } from './ThinkingIndicator'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { useUiStore, type FullscreenContent } from '@/store/ui.store'
import { ArrowUpRight } from 'lucide-react'
import { getById as getEventById } from '@/server/actions/event.actions'

// Section explanations
const SECTION_INFO = {
  interpretation: {
    subtext: 'What this moment reveals about your internal state',
    tooltip: 'Event-local hypothesis that captures nuance before aggregation into patterns. Shallow observation of routines is as valuable as deep psychological analysis.'
  },
  insights: {
    subtext: 'Synthesized understanding across patterns',
    tooltip: 'Cross-domain synthesis with confidence levels (SPECULATIVE \u2192 EMERGING \u2192 LIKELY \u2192 CONFIRMED). Connects dots across your life to reveal overarching themes.'
  },
  patterns: {
    subtext: 'Recurring behaviors detected across events',
    tooltip: 'Temporal recurrence tracking what repeats, under what conditions, and how it\'s changing over time.'
  }
}

function SectionHeader({
  title,
  subtext,
  tooltip
}: {
  title: string
  subtext: string
  tooltip: string
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {title}
        </h3>
        <InfoTooltip content={tooltip} />
      </div>
      <p className="text-[11px] text-[var(--color-muted)]/70 mt-0.5">
        {subtext}
      </p>
    </div>
  )
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors = {
    HIGH: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
    CONFIRMED: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
    MEDIUM: 'bg-[var(--color-warn)]/15 text-[var(--color-warn)]',
    LIKELY: 'bg-[var(--color-warn)]/15 text-[var(--color-warn)]',
    EMERGING: 'bg-[var(--color-muted)]/15 text-[var(--color-muted)]',
    SPECULATIVE: 'bg-[var(--color-muted)]/15 text-[var(--color-muted)]',
  }

  return (
    <span className={`
      inline-flex items-center
      px-2 py-0.5
      text-[10px] font-medium uppercase tracking-wide
      rounded-full
      ${colors[level as keyof typeof colors] || colors.EMERGING}
    `}>
      {level.toLowerCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    ACTIVE: 'text-[var(--color-accent)]',
    DORMANT: 'text-[var(--color-muted)]',
    SUPERSEDED: 'text-[var(--color-muted)] line-through',
  }

  return (
    <span className={`text-[11px] ${colors[status as keyof typeof colors] || ''}`}>
      {status.toLowerCase()}
    </span>
  )
}

function ContributionBadge({ type }: { type: 'CREATED' | 'REINFORCED' }) {
  return (
    <span className={`
      inline-flex items-center
      px-2 py-0.5
      text-[10px] font-medium uppercase tracking-wide
      rounded-full
      ${type === 'CREATED'
        ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
        : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'}
    `}>
      {type === 'CREATED' ? 'new' : 'reinforced'}
    </span>
  )
}

function TappableCard({
  children,
  onClick
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-full text-left
        px-2 py-3 rounded-[var(--radius-sm)]
        bg-[var(--color-bg)]
        transition-all duration-150
        hover:bg-[var(--color-line)]/50
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-[var(--color-accent)]
        focus-visible:ring-offset-1
        cursor-pointer
      "
    >
      {children}
      <p className="text-[11px] text-[var(--color-accent)] mt-2">
        tap to read more
      </p>
    </button>
  )
}

export function AnalysisPanel({ eventId, enablePolling = true }: { eventId: string; enablePolling?: boolean }) {
  const {
    status,
    interpretation,
    insights,
    patterns,
    isPolling,
    isComplete,
    thinkingMessages
  } = useEventAnalysis(eventId, enablePolling)

  const { openFullscreenReader } = useUiStore()

  const handleOpenInterpretation = () => {
    if (!interpretation) return
    openFullscreenReader('interpretation', {
      id: interpretation.id,
      content: interpretation.content,
      source: interpretation.source
    } as FullscreenContent)
  }

  const handleOpenInsight = (insight: typeof insights[0]) => {
    openFullscreenReader('insight', {
      id: insight.id,
      statement: insight.statement,
      explanation: insight.explanation,
      confidence: insight.confidence,
      status: insight.status,
      category: insight.category ?? undefined,
      temporalScope: insight.temporalScope ?? undefined,
      firstDetectedAt: insight.firstDetectedAt,
      lastReinforcedAt: insight.lastReinforcedAt ?? undefined
    } as FullscreenContent)
  }

  const handleOpenPattern = (pattern: typeof patterns[0]) => {
    openFullscreenReader('pattern', {
      id: pattern.id,
      description: pattern.description,
      status: pattern.status,
      eventCount: pattern.eventCount,
      reinforcementCount: pattern.reinforcementCount,
      firstDetectedAt: pattern.firstDetectedAt,
      lastReinforcedAt: pattern.lastReinforcedAt ?? undefined
    } as FullscreenContent)
  }

  const handleOpenOriginEvent = async (originEventId: string, pattern: typeof patterns[0]) => {
    try {
      const event = await getEventById(originEventId)
      if (event) {
        openFullscreenReader('event', {
          id: event.id,
          title: 'Origin Event',
          content: event.content,
          occurredAt: event.occurredAt ?? undefined,
          // Include pattern info for the dropdown
          description: pattern.description,
          status: pattern.status,
          eventCount: pattern.eventCount,
          reinforcementCount: pattern.reinforcementCount,
          firstDetectedAt: pattern.firstDetectedAt,
          lastReinforcedAt: pattern.lastReinforcedAt ?? undefined
        } as FullscreenContent)
      }
    } catch (error) {
      console.error('Failed to fetch origin event:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Interpretation Section */}
      <section>
        <SectionHeader
          title="Interpretation"
          subtext={SECTION_INFO.interpretation.subtext}
          tooltip={SECTION_INFO.interpretation.tooltip}
        />
        {interpretation ? (
          <TappableCard onClick={handleOpenInterpretation}>
            <div className="markdown-content truncated">
              <MarkdownRenderer content={interpretation.content} truncate />
            </div>
          </TappableCard>
        ) : (
          <ThinkingIndicator message={thinkingMessages[0]} isPolling={isPolling} />
        )}
      </section>

      {/* Insights Section */}
      <section>
        <SectionHeader
          title="Insights"
          subtext={SECTION_INFO.insights.subtext}
          tooltip={SECTION_INFO.insights.tooltip}
        />
        {insights.length > 0 ? (
          <ul className="space-y-3">
            {insights.map(insight => (
              <li key={insight.id}>
                <TappableCard onClick={() => handleOpenInsight(insight)}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    {/* Copper accent indicator for insights */}
                    <div className="flex items-start gap-2">
                      <div className="w-1 h-4 mt-0.5 rounded-full bg-[var(--color-accent-secondary)] flex-shrink-0" />
                      <p className="font-medium text-[var(--color-text)]">
                        {insight.statement}
                      </p>
                    </div>
                    <ConfidenceBadge level={insight.confidence} />
                  </div>
                  <div className="markdown-content truncated ml-3">
                    <MarkdownRenderer content={insight.explanation} truncate />
                  </div>
                </TappableCard>
              </li>
            ))}
          </ul>
        ) : isPolling ? (
          <ThinkingIndicator message={thinkingMessages[1]} isPolling={isPolling} />
        ) : (
          <p className="text-sm text-[var(--color-muted)] italic">
            No insights yet
          </p>
        )}
      </section>

      {/* Patterns Section */}
      <section>
        <SectionHeader
          title="Patterns"
          subtext={SECTION_INFO.patterns.subtext}
          tooltip={SECTION_INFO.patterns.tooltip}
        />
        {patterns.length > 0 ? (
          <ul className="space-y-3">
            {patterns.map(pattern => (
              <li key={pattern.id}>
                {pattern.contributionType === 'CREATED' ? (
                  // Pattern was created by this event - show full card
                  <TappableCard onClick={() => handleOpenPattern(pattern)}>
                    <div className="flex items-start gap-3">
                      {/* Pattern indicator */}
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-success)] flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ContributionBadge type="CREATED" />
                        </div>
                        <div className="markdown-content truncated-1">
                          <MarkdownRenderer content={pattern.description} truncate />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={pattern.status} />
                        </div>
                      </div>
                    </div>
                  </TappableCard>
                ) : (
                  // Pattern was reinforced by this event - show compact reinforcement card
                  <div className="px-2 py-3 rounded-[var(--radius-sm)] bg-[var(--color-bg)] border border-[var(--color-line)]/50">
                    <div className="flex items-start gap-3">
                      {/* Reinforcement indicator */}
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ContributionBadge type="REINFORCED" />
                          <span className="text-[11px] text-[var(--color-accent)]">
                            {pattern.reinforcementCount}× total
                          </span>
                        </div>
                        <div className="markdown-content truncated-1 text-[var(--color-muted)]">
                          <MarkdownRenderer content={pattern.description} truncate />
                        </div>
                        {pattern.originEventId && (
                          <button
                            onClick={() => handleOpenOriginEvent(pattern.originEventId!, pattern)}
                            className="
                              flex items-center gap-1 mt-2
                              text-[11px] text-[var(--color-accent)]
                              hover:text-[var(--color-accent-secondary)]
                              transition-colors
                            "
                          >
                            <span>View origin event</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : status?.pattern === 'exhausted' ? (
          <p className="text-sm text-[var(--color-muted)] italic">
            No patterns detected yet
          </p>
        ) : (
          <ThinkingIndicator message={thinkingMessages[2]} isPolling={isPolling} />
        )}
      </section>

      {/* Processing indicator for incomplete analysis */}
      {!isComplete && !isPolling && (
        <div className="flex items-center gap-2 pt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse-subtle" />
          <p className="text-xs text-[var(--color-muted)]">
            Analysis processing in background...
          </p>
        </div>
      )}
    </div>
  )
}
