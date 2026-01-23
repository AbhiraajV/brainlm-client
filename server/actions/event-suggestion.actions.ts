'use server';

/**
 * Event Suggestion Server Actions
 *
 * Provides real-time LLM-powered coaching suggestions after each event is logged.
 * The LLM acts as the session coach and suggests actionable next steps.
 */

import { requireUser } from '@/server/auth';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const EVENT_COACH_PROMPT = `You ARE the user's memory for this domain. You know everything they know about their history in this area.

YOUR ROLE: {{guide}}
SESSION CONTEXT: {{goal}}

THE USER'S DOMAIN KNOWLEDGE:
{{keyContext}}

{{yesterdaysReviewSection}}

{{todaysEventsSection}}

When they log an event, respond as if you ARE their brain - with perfect recall of their history. You're their knowledgeable self talking, not a coach giving advice.

=== OUTPUT FORMAT (3 SECTIONS) ===

Your response MUST have exactly 3 sections, minimal and glanceable:

**SECTION 1 - QUANTITATIVE (one line)**
Calculate cumulative totals from ALL previous events + new event.
Format: metric1 | metric2 | metric3 (separated by |)
- Diet: 850/1400 cal | 65g protein | 30g fat | 90g carbs
- Workout: 6 sets | 48 reps | 2 exercises
- Study: 2.5 hrs | 3 topics | 1 practice test
- Track whatever metrics are relevant to the session context

**SECTION 2 - QUALITATIVE (1-2 sentences)**
Brief observation about what's happening based on:
- Today's events pattern
- User's known patterns from their history
- Why this might be happening (stress eating? skipped meal? tired?)

**SECTION 3 - NEXT (one short line)**
Start with "→" - one small actionable suggestion

=== HOW TO CALCULATE TOTALS ===
1. Look at PREVIOUS EVENTS THIS SESSION
2. Extract numeric values from EACH event
3. ADD them together + new event values
4. Show cumulative total

Example: Previous events have 600 cal + 800 cal, new event is 100 cal → Total: 1500 cal

=== EXAMPLE OUTPUTS ===

Diet session example:
---
850/1400 cal | 65g protein | 32g fat

Heavy lunch after skipping breakfast - your pattern shows overeating when meals are skipped.

→ Light 300 cal dinner with 30g protein to hit target
---

Workout session example:
---
6 sets | 48 reps | bench 87.5kg PR

Sleep was 6hrs last night - you typically struggle on set 4+ with poor sleep.

→ Skip the 4th set on incline if form breaks down
---

Study session example:
---
2.5 hrs focused | networking 65% | IAM 80%

Focus dropped after 2 hrs - matches your pattern. Networking still weakest area.

→ 15 min break then 30 mins on VPC subnets
---

=== RULES ===
- BE MINIMAL - no fluff, no cheerleading
- Quantitative line: just numbers and units separated by |
- Qualitative: 1-2 sentences MAX about patterns/causes
- Next: starts with → and is ONE actionable item
- Reference TODAY'S EVENTS to understand daily context

PREVIOUS EVENTS THIS SESSION:
{{previousEvents}}

NEW EVENT JUST LOGGED:
{{newEvent}}

Respond with exactly 3 sections: Quantitative | Qualitative | → Next`;

interface PreviousEvent {
  content: string;
  createdAt: string;
}

interface TodayEvent {
  content: string;
  occurredAt: string;
}

interface YesterdaysReview {
  summary: string;
  periodKey: string;
}

/**
 * Generate an LLM coaching suggestion for a newly logged event
 *
 * @param sessionId - The session ID (for logging purposes)
 * @param eventId - The event ID (for logging purposes)
 * @param eventContent - The content of the new event
 * @param previousEvents - Previous events in this session
 * @param sessionTitle - The session title
 * @param sessionGoal - The session goal (explicit or inferred)
 * @param guide - The session guide name
 * @param keyContext - Domain knowledge from brain transfer
 * @param todaysEvents - All events from today (optional)
 * @param yesterdaysReview - Yesterday's review summary (optional)
 * @returns The suggestion or an error
 */
export async function generateEventSuggestion(
  sessionId: string,
  eventId: string,
  eventContent: string,
  previousEvents: PreviousEvent[],
  sessionTitle: string,
  sessionGoal: string,
  guide: string,
  keyContext: string,
  todaysEvents?: TodayEvent[],
  yesterdaysReview?: YesterdaysReview
): Promise<{ suggestion: string } | { error: string }> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[generateEventSuggestion] No OpenAI API key');
    return { error: 'API configuration error' };
  }

  // Format previous events
  const formattedPreviousEvents = previousEvents.length > 0
    ? previousEvents
        .map((e, i) => `${i + 1}. ${e.content} (${formatRelativeTime(e.createdAt)})`)
        .join('\n')
    : '(none - this is the first event)';

  // Format today's events section
  const todaysEventsSection = todaysEvents && todaysEvents.length > 0
    ? `TODAY'S EVENTS SO FAR:\n${todaysEvents.map((e) => `- ${formatTime(e.occurredAt)}: ${e.content}`).join('\n')}`
    : '';

  // Format yesterday's review section
  const yesterdaysReviewSection = yesterdaysReview
    ? `YESTERDAY (${yesterdaysReview.periodKey}):\n${yesterdaysReview.summary}`
    : '';

  // Build the prompt by replacing placeholders
  const prompt = EVENT_COACH_PROMPT
    .replace('{{guide}}', guide || 'Session Coach')
    .replace('{{goal}}', sessionGoal || 'Make progress on current goals')
    .replace('{{keyContext}}', keyContext || '(No historical context available)')
    .replace('{{todaysEventsSection}}', todaysEventsSection)
    .replace('{{yesterdaysReviewSection}}', yesterdaysReviewSection)
    .replace('{{previousEvents}}', formattedPreviousEvents)
    .replace('{{newEvent}}', eventContent);

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
          { role: 'system', content: prompt },
          { role: 'user', content: `Event: ${eventContent}` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateEventSuggestion] OpenAI error:', error);
      return { error: 'Failed to generate suggestion' };
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content?.trim();

    if (!suggestion) {
      return { error: 'Empty response from AI' };
    }

    return { suggestion };
  } catch (error) {
    console.error('[generateEventSuggestion] Error:', error);
    return { error: 'Network error - please try again' };
  }
}

/**
 * Format a date string as relative time
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string as time (e.g., "9:30 AM")
 */
function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
