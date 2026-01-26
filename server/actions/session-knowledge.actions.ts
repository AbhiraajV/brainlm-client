'use server';

/**
 * Session Knowledge Server Actions (v3 - 4-Way Vector Search)
 *
 * Enhanced retrieval with direct vector search on all 4 content types:
 *
 * Phase 1: Vector Search (4 parallel queries)
 *   - Interpretations (direct content from events)
 *   - Patterns (behavioral patterns)
 *   - Insights (synthesized learnings)
 *   - Reviews (daily/weekly summaries)
 *
 * Phase 2: Linked Data Fetching (all parallel)
 *   - Events from interpretations + patterns + reviews
 *   - Additional patterns from events
 *   - Additional insights from interpretations
 *   - Additional interpretations from insights
 *
 * Phase 3: Deduplicate & Return
 *   - Efficient Set-based deduplication
 *   - All results combined and returned
 *
 * Expected performance: 1-3 seconds
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
} from '@/lib/sessions/types';
import { inferTrackerType } from '@/server/prompts/tracker-prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// TUNABLE PARAMETERS (tuned via test-session-coach.ts)
// ============================================================================

/** Number of interpretations to retrieve via direct vector search */
const INTERPRETATIONS_LIMIT = 8;

/** Number of patterns to retrieve via direct vector search */
const PATTERNS_LIMIT = 8;

/** Number of insights to retrieve via direct vector search */
const INSIGHTS_LIMIT = 8;

/** Number of reviews to retrieve via direct vector search */
const REVIEWS_LIMIT = 5;

// ============================================================================
// Types
// ============================================================================

export interface FetchKnowledgeResult {
  seed: string;
  knowledge: SessionKnowledge;
  trackerType: TrackerType;
}

interface RawInterpretation {
  id: string;
  content: string;
  eventId: string;
  createdAt: Date;
}

interface RawPattern {
  id: string;
  description: string;
}

interface RawInsight {
  id: string;
  statement: string;
  createdAt: Date;
}

interface RawReview {
  id: string;
  type: string;
  summary: string;
  periodKey: string;
  eventIds: string[];
  interpretationIds: string[];
  patternIds: string[];
  insightIds: string[];
}

// ============================================================================
// LLM Helpers
// ============================================================================

const SEED_GENERATION_PROMPT = `You are a precise keyword extractor for personal life data retrieval.

Given a session title and context, generate 12-15 HIGHLY SPECIFIC keywords.

RULES:
- Focus on EXACT terms that would appear in relevant data
- Include specific activities, metrics, and outcomes
- Avoid generic terms (health, wellness, lifestyle, routine)
- Do NOT include cross-domain terms unless explicitly in context
- Prioritize nouns and specific actions over adjectives

Output ONLY comma-separated keywords, nothing else.

Example:
Input: title="Morning Gym", context="Track my upper body workouts"
Output: gym, upper body, chest, bench press, shoulders, back, pull-ups, dumbbell, barbell, reps, sets, weight lifted, muscle, PR, strength`;

/**
 * Generate keyword seed from title and context using gpt-4o-mini
 */
async function generateSeed(title: string, context: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.warn('[generateSeed] No OpenAI API key, using fallback');
    return `${title}, ${context}`.toLowerCase();
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SEED_GENERATION_PROMPT },
          { role: 'user', content: `title="${title}", context="${context}"` },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateSeed] OpenAI error:', error);
      return `${title}, ${context}`.toLowerCase();
    }

    const data = await response.json();
    const seed = data.choices?.[0]?.message?.content?.trim();

    if (!seed) {
      return `${title}, ${context}`.toLowerCase();
    }

    return seed;
  } catch (error) {
    console.error('[generateSeed] Error:', error);
    return `${title}, ${context}`.toLowerCase();
  }
}

/**
 * Generate embedding for text using OpenAI text-embedding-3-small
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn('[generateEmbedding] No OpenAI API key');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateEmbedding] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('[generateEmbedding] Error:', error);
    return null;
  }
}

// ============================================================================
// Database Helpers - Vector Search
// ============================================================================

/**
 * Vector search on Interpretations table
 */
async function searchInterpretations(
  userId: string,
  embedding: number[],
  limit: number = INTERPRETATIONS_LIMIT
): Promise<RawInterpretation[]> {
  const embeddingStr = `[${embedding.join(',')}]`;

  return prisma.$queryRaw<RawInterpretation[]>`
    SELECT id, content, "eventId", "createdAt"
    FROM "Interpretation"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${limit}
  `;
}

/**
 * Vector search on Patterns table
 */
async function searchPatterns(
  userId: string,
  embedding: number[],
  limit: number = PATTERNS_LIMIT
): Promise<RawPattern[]> {
  const embeddingStr = `[${embedding.join(',')}]`;

  return prisma.$queryRaw<RawPattern[]>`
    SELECT id, description
    FROM "Pattern"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${limit}
  `;
}

/**
 * Vector search on Insights table
 */
async function searchInsights(
  userId: string,
  embedding: number[],
  limit: number = INSIGHTS_LIMIT
): Promise<RawInsight[]> {
  const embeddingStr = `[${embedding.join(',')}]`;

  return prisma.$queryRaw<RawInsight[]>`
    SELECT id, statement, "createdAt"
    FROM "Insight"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${limit}
  `;
}

/**
 * Vector search on Reviews table
 */
async function searchReviews(
  userId: string,
  embedding: number[],
  limit: number = REVIEWS_LIMIT
): Promise<RawReview[]> {
  const embeddingStr = `[${embedding.join(',')}]`;

  return prisma.$queryRaw<RawReview[]>`
    SELECT id, type, summary, "periodKey", "eventIds", "interpretationIds", "patternIds", "insightIds"
    FROM "Review"
    WHERE "userId" = ${userId}
      AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${limit}
  `;
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

/**
 * Efficient deduplication using pre-built Set
 */
function dedupeWithSet<T extends { id: string }>(items: T[], existingIds: Set<string>): T[] {
  return items.filter((item) => {
    if (existingIds.has(item.id)) return false;
    existingIds.add(item.id);
    return true;
  });
}

// ============================================================================
// Main Action
// ============================================================================

/**
 * Fetch relevant knowledge for a session based on its title and context.
 *
 * Uses 4-way vector search approach:
 * 1. LLM generates a keyword seed from title + context
 * 2. Seed is embedded and used for vector search on ALL 4 content types
 * 3. Linked data is fetched via Prisma joins (all in parallel)
 * 4. Results are deduplicated and returned
 *
 * @param title - The session title
 * @param context - The session context
 * @returns FetchKnowledgeResult with seed and knowledge, or null if retrieval fails
 */
export async function fetchSessionKnowledge(
  title: string,
  context: string
): Promise<FetchKnowledgeResult | null> {
  const startTime = Date.now();
  console.log('[fetchSessionKnowledge] Starting with title:', title);

  const authUser = await requireUser();
  console.log('[fetchSessionKnowledge] User:', authUser.id);

  try {
    // Fetch user with baseline and timezone for goal context
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
    // PHASE 1: Generate seed, embedding, and infer tracker type
    // ========================================================================
    console.log('[fetchSessionKnowledge] Generating seed...');
    const seed = await generateSeed(title, context);
    console.log('[fetchSessionKnowledge] Seed:', seed);

    // Infer tracker type from title and context
    const trackerType = inferTrackerType(title, context);
    console.log('[fetchSessionKnowledge] Tracker type:', trackerType);

    console.log('[fetchSessionKnowledge] Generating embedding...');
    const embedding = await generateEmbedding(seed);

    if (!embedding) {
      console.error('[fetchSessionKnowledge] Failed to generate embedding');
      return {
        seed,
        trackerType,
        knowledge: {
          retrievedAt: new Date().toISOString(),
          seed,
          events: [],
          interpretations: [],
          patterns: [],
          insights: [],
          reviews: [],
        },
      };
    }

    // ========================================================================
    // PHASE 2: 4-Way Vector Search (all parallel)
    // ========================================================================
    console.log('[fetchSessionKnowledge] Running 4-way vector search...');
    const [rawInterpretations, rawPatterns, rawInsights, rawReviews] = await Promise.all([
      searchInterpretations(user.id, embedding),
      searchPatterns(user.id, embedding),
      searchInsights(user.id, embedding),
      searchReviews(user.id, embedding),
    ]);

    console.log(
      '[fetchSessionKnowledge] Direct search found:',
      `interpretations=${rawInterpretations.length}`,
      `patterns=${rawPatterns.length}`,
      `insights=${rawInsights.length}`,
      `reviews=${rawReviews.length}`
    );

    // ========================================================================
    // PHASE 3: Collect IDs for linked data
    // ========================================================================

    // IDs from direct search
    const directInterpretationIds = new Set(rawInterpretations.map((i) => i.id));
    const directPatternIds = new Set(rawPatterns.map((p) => p.id));
    const directInsightIds = new Set(rawInsights.map((i) => i.id));

    // Event IDs from interpretations
    const eventIdsFromInterpretations = rawInterpretations.map((i) => i.eventId);

    // IDs from reviews (these reference other content)
    const eventIdsFromReviews = rawReviews.flatMap((r) => r.eventIds || []);
    const patternIdsFromReviews = rawReviews.flatMap((r) => r.patternIds || []);
    const insightIdsFromReviews = rawReviews.flatMap((r) => r.insightIds || []);
    const interpretationIdsFromReviews = rawReviews.flatMap((r) => r.interpretationIds || []);

    // Combine all event IDs we need to fetch
    const allEventIds = [...new Set([...eventIdsFromInterpretations, ...eventIdsFromReviews])];

    // Pattern IDs to fetch (from reviews, excluding ones we already have from direct search)
    const patternIdsToFetch = patternIdsFromReviews.filter((id) => !directPatternIds.has(id));

    // Insight IDs to fetch (from reviews, excluding ones we already have)
    const insightIdsToFetch = insightIdsFromReviews.filter((id) => !directInsightIds.has(id));

    // Interpretation IDs to fetch (from reviews, excluding ones we already have)
    const interpretationIdsToFetch = interpretationIdsFromReviews.filter((id) => !directInterpretationIds.has(id));

    // ========================================================================
    // PHASE 4: Fetch linked data (all parallel)
    // ========================================================================
    console.log('[fetchSessionKnowledge] Fetching linked data...');

    // Calculate tomorrow for today's events query
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const [
      // Events from interpretations and reviews
      events,
      // Events linked to patterns (via PatternEvent)
      eventsFromPatterns,
      // Additional patterns linked to events (via PatternEvent)
      patternsFromEvents,
      // Additional patterns from reviews
      patternsFromReviews,
      // Additional insights linked to interpretations (via InsightInterpretation)
      insightsFromInterpretations,
      // Additional insights from reviews
      insightsFromReviews,
      // Additional interpretations linked to insights (via InsightInterpretation)
      interpretationsFromInsights,
      // Additional interpretations from reviews
      interpretationsFromReviews,
      // Today's daily plan
      todaysPlan,
      // Yesterday's review
      yesterdaysReview,
      // All events from today (regardless of vector search)
      todaysEvents,
    ] = await Promise.all([
      // Events from interpretations and reviews
      allEventIds.length > 0
        ? prisma.event.findMany({
            where: { id: { in: allEventIds }, userId: user.id },
            select: { id: true, content: true, occurredAt: true },
          })
        : [],

      // Events linked to directly searched patterns (via PatternEvent)
      rawPatterns.length > 0
        ? prisma.event.findMany({
            where: {
              userId: user.id,
              patternEvents: { some: { patternId: { in: rawPatterns.map((p) => p.id) } } },
            },
            select: { id: true, content: true, occurredAt: true },
          })
        : [],

      // Patterns linked to events (may find patterns not in direct search)
      allEventIds.length > 0
        ? prisma.pattern.findMany({
            where: {
              userId: user.id,
              patternEvents: { some: { eventId: { in: allEventIds } } },
            },
            select: { id: true, description: true },
          })
        : [],

      // Patterns from reviews (that weren't in direct search)
      patternIdsToFetch.length > 0
        ? prisma.pattern.findMany({
            where: { id: { in: patternIdsToFetch }, userId: user.id },
            select: { id: true, description: true },
          })
        : [],

      // Insights linked to interpretations (via InsightInterpretation)
      rawInterpretations.length > 0
        ? prisma.insight.findMany({
            where: {
              userId: user.id,
              insightInterpretations: { some: { interpretationId: { in: rawInterpretations.map((i) => i.id) } } },
            },
            select: { id: true, statement: true, createdAt: true },
          })
        : [],

      // Insights from reviews (that weren't in direct search)
      insightIdsToFetch.length > 0
        ? prisma.insight.findMany({
            where: { id: { in: insightIdsToFetch }, userId: user.id },
            select: { id: true, statement: true, createdAt: true },
          })
        : [],

      // Interpretations linked to directly searched insights (via InsightInterpretation)
      rawInsights.length > 0
        ? prisma.interpretation.findMany({
            where: {
              userId: user.id,
              insightInterpretations: { some: { insightId: { in: rawInsights.map((i) => i.id) } } },
            },
            select: { id: true, content: true, eventId: true, createdAt: true },
          })
        : [],

      // Interpretations from reviews (that weren't in direct search)
      interpretationIdsToFetch.length > 0
        ? prisma.interpretation.findMany({
            where: { id: { in: interpretationIdsToFetch }, userId: user.id },
            select: { id: true, content: true, eventId: true, createdAt: true },
          })
        : [],

      // Today's daily plan (for goal context)
      prisma.dailyPlan.findFirst({
        where: {
          userId: user.id,
          targetDate: todayStart,
        },
        select: { id: true, targetDate: true, renderedMarkdown: true },
      }),

      // Yesterday's review (for recent context)
      prisma.review.findFirst({
        where: {
          userId: user.id,
          type: 'DAILY',
          periodKey: yesterday,
        },
        select: { id: true, type: true, summary: true, periodKey: true },
      }),

      // All events from today (for "Today So Far" display)
      prisma.event.findMany({
        where: {
          userId: user.id,
          occurredAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: { id: true, content: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);

    // ========================================================================
    // PHASE 5: Deduplicate and format all results
    // ========================================================================

    // Track seen IDs for efficient deduplication
    const seenEventIds = new Set<string>();
    const seenInterpretationIds = new Set<string>();
    const seenPatternIds = new Set<string>();
    const seenInsightIds = new Set<string>();

    // Format and deduplicate events (from multiple sources)
    const allEvents = [...events, ...eventsFromPatterns];
    const knowledgeEvents: KnowledgeEvent[] = dedupeWithSet(
      allEvents.map((e) => ({
        id: e.id,
        content: e.content,
        occurredAt: e.occurredAt.toISOString(),
      })),
      seenEventIds
    );

    // Format and deduplicate interpretations (direct + linked)
    const allInterpretations = [
      ...rawInterpretations.map((i) => ({
        id: i.id,
        content: i.content,
        eventId: i.eventId,
        createdAt: new Date(i.createdAt).toISOString(),
      })),
      ...interpretationsFromInsights.map((i) => ({
        id: i.id,
        content: i.content,
        eventId: i.eventId,
        createdAt: i.createdAt.toISOString(),
      })),
      ...interpretationsFromReviews.map((i) => ({
        id: i.id,
        content: i.content,
        eventId: i.eventId,
        createdAt: i.createdAt.toISOString(),
      })),
    ];
    const knowledgeInterpretations: KnowledgeInterpretation[] = dedupeWithSet(
      allInterpretations,
      seenInterpretationIds
    );

    // Format and deduplicate patterns (direct + linked)
    const allPatterns = [...rawPatterns, ...patternsFromEvents, ...patternsFromReviews];
    const knowledgePatterns: KnowledgePattern[] = dedupeWithSet(
      allPatterns.map((p) => ({
        id: p.id,
        name: p.description.split('.')[0] || p.description.slice(0, 50),
        description: p.description,
      })),
      seenPatternIds
    );

    // Format and deduplicate insights (direct + linked)
    const allInsights = [
      ...rawInsights.map((i) => ({
        id: i.id,
        content: i.statement,
        createdAt: new Date(i.createdAt).toISOString(),
      })),
      ...insightsFromInterpretations.map((i) => ({
        id: i.id,
        content: i.statement,
        createdAt: i.createdAt.toISOString(),
      })),
      ...insightsFromReviews.map((i) => ({
        id: i.id,
        content: i.statement,
        createdAt: i.createdAt.toISOString(),
      })),
    ];
    const knowledgeInsights: KnowledgeInsight[] = dedupeWithSet(allInsights, seenInsightIds);

    // Format reviews (only from direct search, no duplicates possible)
    const knowledgeReviews: KnowledgeReview[] = rawReviews.map((r) => ({
      id: r.id,
      type: r.type,
      summary: r.summary,
      periodKey: r.periodKey,
    }));

    // Format today's plan if available
    const knowledgeTodaysPlan: KnowledgeDailyPlan | undefined = todaysPlan
      ? {
          id: todaysPlan.id,
          targetDate: todaysPlan.targetDate.toISOString(),
          renderedMarkdown: todaysPlan.renderedMarkdown,
        }
      : undefined;

    // Format yesterday's review if available
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

    const knowledge: SessionKnowledge = {
      retrievedAt: new Date().toISOString(),
      seed,
      events: knowledgeEvents,
      interpretations: knowledgeInterpretations,
      patterns: knowledgePatterns,
      insights: knowledgeInsights,
      reviews: knowledgeReviews,
      userBaseline: user.baseline ?? undefined,
      todaysPlan: knowledgeTodaysPlan,
      yesterdaysReview: knowledgeYesterdaysReview,
      todaysEvents: knowledgeTodaysEvents,
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
      `trackerType=${trackerType}`
    );

    return { seed, knowledge, trackerType };
  } catch (error) {
    console.error('[fetchSessionKnowledge] Error:', error);
    return null;
  }
}
