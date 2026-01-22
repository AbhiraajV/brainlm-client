'use server';

/**
 * Session Understanding Server Actions
 *
 * Condenses retrieved session knowledge into a focused, session-relevant
 * markdown summary using an LLM with a context condenser prompt.
 */

import { requireUser } from '@/server/auth';
import type { SessionKnowledge } from '@/lib/sessions/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

  // Include user's baseline/UOM if available (critical for understanding user context)
  if (knowledge.userBaseline) {
    items.push('=== USER BASELINE PROFILE (UOM) ===');
    items.push('This contains the user\'s goals, metrics, preferences, and personal context.');
    items.push(knowledge.userBaseline);
    items.push('');
  }

  // NOTE: todaysPlan, yesterdaysReview, and todaysEvents are NOT passed to the brain generator.
  // They are displayed directly in the UI. Only the commenting LLM uses them.

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
 * Parse the LLM response to extract guide name, inferred goal, and content
 */
function parseCoachResponse(rawContent: string): { guide: string; inferredGoal?: string; content: string } {
  const lines = rawContent.split('\n');
  let guide = 'Session Coach'; // Default fallback
  let inferredGoal: string | undefined = undefined;
  let contentStartIndex = 0;

  // Look for GUIDE: and INFERRED_GOAL: lines at the beginning
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (line.startsWith('GUIDE:')) {
      guide = line.replace('GUIDE:', '').trim();
      contentStartIndex = i + 1;
    } else if (line.startsWith('INFERRED_GOAL:')) {
      inferredGoal = line.replace('INFERRED_GOAL:', '').trim();
      contentStartIndex = i + 1;
    } else if (line.startsWith('##') || line.length > 0 && !line.startsWith('GUIDE') && !line.startsWith('INFERRED')) {
      // Found content start
      break;
    }
  }

  // Skip blank lines before content
  while (contentStartIndex < lines.length && lines[contentStartIndex].trim() === '') {
    contentStartIndex++;
  }

  const content = lines.slice(contentStartIndex).join('\n').trim();
  return { guide, inferredGoal, content };
}

/**
 * Generate a goal-oriented coaching brief for the session
 *
 * @param sessionTitle - The session title
 * @param sessionGoal - The session goal (optional - will be inferred if not provided)
 * @param knowledge - The retrieved session knowledge
 * @returns Coaching brief content, guide name, and optionally inferred goal
 */
export async function condenseSessionKnowledge(
  sessionTitle: string,
  sessionGoal: string,
  knowledge: SessionKnowledge
): Promise<{ content: string; guide: string; inferredGoal?: string } | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[condenseSessionKnowledge] No OpenAI API key');
    return null;
  }

  // Format knowledge into structured input
  const input = formatKnowledgeForCoach(sessionTitle, sessionGoal, knowledge);

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
          { role: 'system', content: GOAL_COACH_PROMPT },
          { role: 'user', content: input },
        ],
        temperature: 0.6,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[condenseSessionKnowledge] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) return null;

    const { guide, inferredGoal, content } = parseCoachResponse(rawContent);
    return { content, guide, inferredGoal };
  } catch (error) {
    console.error('[condenseSessionKnowledge] Error:', error);
    return null;
  }
}
