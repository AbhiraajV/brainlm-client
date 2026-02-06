'use server';

/**
 * Knowledge Delta Server Actions (v2 - TrackerType-Based)
 *
 * Provides delta fetching for incremental knowledge updates.
 * Only fetches items created AFTER the provided timestamps.
 *
 * Used by client-side cache to efficiently update knowledge
 * without refetching everything.
 *
 * Now uses trackerType-based queries instead of vector search.
 */

import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';
import type {
  KnowledgeEvent,
  KnowledgeInterpretation,
  KnowledgePattern,
  KnowledgeInsight,
  KnowledgeReview,
  KnowledgeCacheTimestamps,
  TrackerType,
} from '@/lib/sessions/types';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeDelta {
  events: KnowledgeEvent[];
  interpretations: KnowledgeInterpretation[];
  patterns: KnowledgePattern[];
  insights: KnowledgeInsight[];
  reviews: KnowledgeReview[];
  // Updated timestamps (latest createdAt for each type)
  timestamps: KnowledgeCacheTimestamps;
  // Counts for comparison
  counts: {
    events: number;
    interpretations: number;
    patterns: number;
    insights: number;
    reviews: number;
  };
}

export interface DeltaFetchResult {
  delta: KnowledgeDelta;
  baselineHash: string | null;
  // Fresh data that should always be refetched (not cached)
  fresh: {
    todaysEvents: KnowledgeEvent[];
    yesterdaysReview: KnowledgeReview | null;
    todaysPlan: { id: string; targetDate: string; renderedMarkdown: string } | null;
    userBaseline: string | null;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get today's and yesterday's date keys in user's timezone
 */
function getDateKeys(
  timezone: string
): { today: string; yesterday: string; todayStart: Date; tomorrowStart: Date } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatter.format(yesterdayDate);

  const todayStart = new Date(today + 'T00:00:00');
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  return { today, yesterday, todayStart, tomorrowStart };
}

// ============================================================================
// Delta Fetching
// ============================================================================

/**
 * Fetch knowledge delta - only items created after the provided timestamps.
 * Also fetches fresh data that should always be current (today's events, etc.)
 *
 * @param trackerType - The tracker type for this session (gym, diet, addiction)
 * @param timestamps - Last fetched timestamps for each content type
 * @returns Delta items + fresh data + updated timestamps
 */
export async function fetchKnowledgeDelta(
  trackerType: TrackerType,
  timestamps: KnowledgeCacheTimestamps
): Promise<DeltaFetchResult | null> {
  const startTime = Date.now();
  console.log('[fetchKnowledgeDelta] Starting with trackerType:', trackerType);

  // Don't fetch delta for general sessions
  if (trackerType === 'general') {
    console.warn('[fetchKnowledgeDelta] general sessions not supported');
    return null;
  }

  const authUser = await requireUser();

  try {
    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, baseline: true, timezone: true },
    });

    if (!user) {
      console.error('[fetchKnowledgeDelta] User not found');
      return null;
    }

    const { today, yesterday, todayStart, tomorrowStart } = getDateKeys(user.timezone);
    const baselineHash = user.baseline
      ? createHash('md5').update(user.baseline).digest('hex')
      : null;

    // Parse timestamps (null means fetch all)
    const lastInterpretationAt = timestamps.lastInterpretationAt
      ? new Date(timestamps.lastInterpretationAt)
      : new Date(0);
    const lastPatternAt = timestamps.lastPatternAt
      ? new Date(timestamps.lastPatternAt)
      : new Date(0);
    const lastInsightAt = timestamps.lastInsightAt
      ? new Date(timestamps.lastInsightAt)
      : new Date(0);
    const lastReviewAt = timestamps.lastReviewAt ? new Date(timestamps.lastReviewAt) : new Date(0);
    const lastEventAt = timestamps.lastEventAt ? new Date(timestamps.lastEventAt) : new Date(0);

    const prismaTrackerType = trackerType.toUpperCase() as 'GYM' | 'DIET' | 'ADDICTION';

    // Fetch delta items + fresh data in parallel
    const [
      deltaEvents,
      deltaInterpretations,
      deltaPatterns,
      deltaInsights,
      deltaReviews,
      todaysEvents,
      yesterdaysReview,
      todaysPlan,
      // Also get counts for comparison
      totalInterpretations,
      totalPatterns,
      totalInsights,
      totalReviews,
      totalEvents,
    ] = await Promise.all([
      // Delta events (by trackerType, created after lastEventAt)
      prisma.event.findMany({
        where: {
          userId: user.id,
          trackedType: prismaTrackerType,
          occurredAt: { gt: lastEventAt },
        },
        select: { id: true, content: true, occurredAt: true },
        take: 50,
        orderBy: { occurredAt: 'desc' },
      }),

      // Delta interpretations (for events of this tracker type, created after lastInterpretationAt)
      prisma.interpretation.findMany({
        where: {
          userId: user.id,
          createdAt: { gt: lastInterpretationAt },
          event: { trackedType: prismaTrackerType },
        },
        select: { id: true, content: true, eventId: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),

      // Delta patterns (firstDetectedAt after lastPatternAt, linked to events of this type)
      prisma.pattern.findMany({
        where: {
          userId: user.id,
          firstDetectedAt: { gt: lastPatternAt },
          patternEvents: {
            some: {
              event: { trackedType: prismaTrackerType },
            },
          },
        },
        select: { id: true, description: true, firstDetectedAt: true },
        take: 20,
        orderBy: { firstDetectedAt: 'desc' },
      }),

      // Delta insights (createdAt after lastInsightAt, linked to events of this type)
      prisma.insight.findMany({
        where: {
          userId: user.id,
          createdAt: { gt: lastInsightAt },
          insightEvents: {
            some: {
              event: { trackedType: prismaTrackerType },
            },
          },
        },
        select: { id: true, statement: true, createdAt: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),

      // Delta reviews (createdAt after lastReviewAt)
      prisma.review.findMany({
        where: {
          userId: user.id,
          createdAt: { gt: lastReviewAt },
        },
        select: {
          id: true,
          type: true,
          summary: true,
          periodKey: true,
          createdAt: true,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),

      // Today's events (always fresh)
      prisma.event.findMany({
        where: {
          userId: user.id,
          occurredAt: { gte: todayStart, lt: tomorrowStart },
        },
        select: { id: true, content: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      }),

      // Yesterday's review (always fresh)
      prisma.review.findFirst({
        where: {
          userId: user.id,
          type: 'DAILY',
          periodKey: yesterday,
        },
        select: { id: true, type: true, summary: true, periodKey: true },
      }),

      // Today's plan (always fresh)
      prisma.dailyPlan.findFirst({
        where: {
          userId: user.id,
          targetDate: todayStart,
        },
        select: { id: true, targetDate: true, renderedMarkdown: true },
      }),

      // Total counts for metrics
      prisma.interpretation.count({
        where: { userId: user.id, event: { trackedType: prismaTrackerType } },
      }),
      prisma.pattern.count({
        where: {
          userId: user.id,
          patternEvents: { some: { event: { trackedType: prismaTrackerType } } },
        },
      }),
      prisma.insight.count({
        where: {
          userId: user.id,
          insightEvents: { some: { event: { trackedType: prismaTrackerType } } },
        },
      }),
      prisma.review.count({ where: { userId: user.id } }),
      prisma.event.count({ where: { userId: user.id, trackedType: prismaTrackerType } }),
    ]);

    // Format delta items
    const formattedEvents: KnowledgeEvent[] = deltaEvents.map((e) => ({
      id: e.id,
      content: e.content,
      occurredAt: e.occurredAt.toISOString(),
    }));

    const formattedInterpretations: KnowledgeInterpretation[] = deltaInterpretations.map((i) => ({
      id: i.id,
      content: i.content,
      eventId: i.eventId,
      createdAt: i.createdAt.toISOString(),
    }));

    const formattedPatterns: KnowledgePattern[] = deltaPatterns.map((p) => ({
      id: p.id,
      name: p.description.split('.')[0] || p.description.slice(0, 50),
      description: p.description,
    }));

    const formattedInsights: KnowledgeInsight[] = deltaInsights.map((i) => ({
      id: i.id,
      content: i.statement,
      createdAt: i.createdAt.toISOString(),
    }));

    const formattedReviews: KnowledgeReview[] = deltaReviews.map((r) => ({
      id: r.id,
      type: r.type,
      summary: r.summary,
      periodKey: r.periodKey,
    }));

    // Calculate updated timestamps (latest createdAt for each type)
    const newTimestamps: KnowledgeCacheTimestamps = {
      lastInterpretationAt:
        formattedInterpretations.length > 0
          ? formattedInterpretations.reduce(
              (latest, i) => (i.createdAt > latest ? i.createdAt : latest),
              timestamps.lastInterpretationAt || ''
            )
          : timestamps.lastInterpretationAt,
      lastPatternAt:
        deltaPatterns.length > 0
          ? deltaPatterns.reduce((latest, p) => {
              const pDate = p.firstDetectedAt.toISOString();
              return pDate > latest ? pDate : latest;
            }, timestamps.lastPatternAt || '')
          : timestamps.lastPatternAt,
      lastInsightAt:
        formattedInsights.length > 0
          ? formattedInsights.reduce(
              (latest, i) => (i.createdAt > latest ? i.createdAt : latest),
              timestamps.lastInsightAt || ''
            )
          : timestamps.lastInsightAt,
      lastReviewAt:
        deltaReviews.length > 0
          ? deltaReviews.reduce((latest, r) => {
              const rDate = r.createdAt.toISOString();
              return rDate > latest ? rDate : latest;
            }, timestamps.lastReviewAt || '')
          : timestamps.lastReviewAt,
      lastEventAt:
        formattedEvents.length > 0
          ? formattedEvents.reduce(
              (latest, e) => (e.occurredAt > latest ? e.occurredAt : latest),
              timestamps.lastEventAt || ''
            )
          : timestamps.lastEventAt,
    };

    const elapsed = Date.now() - startTime;
    console.log(
      '[fetchKnowledgeDelta] Complete in',
      elapsed,
      'ms:',
      `deltaEvents=${formattedEvents.length}`,
      `deltaInterpretations=${formattedInterpretations.length}`,
      `deltaPatterns=${formattedPatterns.length}`,
      `deltaInsights=${formattedInsights.length}`,
      `deltaReviews=${formattedReviews.length}`,
      `todaysEvents=${todaysEvents.length}`
    );

    return {
      delta: {
        events: formattedEvents,
        interpretations: formattedInterpretations,
        patterns: formattedPatterns,
        insights: formattedInsights,
        reviews: formattedReviews,
        timestamps: newTimestamps,
        counts: {
          events: totalEvents,
          interpretations: totalInterpretations,
          patterns: totalPatterns,
          insights: totalInsights,
          reviews: totalReviews,
        },
      },
      baselineHash,
      fresh: {
        todaysEvents: todaysEvents.map((e) => ({
          id: e.id,
          content: e.content,
          occurredAt: e.occurredAt.toISOString(),
        })),
        yesterdaysReview: yesterdaysReview
          ? {
              id: yesterdaysReview.id,
              type: yesterdaysReview.type,
              summary: yesterdaysReview.summary,
              periodKey: yesterdaysReview.periodKey,
            }
          : null,
        todaysPlan: todaysPlan
          ? {
              id: todaysPlan.id,
              targetDate: todaysPlan.targetDate.toISOString(),
              renderedMarkdown: todaysPlan.renderedMarkdown,
            }
          : null,
        userBaseline: user.baseline,
      },
    };
  } catch (error) {
    console.error('[fetchKnowledgeDelta] Error:', error);
    return null;
  }
}

/**
 * Get current baseline hash for cache invalidation check.
 * Client calls this to verify if their cached baselineHash is still valid.
 */
export async function getBaselineHash(): Promise<string | null> {
  const authUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { baseline: true },
  });

  if (!user?.baseline) return null;

  return createHash('md5').update(user.baseline).digest('hex');
}

/**
 * Fetch delta events for analysis (events completed to database).
 * Used for incremental analysis updates.
 */
export async function fetchAnalysisDeltaEvents(
  trackerType: TrackerType,
  sinceTimestamp: string | null
): Promise<{
  events: { id: string; content: string; occurredAt: string; rawJson: unknown }[];
  totalCount: number;
} | null> {
  const authUser = await requireUser();

  try {
    const prismaTrackerType = trackerType.toUpperCase() as 'GYM' | 'DIET' | 'ADDICTION' | 'GENERAL' | 'HABIT';
    const since = sinceTimestamp ? new Date(sinceTimestamp) : new Date(0);

    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where: {
          userId: authUser.id,
          trackedType: prismaTrackerType,
          occurredAt: { gt: since },
        },
        select: {
          id: true,
          content: true,
          occurredAt: true,
          rawJson: true,
        },
        orderBy: { occurredAt: 'asc' },
        take: 100,
      }),
      prisma.event.count({
        where: {
          userId: authUser.id,
          trackedType: prismaTrackerType,
        },
      }),
    ]);

    return {
      events: events.map((e) => ({
        id: e.id,
        content: e.content,
        occurredAt: e.occurredAt.toISOString(),
        rawJson: e.rawJson,
      })),
      totalCount,
    };
  } catch (error) {
    console.error('[fetchAnalysisDeltaEvents] Error:', error);
    return null;
  }
}
