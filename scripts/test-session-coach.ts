#!/usr/bin/env npx tsx
/**
 * Session Coach Testing Harness v2
 *
 * A tool for iteratively tuning the Session Coach's retrieval and condensation system.
 * Uses 4-way vector search: Interpretations + Patterns + Insights + Reviews
 *
 * Usage:
 *   npm run test:coach                              # Run all test sessions
 *   npm run test:coach -- --session "Chest"         # Run specific session
 *   npm run test:coach -- --user-id "your-id"       # Use specific user
 *
 * Environment Variables:
 *   DATABASE_URL or DIRECT_URL - Prisma database connection
 *   OPENAI_API_KEY - For embeddings and LLM calls
 *   TEST_USER_ID - Default user ID to test with
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// ============================================================================
// SUCCESS CRITERIA - What "Perfect" Looks Like (Brain Transfer)
// ============================================================================
/**
 * The output is "perfect" when ALL of these criteria are met:
 *
 * 1. MEMORY, NOT ADVICE
 *    - Reading the brief feels like reading your own notes about yourself
 *    - No coaching language: "You should...", "Consider...", "Watch out for..."
 *    - Reads like the user's own detailed self-knowledge
 *
 * 2. SPECIFIC DATA PRESERVED
 *    - "87.5kg x 5 on Jan 15" not "recent bench progress"
 *    - Exact numbers, dates, outcomes preserved
 *    - Tables with actual performance data when available
 *
 * 3. PATTERNS WITH EVIDENCE
 *    - "Sleep <6hrs correlates with -15% strength (observed 4 times)"
 *    - Not just "poor sleep affects workouts"
 *    - Confidence labels: [Speculative] / [Emerging] / [Likely] / [Confirmed]
 *
 * 4. PINPOINTED RETRIEVAL
 *    - "Chest Workout" finds chest-related content across FULL history
 *    - Should find: bench press data, chest exercises, upper body days
 *    - Cross-domain data included as correlations, not warnings
 *
 * 5. NO COACHING TONE
 *    - Zero instances of "You should", "Consider", "Watch out for", "Remember to"
 *    - No motivational fluff: "Great progress!", "Keep it up!"
 *    - Event responses feel like self-talk with data
 *
 * EVALUATION CHECKLIST (for each test session):
 * [ ] Memory tone - Does it read like personal notes, not coaching?
 * [ ] Data preserved - Are exact numbers/dates intact (not summarized)?
 * [ ] Patterns evidenced - Do patterns include sample sizes and confidence?
 * [ ] No coaching language - Zero "you should", "consider", "watch out"?
 * [ ] Cross-domain as correlation - Sleep/diet shown as observed patterns?
 * [ ] Historical depth - Does it find content from weeks/months ago?
 */

// ============================================================================
// TUNABLE PARAMETERS - Adjust these and re-run to iterate
// ============================================================================

/** Number of interpretations to retrieve via direct vector search. Try: 5, 10, 15, 20 */
const INTERPRETATIONS_LIMIT = 8;

/** Number of patterns to retrieve via direct vector search. Try: 5, 10, 15, 20 */
const PATTERNS_LIMIT = 8;

/** Number of insights to retrieve via direct vector search. Try: 5, 10, 15, 20 */
const INSIGHTS_LIMIT = 8;

/** Number of reviews to retrieve via direct vector search. Try: 5, 10, 15 */
const REVIEWS_LIMIT = 5;

/**
 * SEED GENERATION PROMPT
 * Controls what keywords are generated for vector search.
 * More specific = better precision, less noise from unrelated domains
 */
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
 * BRAIN TRANSFER PROMPT - Creates memory briefing for downstream LLM.
 */
const GOAL_COACH_PROMPT = `You are creating a MEMORY BRIEFING for an AI that will assist the user during a session.

Your job is to TRANSFER THE USER'S SELF-KNOWLEDGE about this domain into the AI's context.

CRITICAL: This is NOT coaching advice. This is the user's own memories and knowledge about themselves, organized for an AI to use. The downstream LLM should "become" the user - knowing everything they know about themselves in this domain.

WHAT TO INCLUDE:
1. **Their History** - How they started, where they are now, key milestones
2. **Their Data** - Specific numbers, PRs, metrics, dates (PRESERVE EXACT VALUES)
3. **Their Patterns** - What works for them, what doesn't, correlations they've noticed
4. **Their Preferences** - What they like, avoid, prefer
5. **Their Current State** - Recent events, today's context, cross-domain factors

WHAT NOT TO DO:
- Don't give advice ("You should...", "Consider...", "Try to...")
- Don't use coaching language ("Your goal is...", "Watch out for...", "Remember to...")
- Don't summarize - preserve specific data points with exact numbers and dates
- Don't generalize - keep exact numbers ("87.5kg x 5" not "recent progress")
- Don't motivate - this is data, not encouragement

TONE: This should read like the user's own detailed notes about themselves, not like a coach talking to them.

GOOD EXAMPLES:
- "Started bench at 60kg in March 2024, now at 90kg"
- "Progression pattern: +2.5kg every 2 weeks, stalled week 8-10, broke through after deload"
- "Best chest days: after 7+ hours sleep. Worst: after drinking"
- "Jan 15: 87.5kg x 5 (clean), Jan 8: 85kg x 5 (struggled on rep 5)"

BAD EXAMPLES:
- "You've made great progress on bench press" (coaching tone)
- "Consider adding 2.5kg today" (advice)
- "Watch out for fatigue" (coaching language)
- "Your goal is to hit 100kg" (goal framing)

CROSS-DOMAIN CONTEXT (Include when relevant):
- Sleep patterns that correlate with performance
- How other life factors (stress, alcohol, meals) affect this domain
- Present these as correlations the user has observed, not warnings

OUTPUT FORMAT

FIRST LINE: GUIDE: [Domain Expert Name]
Examples: "Strength Coach", "Study Partner", "Nutrition Tracker", "Gym Coach (Chest Day)"

SECOND LINE (only if goal was inferred): INFERRED_GOAL: [inferred goal]

Then output the brain transfer with these sections:

## [Domain] History
- When started, current level, key milestones
- Progression pattern with specific numbers and dates
- Breakthroughs and setbacks with what caused them

## What Works / What Doesn't
- Best conditions for performance (with evidence)
  Example: "Sleep 7+ hrs → bench improves (observed 8 times)"
- Known failure modes and triggers
  Example: "After drinking → -15% strength (observed 4 times)"
- Personal preferences and aversions

## Recent Performance Data
Use a table when there are 3+ comparable data points:
| Date | Activity | Metrics | Notes |
|------|----------|---------|-------|

Or bullet points for varied activities with specific data.

## Patterns & Correlations
- [Pattern]: [Evidence] [Confidence: Speculative/Emerging/Likely/Confirmed]
- Cross-domain impacts with specific correlations and sample sizes
Example: "Sleep <6hrs correlates with -15% strength (observed 4 times in last month)"

## Current State
- What happened today/yesterday relevant to this session
- Any active factors (sleep last night, stress level, recovery status)
- Recent momentum or stalls
- Unfinished business from recent sessions

## Sources
- Brief list: "X events, Y patterns, Z insights" etc.`;

// ============================================================================
// Test Sessions Configuration
// ============================================================================

interface TestSession {
  title: string;
  context: string;
  description: string;
  expectedContent: string[];
  unexpectedContent: string[];
}

const TEST_SESSIONS: TestSession[] = [
  {
    title: 'Chest Workout',
    context: 'Upper body day focusing on chest',
    description: 'Should find all chest-related workout history across full timeline',
    expectedContent: ['chest', 'bench', 'press', 'upper body', 'workout', 'gym'],
    unexpectedContent: ['leg', 'squat', 'study', 'book', 'reading'],
  },
  {
    title: 'Study Session',
    context: 'AWS Certification prep',
    description: 'Should find study patterns, focus data, and any cross-domain impacts',
    expectedContent: ['study', 'AWS', 'certification', 'learning', 'focus'],
    unexpectedContent: ['chest', 'bench', 'squat', 'calories'],
  },
  {
    title: 'Diet Log',
    context: 'Track meals and calories',
    description: 'Should find diet history, meal patterns, weight goals',
    expectedContent: ['diet', 'meal', 'calorie', 'food', 'weight', 'eating'],
    unexpectedContent: ['bench', 'squat', 'study', 'AWS'],
  },
  {
    title: 'Morning Gym',
    context: 'General workout',
    description: 'Should find ALL gym history, sleep impact, nutrition impact',
    expectedContent: ['gym', 'workout', 'exercise', 'training'],
    unexpectedContent: ['study', 'reading', 'book'],
  },
  {
    title: 'Deep Work',
    context: 'Focused coding session',
    description: 'Should find work patterns, focus data, productivity insights',
    expectedContent: ['work', 'focus', 'coding', 'productive'],
    unexpectedContent: ['chest', 'squat', 'bench'],
  },
];

// ============================================================================
// Types
// ============================================================================

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

interface KnowledgeEvent {
  id: string;
  content: string;
  occurredAt: string;
}

interface KnowledgeInterpretation {
  id: string;
  content: string;
  eventId: string;
  createdAt: string;
}

interface KnowledgePattern {
  id: string;
  name: string;
  description: string;
}

interface KnowledgeInsight {
  id: string;
  content: string;
  createdAt: string;
}

interface KnowledgeReview {
  id: string;
  type: string;
  summary: string;
  periodKey: string;
}

interface KnowledgeDailyPlan {
  id: string;
  targetDate: string;
  renderedMarkdown: string;
}

interface SessionKnowledge {
  retrievedAt: string;
  seed: string;
  events: KnowledgeEvent[];
  interpretations: KnowledgeInterpretation[];
  patterns: KnowledgePattern[];
  insights: KnowledgeInsight[];
  reviews: KnowledgeReview[];
  userBaseline?: string;
  todaysPlan?: KnowledgeDailyPlan;
  yesterdaysReview?: KnowledgeReview;
  todaysEvents?: KnowledgeEvent[];
}

interface TestResult {
  session: TestSession;
  seed: string;
  knowledge: SessionKnowledge;
  understanding: { content: string; guide: string; inferredGoal?: string } | null;
  directSearchCounts: { interpretations: number; patterns: number; insights: number; reviews: number };
  relevanceScore: number;
  retrievalTimeMs: number;
  condensationTimeMs: number;
}

// ============================================================================
// Utilities
// ============================================================================

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function dedupeWithSet<T extends { id: string }>(items: T[], existingIds: Set<string>): T[] {
  return items.filter((item) => {
    if (existingIds.has(item.id)) return false;
    existingIds.add(item.id);
    return true;
  });
}

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
// LLM Helpers
// ============================================================================

async function generateSeed(title: string, context: string): Promise<string> {
  if (!OPENAI_API_KEY) return `${title}, ${context}`.toLowerCase();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: SEED_GENERATION_PROMPT },
          { role: 'user', content: `title="${title}", context="${context}"` },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!response.ok) return `${title}, ${context}`.toLowerCase();
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || `${title}, ${context}`.toLowerCase();
  } catch {
    return `${title}, ${context}`.toLowerCase();
  }
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: 1536 }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

// ============================================================================
// Database Queries - 4-Way Vector Search
// ============================================================================

async function searchInterpretations(userId: string, embedding: number[]): Promise<RawInterpretation[]> {
  const embeddingStr = `[${embedding.join(',')}]`;
  return prisma.$queryRaw<RawInterpretation[]>`
    SELECT id, content, "eventId", "createdAt"
    FROM "Interpretation"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${INTERPRETATIONS_LIMIT}
  `;
}

async function searchPatterns(userId: string, embedding: number[]): Promise<RawPattern[]> {
  const embeddingStr = `[${embedding.join(',')}]`;
  return prisma.$queryRaw<RawPattern[]>`
    SELECT id, description
    FROM "Pattern"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${PATTERNS_LIMIT}
  `;
}

async function searchInsights(userId: string, embedding: number[]): Promise<RawInsight[]> {
  const embeddingStr = `[${embedding.join(',')}]`;
  return prisma.$queryRaw<RawInsight[]>`
    SELECT id, statement, "createdAt"
    FROM "Insight"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${INSIGHTS_LIMIT}
  `;
}

async function searchReviews(userId: string, embedding: number[]): Promise<RawReview[]> {
  const embeddingStr = `[${embedding.join(',')}]`;
  return prisma.$queryRaw<RawReview[]>`
    SELECT id, type, summary, "periodKey", "eventIds", "interpretationIds", "patternIds", "insightIds"
    FROM "Review"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <-> ${embeddingStr}::vector
    LIMIT ${REVIEWS_LIMIT}
  `;
}

// ============================================================================
// Main Retrieval Function (mirrors production with 4-way search)
// ============================================================================

async function fetchSessionKnowledge(
  userId: string,
  title: string,
  context: string,
  timezone: string = 'America/Los_Angeles'
): Promise<{
  seed: string;
  knowledge: SessionKnowledge;
  directSearchCounts: { interpretations: number; patterns: number; insights: number; reviews: number };
}> {
  const { yesterday, todayStart } = getDateKeys(timezone);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { baseline: true } });

  const seed = await generateSeed(title, context);
  const embedding = await generateEmbedding(seed);

  if (!embedding) {
    return {
      seed,
      knowledge: { retrievedAt: new Date().toISOString(), seed, events: [], interpretations: [], patterns: [], insights: [], reviews: [] },
      directSearchCounts: { interpretations: 0, patterns: 0, insights: 0, reviews: 0 },
    };
  }

  // Phase 1: 4-Way Vector Search (all parallel)
  const [rawInterpretations, rawPatterns, rawInsights, rawReviews] = await Promise.all([
    searchInterpretations(userId, embedding),
    searchPatterns(userId, embedding),
    searchInsights(userId, embedding),
    searchReviews(userId, embedding),
  ]);

  const directSearchCounts = {
    interpretations: rawInterpretations.length,
    patterns: rawPatterns.length,
    insights: rawInsights.length,
    reviews: rawReviews.length,
  };

  // Phase 2: Collect IDs for linked data
  const directInterpretationIds = new Set(rawInterpretations.map((i) => i.id));
  const directPatternIds = new Set(rawPatterns.map((p) => p.id));
  const directInsightIds = new Set(rawInsights.map((i) => i.id));

  const eventIdsFromInterpretations = rawInterpretations.map((i) => i.eventId);
  const eventIdsFromReviews = rawReviews.flatMap((r) => r.eventIds || []);
  const patternIdsFromReviews = rawReviews.flatMap((r) => r.patternIds || []);
  const insightIdsFromReviews = rawReviews.flatMap((r) => r.insightIds || []);
  const interpretationIdsFromReviews = rawReviews.flatMap((r) => r.interpretationIds || []);

  const allEventIds = [...new Set([...eventIdsFromInterpretations, ...eventIdsFromReviews])];
  const patternIdsToFetch = patternIdsFromReviews.filter((id) => !directPatternIds.has(id));
  const insightIdsToFetch = insightIdsFromReviews.filter((id) => !directInsightIds.has(id));
  const interpretationIdsToFetch = interpretationIdsFromReviews.filter((id) => !directInterpretationIds.has(id));

  // Calculate tomorrow for today's events query
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  // Phase 3: Fetch linked data (all parallel)
  const [
    events, eventsFromPatterns, patternsFromEvents, patternsFromReviews,
    insightsFromInterpretations, insightsFromReviews, interpretationsFromInsights,
    interpretationsFromReviews, todaysPlan, yesterdaysReview, todaysEvents,
  ] = await Promise.all([
    allEventIds.length > 0 ? prisma.event.findMany({ where: { id: { in: allEventIds }, userId }, select: { id: true, content: true, occurredAt: true } }) : [],
    rawPatterns.length > 0 ? prisma.event.findMany({ where: { userId, patternEvents: { some: { patternId: { in: rawPatterns.map((p) => p.id) } } } }, select: { id: true, content: true, occurredAt: true } }) : [],
    allEventIds.length > 0 ? prisma.pattern.findMany({ where: { userId, patternEvents: { some: { eventId: { in: allEventIds } } } }, select: { id: true, description: true } }) : [],
    patternIdsToFetch.length > 0 ? prisma.pattern.findMany({ where: { id: { in: patternIdsToFetch }, userId }, select: { id: true, description: true } }) : [],
    rawInterpretations.length > 0 ? prisma.insight.findMany({ where: { userId, insightInterpretations: { some: { interpretationId: { in: rawInterpretations.map((i) => i.id) } } } }, select: { id: true, statement: true, createdAt: true } }) : [],
    insightIdsToFetch.length > 0 ? prisma.insight.findMany({ where: { id: { in: insightIdsToFetch }, userId }, select: { id: true, statement: true, createdAt: true } }) : [],
    rawInsights.length > 0 ? prisma.interpretation.findMany({ where: { userId, insightInterpretations: { some: { insightId: { in: rawInsights.map((i) => i.id) } } } }, select: { id: true, content: true, eventId: true, createdAt: true } }) : [],
    interpretationIdsToFetch.length > 0 ? prisma.interpretation.findMany({ where: { id: { in: interpretationIdsToFetch }, userId }, select: { id: true, content: true, eventId: true, createdAt: true } }) : [],
    prisma.dailyPlan.findFirst({ where: { userId, targetDate: todayStart }, select: { id: true, targetDate: true, renderedMarkdown: true } }),
    prisma.review.findFirst({ where: { userId, type: 'DAILY', periodKey: yesterday }, select: { id: true, type: true, summary: true, periodKey: true } }),
    prisma.event.findMany({ where: { userId, occurredAt: { gte: todayStart, lt: tomorrowStart } }, select: { id: true, content: true, occurredAt: true }, orderBy: { occurredAt: 'asc' } }),
  ]);

  // Phase 4: Deduplicate and format
  const seenEventIds = new Set<string>();
  const seenInterpretationIds = new Set<string>();
  const seenPatternIds = new Set<string>();
  const seenInsightIds = new Set<string>();

  const knowledgeEvents: KnowledgeEvent[] = dedupeWithSet(
    [...events, ...eventsFromPatterns].map((e) => ({ id: e.id, content: e.content, occurredAt: e.occurredAt.toISOString() })),
    seenEventIds
  );

  const knowledgeInterpretations: KnowledgeInterpretation[] = dedupeWithSet(
    [
      ...rawInterpretations.map((i) => ({ id: i.id, content: i.content, eventId: i.eventId, createdAt: new Date(i.createdAt).toISOString() })),
      ...interpretationsFromInsights.map((i) => ({ id: i.id, content: i.content, eventId: i.eventId, createdAt: i.createdAt.toISOString() })),
      ...interpretationsFromReviews.map((i) => ({ id: i.id, content: i.content, eventId: i.eventId, createdAt: i.createdAt.toISOString() })),
    ],
    seenInterpretationIds
  );

  const knowledgePatterns: KnowledgePattern[] = dedupeWithSet(
    [...rawPatterns, ...patternsFromEvents, ...patternsFromReviews].map((p) => ({ id: p.id, name: p.description.split('.')[0] || p.description.slice(0, 50), description: p.description })),
    seenPatternIds
  );

  const knowledgeInsights: KnowledgeInsight[] = dedupeWithSet(
    [
      ...rawInsights.map((i) => ({ id: i.id, content: i.statement, createdAt: new Date(i.createdAt).toISOString() })),
      ...insightsFromInterpretations.map((i) => ({ id: i.id, content: i.statement, createdAt: i.createdAt.toISOString() })),
      ...insightsFromReviews.map((i) => ({ id: i.id, content: i.statement, createdAt: i.createdAt.toISOString() })),
    ],
    seenInsightIds
  );

  const knowledgeReviews: KnowledgeReview[] = rawReviews.map((r) => ({ id: r.id, type: r.type, summary: r.summary, periodKey: r.periodKey }));

  const knowledge: SessionKnowledge = {
    retrievedAt: new Date().toISOString(),
    seed,
    events: knowledgeEvents,
    interpretations: knowledgeInterpretations,
    patterns: knowledgePatterns,
    insights: knowledgeInsights,
    reviews: knowledgeReviews,
    userBaseline: user?.baseline ?? undefined,
    todaysPlan: todaysPlan ? { id: todaysPlan.id, targetDate: todaysPlan.targetDate.toISOString(), renderedMarkdown: todaysPlan.renderedMarkdown } : undefined,
    yesterdaysReview: yesterdaysReview ? { id: yesterdaysReview.id, type: yesterdaysReview.type, summary: yesterdaysReview.summary, periodKey: yesterdaysReview.periodKey } : undefined,
    todaysEvents: todaysEvents.map((e) => ({ id: e.id, content: e.content, occurredAt: e.occurredAt.toISOString() })),
  };

  return { seed, knowledge, directSearchCounts };
}

// ============================================================================
// Condensation Function
// ============================================================================

/** Maximum number of interpretations to include in test harness */
const MAX_INTERPRETATIONS = 20;

/** Maximum number of events to include in test harness */
const MAX_EVENTS = 25;

function formatKnowledgeForCoach(title: string, goal: string, knowledge: SessionKnowledge): string {
  const items: string[] = [];
  items.push(`SESSION NAME: ${title}`);
  items.push(`SESSION GOAL: ${goal || '(none provided - please infer an appropriate goal)'}`);
  items.push('');

  if (knowledge.userBaseline) {
    items.push('=== USER BASELINE PROFILE (UOM) ===');
    items.push(knowledge.userBaseline);
    items.push('');
  }
  if (knowledge.todaysPlan) {
    items.push("=== TODAY'S DAILY PLAN ===");
    items.push(knowledge.todaysPlan.renderedMarkdown);
    items.push('');
  }
  if (knowledge.yesterdaysReview) {
    items.push("=== YESTERDAY'S REVIEW ===");
    items.push(knowledge.yesterdaysReview.summary);
    items.push('');
  }

  // Include raw events - the actual things that happened
  if (knowledge.events && knowledge.events.length > 0) {
    const eventsToInclude = knowledge.events.slice(0, MAX_EVENTS);
    items.push('=== RAW EVENTS (What Actually Happened) ===');
    for (const event of eventsToInclude) {
      items.push(`\n[event, date: ${event.occurredAt}]\n${event.content}`);
    }
    if (knowledge.events.length > MAX_EVENTS) {
      items.push(`\n(${knowledge.events.length - MAX_EVENTS} more events not shown)`);
    }
    items.push('');
  }

  // Include interpretations - the system's understanding of each event
  if (knowledge.interpretations && knowledge.interpretations.length > 0) {
    const interpretationsToInclude = knowledge.interpretations.slice(0, MAX_INTERPRETATIONS);
    items.push('=== INTERPRETATIONS (Analysis of Events) ===');
    for (const interp of interpretationsToInclude) {
      items.push(`\n[interpretation, created: ${interp.createdAt}]\n${interp.content}`);
    }
    if (knowledge.interpretations.length > MAX_INTERPRETATIONS) {
      items.push(`\n(${knowledge.interpretations.length - MAX_INTERPRETATIONS} more interpretations not shown)`);
    }
    items.push('');
  }

  items.push('=== SYNTHESIZED KNOWLEDGE ===');
  for (const pattern of knowledge.patterns) items.push(`\n[type: pattern]\n${pattern.description}`);
  for (const insight of knowledge.insights) items.push(`\n[type: insight]\n${insight.content}`);
  for (const review of knowledge.reviews) items.push(`\n[type: review, period: ${review.periodKey}]\n${review.summary}`);

  return items.join('\n');
}

function parseCoachResponse(rawContent: string): { guide: string; inferredGoal?: string; content: string } {
  const lines = rawContent.split('\n');
  let guide = 'Session Coach';
  let inferredGoal: string | undefined;
  let contentStartIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (line.startsWith('GUIDE:')) { guide = line.replace('GUIDE:', '').trim(); contentStartIndex = i + 1; }
    else if (line.startsWith('INFERRED_GOAL:')) { inferredGoal = line.replace('INFERRED_GOAL:', '').trim(); contentStartIndex = i + 1; }
    else if (line.startsWith('##')) break;
  }

  while (contentStartIndex < lines.length && !lines[contentStartIndex].trim()) contentStartIndex++;
  return { guide, inferredGoal, content: lines.slice(contentStartIndex).join('\n').trim() };
}

async function condenseSessionKnowledge(title: string, goal: string, knowledge: SessionKnowledge): Promise<{ content: string; guide: string; inferredGoal?: string } | null> {
  if (!OPENAI_API_KEY) return null;

  const input = formatKnowledgeForCoach(title, goal, knowledge);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'system', content: GOAL_COACH_PROMPT }, { role: 'user', content: input }],
        temperature: 0.6,
        max_tokens: 4000,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;
    return parseCoachResponse(rawContent);
  } catch {
    return null;
  }
}

// ============================================================================
// Relevance Scoring
// ============================================================================

/**
 * SCORING PHILOSOPHY:
 *
 * We measure relevance by checking if EXPECTED content is found.
 * We DO NOT penalize cross-domain content because:
 *
 * 1. Patterns already capture cross-domain relationships
 *    - "Gym performance drops when sleep is poor" contains sleep data but is CRITICAL for gym
 *    - "Study focus improves after morning exercise" contains gym data but is CRITICAL for study
 *    - A pattern about "drinks affecting workouts" SHOULD appear in gym sessions
 *
 * 2. Insights identify causation across domains
 *    - These are pre-computed relationships that SHOULD appear
 *
 * 3. The "unexpectedContent" list is only for MANUAL review
 *    - Shows what cross-domain content was found
 *    - Human reviewer decides if it's valid (pattern-based) or actual noise
 *
 * TRUE quality = Did we find session-relevant content INCLUDING valid cross-domain impacts?
 */
function calculateRelevanceScore(session: TestSession, knowledge: SessionKnowledge, understanding: { content: string } | null): number {
  const allContent = [
    ...knowledge.patterns.map((p) => p.description),
    ...knowledge.insights.map((i) => i.content),
    ...knowledge.reviews.map((r) => r.summary),
    understanding?.content || ''
  ].join(' ').toLowerCase();

  // Score is purely based on finding expected/relevant content (NO penalty for cross-domain)
  const expectedFound = session.expectedContent.filter((k) => allContent.includes(k.toLowerCase())).length;
  return Math.round((expectedFound / session.expectedContent.length) * 100);
}

// ============================================================================
// Test Runner
// ============================================================================

async function runTest(userId: string, session: TestSession): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${session.title} - ${session.context}`);
  console.log(`Expected: ${session.description}`);
  console.log('='.repeat(80));

  const retrievalStart = Date.now();
  const { seed, knowledge, directSearchCounts } = await fetchSessionKnowledge(userId, session.title, session.context);
  const retrievalTimeMs = Date.now() - retrievalStart;

  console.log(`\nSEED: ${seed}`);
  console.log(`\nDIRECT SEARCH (vector search results):`);
  console.log(`  Interpretations: ${directSearchCounts.interpretations}/${INTERPRETATIONS_LIMIT}`);
  console.log(`  Patterns: ${directSearchCounts.patterns}/${PATTERNS_LIMIT}`);
  console.log(`  Insights: ${directSearchCounts.insights}/${INSIGHTS_LIMIT}`);
  console.log(`  Reviews: ${directSearchCounts.reviews}/${REVIEWS_LIMIT}`);

  console.log(`\nTOTAL (after linked data + dedup):`);
  console.log(`  Events: ${knowledge.events.length} | Interpretations: ${knowledge.interpretations.length}`);
  console.log(`  Patterns: ${knowledge.patterns.length} | Insights: ${knowledge.insights.length} | Reviews: ${knowledge.reviews.length}`);
  console.log(`  Today's Events: ${knowledge.todaysEvents?.length ?? 0} | UOM: ${knowledge.userBaseline ? 'Yes' : 'No'}`);
  console.log(`  Today's Plan: ${knowledge.todaysPlan ? 'Yes' : 'No'} | Yesterday's Review: ${knowledge.yesterdaysReview ? 'Yes' : 'No'}`);

  if (knowledge.patterns.length > 0) {
    console.log(`\nSAMPLE PATTERNS:`);
    knowledge.patterns.slice(0, 3).forEach((p, i) => console.log(`  ${i + 1}. ${p.description.slice(0, 100).replace(/\n/g, ' ')}...`));
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log('CONDENSATION:');
  console.log('─'.repeat(80));

  const condensationStart = Date.now();
  const understanding = await condenseSessionKnowledge(session.title, session.context, knowledge);
  const condensationTimeMs = Date.now() - condensationStart;

  if (understanding) {
    console.log(`\nGUIDE: ${understanding.guide}`);
    if (understanding.inferredGoal) console.log(`INFERRED GOAL: ${understanding.inferredGoal}`);
    console.log(`\nBRAIN TRANSFER:\n`);
    console.log(understanding.content);
  } else {
    console.log('\n[ERROR: Failed to generate brain transfer]');
  }

  const relevanceScore = calculateRelevanceScore(session, knowledge, understanding);

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`METRICS: Retrieval ${retrievalTimeMs}ms | Condensation ${condensationTimeMs}ms | Relevance ${relevanceScore.toFixed(0)}/100`);

  const allContent = [...knowledge.patterns.map((p) => p.description), ...knowledge.insights.map((i) => i.content), understanding?.content || ''].join(' ').toLowerCase();
  const foundExpected = session.expectedContent.filter((k) => allContent.includes(k.toLowerCase()));
  const foundUnexpected = session.unexpectedContent.filter((k) => allContent.includes(k.toLowerCase()));

  console.log(`  Expected found: ${foundExpected.length}/${session.expectedContent.length} (${foundExpected.join(', ')})`);
  if (foundUnexpected.length > 0) console.log(`  Unexpected found: ${foundUnexpected.join(', ')} - verify if cross-domain relevant`);

  return { session, seed, knowledge, understanding, directSearchCounts, relevanceScore, retrievalTimeMs, condensationTimeMs };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('┌────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                     SESSION COACH TESTING HARNESS v2                          │');
  console.log('│           4-Way Vector Search: Interpretations + Patterns + Insights + Reviews │');
  console.log('└────────────────────────────────────────────────────────────────────────────────┘');

  console.log('\nTUNABLE PARAMETERS:');
  console.log(`  INTERPRETATIONS_LIMIT: ${INTERPRETATIONS_LIMIT} | PATTERNS_LIMIT: ${PATTERNS_LIMIT}`);
  console.log(`  INSIGHTS_LIMIT: ${INSIGHTS_LIMIT} | REVIEWS_LIMIT: ${REVIEWS_LIMIT}`);

  if (!OPENAI_API_KEY) { console.error('\nERROR: OPENAI_API_KEY not set'); process.exit(1); }

  const args = process.argv.slice(2);
  let userId = process.env.TEST_USER_ID;
  let sessionFilter: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user-id' && args[i + 1]) { userId = args[i + 1]; i++; }
    else if (args[i] === '--session' && args[i + 1]) { sessionFilter = args[i + 1]; i++; }
  }

  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true, email: true } });
    if (firstUser) { userId = firstUser.id; console.log(`\nUsing first user: ${firstUser.email}`); }
    else { console.error('\nERROR: No TEST_USER_ID and no users found'); process.exit(1); }
  }

  console.log(`\nUser ID: ${userId}`);

  const sessions = sessionFilter ? TEST_SESSIONS.filter((s) => s.title.toLowerCase().includes(sessionFilter.toLowerCase())) : TEST_SESSIONS;
  if (sessions.length === 0) { console.error(`\nNo sessions matching: ${sessionFilter}`); process.exit(1); }

  console.log(`\nRunning ${sessions.length} test(s)...`);

  const results: TestResult[] = [];
  for (const session of sessions) results.push(await runTest(userId, session));

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log('\n| Session         | Score | Patterns | Insights | Reviews | Time   |');
  console.log('|-----------------|-------|----------|----------|---------|--------|');
  for (const r of results) {
    const time = r.retrievalTimeMs + r.condensationTimeMs;
    console.log(`| ${r.session.title.padEnd(15)} | ${r.relevanceScore.toFixed(0).padStart(3)}/100 | ${r.knowledge.patterns.length.toString().padStart(8)} | ${r.knowledge.insights.length.toString().padStart(8)} | ${r.knowledge.reviews.length.toString().padStart(7)} | ${time.toString().padStart(4)}ms |`);
  }

  const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
  console.log(`\nAverage relevance: ${avgRelevance.toFixed(1)}/100`);

  if (avgRelevance >= 80) console.log('\n✓ Results look good!');
  else if (avgRelevance >= 50) console.log('\n⚠ Results need improvement. Try adjusting limits or prompts.');
  else console.log('\n✗ Results need significant improvement. Check embeddings exist and increase limits.');

  await prisma.$disconnect();
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
