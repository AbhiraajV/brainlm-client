'use server';

/**
 * Session Understanding Server Actions
 *
 * Condenses retrieved session knowledge into a focused, session-relevant
 * markdown summary using an LLM with structured JSON output.
 */

import { requireUser } from '@/server/auth';
import type { SessionKnowledge, TrackerType, SuggestedWorkout, SuggestedDiet } from '@/lib/sessions/types';
import { getBrainTransferPrompt } from '@/server/prompts/tracker-prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// JSON Schema for structured output (strict mode requires all properties in required)
const GYM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    guide: { type: 'string' },
    inferredGoal: { type: ['string', 'null'] },
    brainTransfer: { type: 'string' },
    suggestedWorkout: {
      type: 'object',
      properties: {
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: { type: 'number' },
              reps: { type: 'string' },
              weight: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
            },
            required: ['name', 'sets', 'reps', 'weight', 'notes'],
            additionalProperties: false,
          },
        },
        reason: { type: 'string' },
      },
      required: ['exercises', 'reason'],
      additionalProperties: false,
    },
  },
  required: ['guide', 'inferredGoal', 'brainTransfer', 'suggestedWorkout'],
  additionalProperties: false,
};

const DIET_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    guide: { type: 'string' },
    inferredGoal: { type: ['string', 'null'] },
    brainTransfer: { type: 'string' },
    suggestedDiet: {
      type: 'object',
      properties: {
        meals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string' },
              suggestion: { type: 'string' },
              calories: { type: 'number' },
              protein: { type: 'number' },
              carbs: { type: 'number' },
              fat: { type: 'number' },
              notes: { type: ['string', 'null'] },
            },
            required: ['time', 'suggestion', 'calories', 'protein', 'carbs', 'fat', 'notes'],
            additionalProperties: false,
          },
        },
        dailyTotals: {
          type: 'object',
          properties: {
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
          },
          required: ['calories', 'protein', 'carbs', 'fat'],
          additionalProperties: false,
        },
        reason: { type: 'string' },
      },
      required: ['meals', 'dailyTotals', 'reason'],
      additionalProperties: false,
    },
  },
  required: ['guide', 'inferredGoal', 'brainTransfer', 'suggestedDiet'],
  additionalProperties: false,
};

const GENERAL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    guide: { type: 'string' },
    inferredGoal: { type: ['string', 'null'] },
    brainTransfer: { type: 'string' },
  },
  required: ['guide', 'inferredGoal', 'brainTransfer'],
  additionalProperties: false,
};

function getResponseSchema(trackerType: TrackerType) {
  switch (trackerType) {
    case 'gym':
      return { name: 'gym_brain_transfer', strict: true, schema: GYM_RESPONSE_SCHEMA };
    case 'diet':
      return { name: 'diet_brain_transfer', strict: true, schema: DIET_RESPONSE_SCHEMA };
    default:
      return { name: 'brain_transfer', strict: true, schema: GENERAL_RESPONSE_SCHEMA };
  }
}

// Brain Transfer Prompt - Loads user's self-knowledge into the LLM
const BRAIN_TRANSFER_PROMPT = `You are creating a MEMORY BRIEFING for an AI that will assist the user during a session.

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

// Keep the old constant name for backwards compatibility in the API call
const GOAL_COACH_PROMPT = BRAIN_TRANSFER_PROMPT;

/** Maximum number of interpretations to include (top N by relevance) */
const MAX_INTERPRETATIONS = 20;

/** Maximum number of events to include (linked to included interpretations) */
const MAX_EVENTS = 25;

/**
 * Format knowledge into structured input for brain transfer
 *
 * Includes events and interpretations (the raw data) alongside patterns, insights, and reviews.
 * Events and interpretations are critical for brain transfer - they contain the specific
 * data points that make the output feel like the user's own memories.
 */
function formatKnowledgeForCoach(
  title: string,
  goal: string,
  knowledge: SessionKnowledge
): string {
  const items: string[] = [];

  items.push(`SESSION NAME: ${title}`);
  items.push(`SESSION GOAL: ${goal || '(none provided - please infer an appropriate goal)'}`);
  items.push('');

  // ===========================================
  // CRITICAL CONTEXT (READ THIS FIRST)
  // ===========================================

  // Include today's events FIRST - most important for suggestions
  if (knowledge.todaysEvents && knowledge.todaysEvents.length > 0) {
    items.push('=== TODAY\'S EVENTS (ALREADY DONE TODAY - DO NOT REPEAT) ===');
    for (const event of knowledge.todaysEvents) {
      items.push(`- ${event.content}`);
    }
    items.push('');
  } else {
    items.push('=== TODAY\'S EVENTS ===');
    items.push('(Nothing logged today yet)');
    items.push('');
  }

  // Include yesterday's review - critical for rotation/compensation
  if (knowledge.yesterdaysReview) {
    items.push('=== YESTERDAY (USE THIS FOR ROTATION/COMPENSATION) ===');
    items.push(`Date: ${knowledge.yesterdaysReview.periodKey}`);
    items.push(knowledge.yesterdaysReview.summary);
    items.push('');
  }

  // Include recent daily reviews sorted by date (for workout split pattern)
  const dailyReviews = knowledge.reviews
    .filter(r => r.type === 'daily' || r.periodKey.match(/^\d{4}-\d{2}-\d{2}$/))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
    .slice(0, 7); // Last 7 days

  if (dailyReviews.length > 0) {
    items.push('=== RECENT DAILY HISTORY (LAST 7 DAYS - USE FOR SPLIT/PATTERN) ===');
    for (const review of dailyReviews) {
      items.push(`\n[${review.periodKey}]`);
      items.push(review.summary);
    }
    items.push('');
  }

  // ===========================================
  // USER PROFILE & GOALS
  // ===========================================

  if (knowledge.userBaseline) {
    items.push('=== USER PROFILE (Goals, Targets, Preferences) ===');
    items.push(knowledge.userBaseline);
    items.push('');
  }

  // Include raw events from vector search - historical events relevant to this session
  // These are critical for brain transfer: specific dates, numbers, activities
  if (knowledge.events && knowledge.events.length > 0) {
    const eventsToInclude = knowledge.events.slice(0, MAX_EVENTS);
    items.push('=== HISTORICAL EVENTS (Relevant to This Session) ===');
    items.push('These are past events retrieved by relevance to this session.');
    for (const event of eventsToInclude) {
      items.push(`\n[event, date: ${event.occurredAt}]\n${event.content}`);
    }
    if (knowledge.events.length > MAX_EVENTS) {
      items.push(`\n(${knowledge.events.length - MAX_EVENTS} more events not shown)`);
    }
    items.push('');
  }

  // Include interpretations - the system's understanding of each event
  // These contain specific data points and observations that patterns don't capture
  if (knowledge.interpretations && knowledge.interpretations.length > 0) {
    const interpretationsToInclude = knowledge.interpretations.slice(0, MAX_INTERPRETATIONS);
    items.push('=== INTERPRETATIONS (Analysis of Events) ===');
    items.push('These capture specific observations and data points from events.');
    for (const interp of interpretationsToInclude) {
      items.push(`\n[interpretation, created: ${interp.createdAt}]\n${interp.content}`);
    }
    if (knowledge.interpretations.length > MAX_INTERPRETATIONS) {
      items.push(`\n(${knowledge.interpretations.length - MAX_INTERPRETATIONS} more interpretations not shown)`);
    }
    items.push('');
  }

  items.push('=== SYNTHESIZED KNOWLEDGE ===');
  items.push('(Patterns, insights, and reviews derived from the raw data)');

  for (const pattern of knowledge.patterns) {
    items.push(`\n[type: pattern, id: ${pattern.id}]\n${pattern.description}`);
  }

  for (const insight of knowledge.insights) {
    items.push(`\n[type: insight, id: ${insight.id}]\n${insight.content}`);
  }

  for (const review of knowledge.reviews) {
    items.push(`\n[type: review, id: ${review.id}, period: ${review.periodKey}]\n${review.summary}`);
  }

  return items.join('\n');
}

/**
 * Parse structured JSON response from the LLM
 */
function parseStructuredResponse(
  parsed: Record<string, unknown>,
  trackerType: TrackerType
): {
  guide: string;
  inferredGoal?: string;
  content: string;
  suggestion?: SuggestedWorkout | SuggestedDiet;
} {
  const guide = (parsed.guide as string) || 'Session Coach';
  const inferredGoal = parsed.inferredGoal as string | undefined;
  const content = (parsed.brainTransfer as string) || '';

  let suggestion: SuggestedWorkout | SuggestedDiet | undefined;

  if (trackerType === 'gym' && parsed.suggestedWorkout) {
    const sw = parsed.suggestedWorkout as { exercises: unknown[]; reason: string };
    suggestion = {
      exercises: sw.exercises as SuggestedWorkout['exercises'],
      reason: sw.reason || '',
      generatedAt: new Date().toISOString(),
    };
  } else if (trackerType === 'diet' && parsed.suggestedDiet) {
    const sd = parsed.suggestedDiet as {
      meals: unknown[];
      dailyTotals: { calories: number; protein: number; carbs: number; fat: number };
      reason: string;
    };
    suggestion = {
      meals: sd.meals as SuggestedDiet['meals'],
      dailyTotals: sd.dailyTotals || { calories: 0, protein: 0, carbs: 0, fat: 0 },
      reason: sd.reason || '',
      generatedAt: new Date().toISOString(),
    };
  }

  return { guide, inferredGoal, content, suggestion };
}

/**
 * Generate a goal-oriented coaching brief for the session
 *
 * @param sessionTitle - The session title
 * @param sessionGoal - The session goal (optional - will be inferred if not provided)
 * @param knowledge - The retrieved session knowledge
 * @param trackerType - The specialized tracker type (diet, gym, addiction, general)
 * @returns Coaching brief content, guide name, optionally inferred goal, and suggestion
 */
export async function condenseSessionKnowledge(
  sessionTitle: string,
  sessionGoal: string,
  knowledge: SessionKnowledge,
  trackerType: TrackerType = 'general'
): Promise<{
  content: string;
  guide: string;
  inferredGoal?: string;
  suggestion?: SuggestedWorkout | SuggestedDiet;
} | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[condenseSessionKnowledge] No OpenAI API key');
    return null;
  }

  // Format knowledge into structured input
  const input = formatKnowledgeForCoach(sessionTitle, sessionGoal, knowledge);

  // Use tracker-specific brain transfer prompt
  const brainTransferPrompt = getBrainTransferPrompt(trackerType);

  try {
    // Use structured outputs for gym/diet trackers
    const useStructuredOutput = trackerType === 'gym' || trackerType === 'diet';

    const requestBody: Record<string, unknown> = {
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: brainTransferPrompt },
        { role: 'user', content: input },
      ],
      temperature: 0.6,
      max_tokens: 4000,
    };

    if (useStructuredOutput) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: getResponseSchema(trackerType),
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[condenseSessionKnowledge] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) return null;

    if (useStructuredOutput) {
      // Parse as JSON for structured output
      try {
        const parsed = JSON.parse(rawContent);
        const result = parseStructuredResponse(parsed, trackerType);
        return result;
      } catch (e) {
        console.error('[condenseSessionKnowledge] Failed to parse structured response:', e);
        return null;
      }
    } else {
      // For general/addiction trackers, parse as plain text (legacy format)
      const lines = rawContent.split('\n');
      let guide = 'Session Coach';
      let inferredGoal: string | undefined;
      let contentStartIndex = 0;

      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim();
        if (line.startsWith('GUIDE:')) {
          guide = line.replace('GUIDE:', '').trim();
          contentStartIndex = i + 1;
        } else if (line.startsWith('INFERRED_GOAL:')) {
          inferredGoal = line.replace('INFERRED_GOAL:', '').trim();
          contentStartIndex = i + 1;
        }
      }

      while (contentStartIndex < lines.length && lines[contentStartIndex].trim() === '') {
        contentStartIndex++;
      }

      const content = lines.slice(contentStartIndex).join('\n').trim();
      return { content, guide, inferredGoal };
    }
  } catch (error) {
    console.error('[condenseSessionKnowledge] Error:', error);
    return null;
  }
}
