'use server'

import { requireUser } from '@/server/auth'
import { prisma } from '@/server/prisma/client'

export type AnalysisStats = {
  interpretations: number
  patterns: number
  insights: number
  aiCommittees: number
}

export async function getAnalysisStats(dateFilter?: {
  from?: string
  to?: string
}): Promise<AnalysisStats> {
  const user = await requireUser()

  // Build date filter for events
  const dateConditions: Record<string, Date> = {}
  if (dateFilter?.from) {
    dateConditions.gte = new Date(dateFilter.from)
  }
  if (dateFilter?.to) {
    dateConditions.lte = new Date(dateFilter.to)
  }

  const hasDateFilter = Object.keys(dateConditions).length > 0

  // Get event IDs in the date range first (efficient)
  const eventIds = await prisma.event.findMany({
    where: {
      userId: user.id,
      ...(hasDateFilter && { occurredAt: dateConditions })
    },
    select: { id: true }
  }).then(events => events.map(e => e.id))

  if (eventIds.length === 0) {
    return {
      interpretations: 0,
      patterns: 0,
      insights: 0,
      aiCommittees: 0
    }
  }

  // Count all in parallel - these are efficient count queries
  const [interpretations, patternLinks, insightLinks] = await Promise.all([
    // Count interpretations for events in range
    prisma.interpretation.count({
      where: {
        userId: user.id,
        eventId: { in: eventIds }
      }
    }),
    // Count pattern-event links (patterns detected from these events)
    prisma.patternEvent.count({
      where: {
        eventId: { in: eventIds }
      }
    }),
    // Count insight-event links (insights derived from these events)
    prisma.insightEvent.count({
      where: {
        eventId: { in: eventIds }
      }
    })
  ])

  // AI committees: n×2 + m + k (patterns weighted double)
  const aiCommittees = patternLinks * 2 + interpretations + insightLinks

  return {
    interpretations,
    patterns: patternLinks,
    insights: insightLinks,
    aiCommittees
  }
}

export type AnalysisStatus = {
  interpretation: 'missing' | 'present'
  insight: 'missing' | 'present'
  pattern: 'missing' | 'present' | 'exhausted'
  isComplete: boolean
  lastUpdatedAt: Date | null
}

export async function getAnalysisStatus(eventId: string): Promise<AnalysisStatus> {
  const user = await requireUser()

  // Fast existence checks only - no content fetching
  const [interpretation, insightEvent, patternEvent, event] = await Promise.all([
    prisma.interpretation.findFirst({
      where: { eventId, userId: user.id },
      select: { id: true }
    }),
    prisma.insightEvent.findFirst({
      where: { eventId },
      select: { id: true }
    }),
    prisma.patternEvent.findFirst({
      where: { eventId },
      select: { id: true }
    }),
    prisma.event.findUnique({
      where: { id: eventId, userId: user.id },
      select: { createdAt: true }
    })
  ])

  const eventAge = event ? Date.now() - event.createdAt.getTime() : 0

  // PROVISIONAL HEURISTIC: Time-based pattern exhaustion
  // TODO: Replace with explicit DB flag (Event.patternsExhausted) when schema is updated
  // This is a temporary approximation - do not treat as ground truth
  const PATTERN_EXHAUSTION_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
  const patternsExhausted = eventAge > PATTERN_EXHAUSTION_THRESHOLD_MS

  const hasInterpretation = !!interpretation
  const hasInsight = !!insightEvent
  const hasPattern = !!patternEvent

  return {
    interpretation: hasInterpretation ? 'present' : 'missing',
    insight: hasInsight ? 'present' : 'missing',
    pattern: hasPattern ? 'present' : (patternsExhausted ? 'exhausted' : 'missing'),
    isComplete: hasInterpretation && hasInsight && (hasPattern || patternsExhausted),
    lastUpdatedAt: event?.createdAt ?? null
  }
}

export type PatternContribution = {
  id: string
  description: string
  status: string
  eventCount: number
  reinforcementCount: number
  firstDetectedAt: Date
  lastReinforcedAt: Date | null
  contributionType: 'CREATED' | 'REINFORCED'
  originEventId: string | null // null when this event created the pattern
}

export type AnalysisContent = {
  interpretation: { id: string; content: string; source: string } | null
  insights: Array<{
    id: string
    statement: string
    explanation: string
    confidence: string
    status: string
    category: string | null
    temporalScope: string | null
    firstDetectedAt: Date
    lastReinforcedAt: Date | null
  }>
  patterns: PatternContribution[]
}

export async function getAnalysisContent(eventId: string): Promise<AnalysisContent> {
  const user = await requireUser()

  const [interpretation, insightEvents, patternEvents] = await Promise.all([
    prisma.interpretation.findFirst({
      where: { eventId, userId: user.id },
      select: {
        id: true,
        content: true,
        source: true
      }
    }),
    prisma.insightEvent.findMany({
      where: { eventId },
      include: {
        insight: {
          select: {
            id: true,
            statement: true,
            explanation: true,
            confidence: true,
            status: true,
            category: true,
            temporalScope: true,
            firstDetectedAt: true,
            lastReinforcedAt: true,
            userId: true
          }
        }
      }
    }),
    prisma.patternEvent.findMany({
      where: { eventId },
      select: {
        addedAt: true,
        pattern: {
          select: {
            id: true,
            description: true,
            status: true,
            reinforcementCount: true,
            firstDetectedAt: true,
            lastReinforcedAt: true,
            userId: true,
            _count: {
              select: { patternEvents: true }
            }
          }
        }
      }
    })
  ])

  // Filter to only user-owned insights and patterns
  const userInsights = insightEvents
    .filter(ie => ie.insight.userId === user.id)
    .map(ie => ({
      id: ie.insight.id,
      statement: ie.insight.statement,
      explanation: ie.insight.explanation,
      confidence: ie.insight.confidence,
      status: ie.insight.status,
      category: ie.insight.category,
      temporalScope: ie.insight.temporalScope,
      firstDetectedAt: ie.insight.firstDetectedAt,
      lastReinforcedAt: ie.insight.lastReinforcedAt
    }))

  // Filter to user-owned patterns
  const userPatternEvents = patternEvents.filter(pe => pe.pattern.userId === user.id)

  // Get pattern IDs to find the earliest event for each pattern
  const patternIds = userPatternEvents.map(pe => pe.pattern.id)

  // Find the earliest PatternEvent for each pattern to determine origin
  const earliestPatternEvents = patternIds.length > 0
    ? await prisma.patternEvent.findMany({
        where: {
          patternId: { in: patternIds }
        },
        orderBy: { addedAt: 'asc' },
        select: {
          patternId: true,
          eventId: true,
          addedAt: true
        }
      })
    : []

  // Build a map of patternId -> originEventId (earliest event for each pattern)
  const originEventMap = new Map<string, string>()
  for (const pe of earliestPatternEvents) {
    if (!originEventMap.has(pe.patternId)) {
      originEventMap.set(pe.patternId, pe.eventId)
    }
  }

  // Build pattern contributions with type
  // Determine CREATED vs REINFORCED by checking if this event is the origin event
  const userPatterns: PatternContribution[] = userPatternEvents.map(pe => {
    const originEventId = originEventMap.get(pe.pattern.id)
    const isCreated = originEventId === eventId

    return {
      id: pe.pattern.id,
      description: pe.pattern.description,
      status: pe.pattern.status,
      eventCount: pe.pattern._count.patternEvents,
      reinforcementCount: pe.pattern.reinforcementCount,
      firstDetectedAt: pe.pattern.firstDetectedAt,
      lastReinforcedAt: pe.pattern.lastReinforcedAt,
      contributionType: isCreated ? 'CREATED' : 'REINFORCED',
      originEventId: isCreated ? null : originEventId ?? null
    }
  })

  return {
    interpretation: interpretation
      ? { id: interpretation.id, content: interpretation.content, source: interpretation.source }
      : null,
    insights: userInsights,
    patterns: userPatterns
  }
}
