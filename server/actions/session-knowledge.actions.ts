'use server';

/**
 * Session Knowledge Server Actions (v4 - TrackerType-Based Queries)
 *
 * Simplified retrieval using direct trackerType queries instead of vector search.
 * This is ~3-10x faster than embedding-based search.
 *
 * Phase 1: Query by TrackerType
 *   - Fetch events by trackedType field
 *   - Fetch same-day context events (general events)
 *
 * Phase 2: Linked Data Fetching (all parallel)
 *   - Patterns linked to events (via PatternEvent junction)
 *   - Insights linked to events (via InsightEvent junction)
 *   - Recent reviews (DAILY, WEEKLY, MONTHLY)
 *
 * Phase 3: Context Data (always fresh)
 *   - Today's events
 *   - Yesterday's review
 *   - Today's plan
 *
 * Expected performance: 100-300ms (vs 1-3 seconds with embeddings)
 */

import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';
import type {
  SessionKnowledge,
  KnowledgeEvent,
  KnowledgeInterpretation,
  KnowledgePattern,
  KnowledgeInsight,
  KnowledgeReview,
  KnowledgeDailyPlan,
  TrackerType,
  MenstrualCycleInfo,
  MenstrualCyclePhase,
} from '@/lib/sessions/types';

// ============================================================================
// TUNABLE PARAMETERS
// ============================================================================

/** Number of tracked events to retrieve */
const TRACKED_EVENTS_LIMIT = 50;

/** Days back to look for reviews */
const REVIEWS_DAYS_BACK = 30;

/** Max reviews to fetch */
const REVIEWS_LIMIT = 10;

// ============================================================================
// Types
// ============================================================================

export interface FetchKnowledgeResult {
  knowledge: SessionKnowledge;
  trackerType: TrackerType;
  seed?: string; // Deprecated - kept for backward compatibility
}

// ============================================================================
// Database Helpers - TrackerType Queries
// ============================================================================

/**
 * Fetch events by trackerType
 */
async function fetchEventsByTrackerType(
  userId: string,
  trackerType: TrackerType,
  limit: number = TRACKED_EVENTS_LIMIT
): Promise<{ id: string; content: string; occurredAt: Date }[]> {
  const prismaTrackerType = trackerType.toUpperCase() as 'GYM' | 'DIET' | 'ADDICTION' | 'GENERAL' | 'HABIT';

  return prisma.event.findMany({
    where: {
      userId,
      trackedType: prismaTrackerType,
    },
    orderBy: { occurredAt: 'desc' },
    take: limit,
    select: {
      id: true,
      content: true,
      occurredAt: true,
    },
  });
}

/**
 * Get unique dates from events for same-day context queries
 */
function getUniqueDates(events: { occurredAt: Date }[]): string[] {
  const dates = new Set<string>();
  for (const event of events) {
    const dateStr = event.occurredAt.toISOString().split('T')[0];
    dates.add(dateStr);
  }
  return Array.from(dates);
}

/**
 * Fetch same-day context events (general events on the same days as tracked events)
 */
async function fetchSameDayContextEvents(
  userId: string,
  trackedDates: string[]
): Promise<{ id: string; content: string; occurredAt: Date }[]> {
  if (trackedDates.length === 0) return [];

  // Build OR conditions for each date
  const dateConditions = trackedDates.map((date) => ({
    occurredAt: {
      gte: new Date(`${date}T00:00:00`),
      lt: new Date(`${date}T23:59:59.999`),
    },
  }));

  return prisma.event.findMany({
    where: {
      userId,
      trackedType: null, // General events only
      OR: dateConditions,
    },
    select: {
      id: true,
      content: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: 'desc' },
    take: 50,
  });
}

/**
 * Fetch patterns linked to events via PatternEvent junction
 */
async function fetchLinkedPatterns(
  userId: string,
  eventIds: string[]
): Promise<{ id: string; description: string }[]> {
  if (eventIds.length === 0) return [];

  return prisma.pattern.findMany({
    where: {
      userId,
      patternEvents: {
        some: {
          eventId: { in: eventIds },
        },
      },
    },
    select: {
      id: true,
      description: true,
    },
  });
}

/**
 * Fetch insights linked to events via InsightEvent junction
 */
async function fetchLinkedInsights(
  userId: string,
  eventIds: string[]
): Promise<{ id: string; statement: string; createdAt: Date }[]> {
  if (eventIds.length === 0) return [];

  return prisma.insight.findMany({
    where: {
      userId,
      insightEvents: {
        some: {
          eventId: { in: eventIds },
        },
      },
    },
    select: {
      id: true,
      statement: true,
      createdAt: true,
    },
  });
}

/**
 * Fetch interpretations for events
 */
async function fetchInterpretationsForEvents(
  userId: string,
  eventIds: string[]
): Promise<{ id: string; content: string; eventId: string; createdAt: Date }[]> {
  if (eventIds.length === 0) return [];

  return prisma.interpretation.findMany({
    where: {
      userId,
      eventId: { in: eventIds },
    },
    select: {
      id: true,
      content: true,
      eventId: true,
      createdAt: true,
    },
  });
}

/**
 * Fetch recent reviews (daily/weekly/monthly)
 */
async function fetchRecentReviews(
  userId: string,
  daysBack: number = REVIEWS_DAYS_BACK,
  limit: number = REVIEWS_LIMIT
): Promise<{ id: string; type: string; summary: string; periodKey: string }[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);

  return prisma.review.findMany({
    where: {
      userId,
      type: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] },
      periodStart: { gte: sinceDate },
    },
    orderBy: { periodStart: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      summary: true,
      periodKey: true,
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get today's and yesterday's date keys in user's timezone
 */
function getDateKeys(timezone: string): { today: string; yesterday: string; todayStart: Date } {
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

  return { today, yesterday, todayStart };
}

// ============================================================================
// Menstrual Cycle Functions
// ============================================================================

/**
 * Calculate current cycle phase based on last period start date
 */
function calculateCyclePhase(
  lastPeriodStart: string,
  cycleLengthDays: number = 28
): { phase: MenstrualCyclePhase; dayOfCycle: number } {
  const start = new Date(lastPeriodStart);
  const today = new Date();
  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dayOfCycle = (daysSinceStart % cycleLengthDays) + 1;

  // Phase boundaries (standard 28-day cycle, adjusted proportionally for other lengths)
  const menstrualEnd = Math.round((5 * cycleLengthDays) / 28);
  const follicularEnd = Math.round((14 * cycleLengthDays) / 28);
  const ovulationEnd = Math.round((17 * cycleLengthDays) / 28);

  if (dayOfCycle <= menstrualEnd) return { phase: 'menstrual', dayOfCycle };
  if (dayOfCycle <= follicularEnd) return { phase: 'follicular', dayOfCycle };
  if (dayOfCycle <= ovulationEnd) return { phase: 'ovulation', dayOfCycle };
  return { phase: 'luteal', dayOfCycle };
}

/**
 * Extract menstrual cycle info from user baseline
 */
function extractCycleFromBaseline(baseline: string | null): MenstrualCycleInfo | null {
  if (!baseline) return null;

  try {
    // Try to find menstrual_cycle JSON in baseline
    const jsonMatch = baseline.match(/"menstrual_cycle"\s*:\s*(\{[^}]+\})/);
    if (jsonMatch) {
      const cycleData = JSON.parse(jsonMatch[1]);
      if (cycleData.lastPeriodStart) {
        const cycleLengthDays = cycleData.cycleLengthDays || 28;
        const { phase, dayOfCycle } = calculateCyclePhase(cycleData.lastPeriodStart, cycleLengthDays);
        return {
          tracking: true,
          lastPeriodStart: cycleData.lastPeriodStart,
          cycleLengthDays,
          currentPhase: phase,
          dayOfCycle,
        };
      }
    }

    // Try to parse entire baseline as JSON
    if (baseline.trim().startsWith('{')) {
      const parsed = JSON.parse(baseline);
      if (parsed.menstrual_cycle?.lastPeriodStart) {
        const cycleLengthDays = parsed.menstrual_cycle.cycleLengthDays || 28;
        const { phase, dayOfCycle } = calculateCyclePhase(
          parsed.menstrual_cycle.lastPeriodStart,
          cycleLengthDays
        );
        return {
          tracking: true,
          lastPeriodStart: parsed.menstrual_cycle.lastPeriodStart,
          cycleLengthDays,
          currentPhase: phase,
          dayOfCycle,
        };
      }
    }
  } catch {
    // JSON parsing failed, try text patterns
  }

  // Look for text patterns like "period started 2024-01-15" or "cycle day 22"
  const periodStartMatch = baseline.match(
    /(?:period|cycle)\s*(?:started|began)\s*(?:on\s*)?(\d{4}-\d{2}-\d{2})/i
  );
  if (periodStartMatch) {
    const { phase, dayOfCycle } = calculateCyclePhase(periodStartMatch[1]);
    return {
      tracking: true,
      lastPeriodStart: periodStartMatch[1],
      cycleLengthDays: 28,
      currentPhase: phase,
      dayOfCycle,
    };
  }

  return null;
}

/**
 * Extract cycle info from yesterday's review or today's events
 */
function extractCycleFromRecentContext(
  yesterdaysReview: { summary: string } | null,
  todaysEvents: { content: string }[]
): MenstrualCycleInfo | null {
  const textsToCheck = [yesterdaysReview?.summary || '', ...todaysEvents.map((e) => e.content)].join(
    ' '
  );

  if (!textsToCheck) return null;

  // "day X of period/cycle"
  const dayMatch = textsToCheck.match(/day\s*(\d+)\s*(?:of\s*)?(?:my\s*)?(?:period|cycle)/i);
  if (dayMatch) {
    const dayOfCycle = parseInt(dayMatch[1], 10);
    // Estimate phase from day
    let phase: MenstrualCyclePhase;
    if (dayOfCycle <= 5) phase = 'menstrual';
    else if (dayOfCycle <= 14) phase = 'follicular';
    else if (dayOfCycle <= 17) phase = 'ovulation';
    else phase = 'luteal';

    return {
      tracking: true,
      cycleLengthDays: 28,
      currentPhase: phase,
      dayOfCycle,
    };
  }

  // "on my period", "started period", "period started"
  const onPeriodMatch = textsToCheck.match(
    /(?:on\s*my\s*period|started\s*(?:my\s*)?period|period\s*started)/i
  );
  if (onPeriodMatch) {
    return {
      tracking: true,
      cycleLengthDays: 28,
      currentPhase: 'menstrual',
      dayOfCycle: 1,
    };
  }

  // "luteal phase", "follicular phase", etc.
  const phaseMatch = textsToCheck.match(/(menstrual|follicular|ovulation|luteal)\s*phase/i);
  if (phaseMatch) {
    const phase = phaseMatch[1].toLowerCase() as MenstrualCyclePhase;
    let dayOfCycle: number;
    switch (phase) {
      case 'menstrual':
        dayOfCycle = 3;
        break;
      case 'follicular':
        dayOfCycle = 10;
        break;
      case 'ovulation':
        dayOfCycle = 15;
        break;
      case 'luteal':
        dayOfCycle = 22;
        break;
    }
    return {
      tracking: true,
      cycleLengthDays: 28,
      currentPhase: phase,
      dayOfCycle,
    };
  }

  return null;
}

// ============================================================================
// Main Action
// ============================================================================

/**
 * Fetch relevant knowledge for a session based on its trackerType.
 *
 * Uses direct trackerType queries instead of vector search:
 * 1. Fetch events by trackedType field
 * 2. Fetch linked patterns/insights via junction tables
 * 3. Fetch same-day context events
 * 4. Fetch recent reviews
 *
 * @param trackerType - The session tracker type (gym, diet, addiction)
 * @returns FetchKnowledgeResult with knowledge, or null if retrieval fails
 */
export async function fetchSessionKnowledge(
  trackerType: TrackerType
): Promise<FetchKnowledgeResult | null> {
  const startTime = Date.now();
  console.log('[fetchSessionKnowledge] Starting with trackerType:', trackerType);

  // Don't fetch knowledge for general sessions (they don't have trackedType)
  if (trackerType === 'general') {
    console.warn('[fetchSessionKnowledge] general sessions not supported, returning empty');
    return {
      trackerType,
      knowledge: {
        retrievedAt: new Date().toISOString(),
        events: [],
        interpretations: [],
        patterns: [],
        insights: [],
        reviews: [],
      },
    };
  }

  const authUser = await requireUser();
  console.log('[fetchSessionKnowledge] User:', authUser.id);

  try {
    // Fetch user with baseline and timezone
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, baseline: true, timezone: true },
    });

    if (!user) {
      console.error('[fetchSessionKnowledge] User not found');
      return null;
    }

    const { today, yesterday, todayStart } = getDateKeys(user.timezone);

    // ========================================================================
    // PHASE 1: Fetch tracked events by type
    // ========================================================================
    console.log('[fetchSessionKnowledge] Fetching events by trackerType...');
    const trackedEvents = await fetchEventsByTrackerType(user.id, trackerType);
    const eventIds = trackedEvents.map((e) => e.id);
    const trackedDates = getUniqueDates(trackedEvents);

    console.log(
      '[fetchSessionKnowledge] Found',
      trackedEvents.length,
      'events on',
      trackedDates.length,
      'unique dates'
    );

    // ========================================================================
    // PHASE 2: Parallel fetches for linked data
    // ========================================================================
    console.log('[fetchSessionKnowledge] Fetching linked data...');

    // Calculate tomorrow for today's events query
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const [
      contextEvents,
      patterns,
      insights,
      interpretations,
      reviews,
      todaysEvents,
      yesterdaysReview,
      todaysPlan,
    ] = await Promise.all([
      // Same-day context events (general events on same days)
      fetchSameDayContextEvents(user.id, trackedDates),
      // Patterns linked to tracked events
      fetchLinkedPatterns(user.id, eventIds),
      // Insights linked to tracked events
      fetchLinkedInsights(user.id, eventIds),
      // Interpretations for tracked events
      fetchInterpretationsForEvents(user.id, eventIds),
      // Recent reviews
      fetchRecentReviews(user.id),
      // All events from today (regardless of type)
      prisma.event.findMany({
        where: {
          userId: user.id,
          occurredAt: { gte: todayStart, lt: tomorrowStart },
        },
        select: { id: true, content: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      }),
      // Yesterday's review
      prisma.review.findFirst({
        where: {
          userId: user.id,
          type: 'DAILY',
          periodKey: yesterday,
        },
        select: { id: true, type: true, summary: true, periodKey: true },
      }),
      // Today's daily plan
      prisma.dailyPlan.findFirst({
        where: {
          userId: user.id,
          targetDate: todayStart,
        },
        select: { id: true, targetDate: true, renderedMarkdown: true },
      }),
    ]);

    // ========================================================================
    // PHASE 3: Format results
    // ========================================================================

    // Combine tracked events and context events, deduplicate
    const seenEventIds = new Set<string>();
    const allEvents = [...trackedEvents, ...contextEvents];
    const knowledgeEvents: KnowledgeEvent[] = allEvents
      .filter((e) => {
        if (seenEventIds.has(e.id)) return false;
        seenEventIds.add(e.id);
        return true;
      })
      .map((e) => ({
        id: e.id,
        content: e.content,
        occurredAt: e.occurredAt.toISOString(),
      }));

    // Format interpretations
    const knowledgeInterpretations: KnowledgeInterpretation[] = interpretations.map((i) => ({
      id: i.id,
      content: i.content,
      eventId: i.eventId,
      createdAt: i.createdAt.toISOString(),
    }));

    // Format patterns
    const knowledgePatterns: KnowledgePattern[] = patterns.map((p) => ({
      id: p.id,
      name: p.description.split('.')[0] || p.description.slice(0, 50),
      description: p.description,
    }));

    // Format insights
    const knowledgeInsights: KnowledgeInsight[] = insights.map((i) => ({
      id: i.id,
      content: i.statement,
      createdAt: i.createdAt.toISOString(),
    }));

    // Format reviews
    const knowledgeReviews: KnowledgeReview[] = reviews.map((r) => ({
      id: r.id,
      type: r.type,
      summary: r.summary,
      periodKey: r.periodKey,
    }));

    // Format today's plan
    const knowledgeTodaysPlan: KnowledgeDailyPlan | undefined = todaysPlan
      ? {
          id: todaysPlan.id,
          targetDate: todaysPlan.targetDate.toISOString(),
          renderedMarkdown: todaysPlan.renderedMarkdown,
        }
      : undefined;

    // Format yesterday's review
    const knowledgeYesterdaysReview: KnowledgeReview | undefined = yesterdaysReview
      ? {
          id: yesterdaysReview.id,
          type: yesterdaysReview.type,
          summary: yesterdaysReview.summary,
          periodKey: yesterdaysReview.periodKey,
        }
      : undefined;

    // Format today's events
    const knowledgeTodaysEvents: KnowledgeEvent[] = todaysEvents.map((e) => ({
      id: e.id,
      content: e.content,
      occurredAt: e.occurredAt.toISOString(),
    }));

    // Extract menstrual cycle phase
    let cyclePhase: MenstrualCycleInfo | null = null;
    cyclePhase = extractCycleFromBaseline(user.baseline);
    if (!cyclePhase) {
      cyclePhase = extractCycleFromRecentContext(
        yesterdaysReview ? { summary: yesterdaysReview.summary } : null,
        todaysEvents.map((e) => ({ content: e.content }))
      );
    }

    const knowledge: SessionKnowledge = {
      retrievedAt: new Date().toISOString(),
      events: knowledgeEvents,
      interpretations: knowledgeInterpretations,
      patterns: knowledgePatterns,
      insights: knowledgeInsights,
      reviews: knowledgeReviews,
      userBaseline: user.baseline ?? undefined,
      todaysPlan: knowledgeTodaysPlan,
      yesterdaysReview: knowledgeYesterdaysReview,
      todaysEvents: knowledgeTodaysEvents,
      cyclePhase: cyclePhase ?? undefined,
    };

    const elapsed = Date.now() - startTime;
    console.log(
      '[fetchSessionKnowledge] Complete in',
      elapsed,
      'ms:',
      `events=${knowledge.events.length}`,
      `interpretations=${knowledge.interpretations.length}`,
      `patterns=${knowledge.patterns.length}`,
      `insights=${knowledge.insights.length}`,
      `reviews=${knowledge.reviews.length}`,
      `todaysEvents=${knowledge.todaysEvents?.length ?? 0}`,
      `hasBaseline=${!!knowledge.userBaseline}`,
      `hasTodaysPlan=${!!knowledge.todaysPlan}`,
      `hasYesterdaysReview=${!!knowledge.yesterdaysReview}`,
      `cyclePhase=${knowledge.cyclePhase?.currentPhase ?? 'none'}`
    );

    return { knowledge, trackerType };
  } catch (error) {
    console.error('[fetchSessionKnowledge] Error:', error);
    return null;
  }
}
