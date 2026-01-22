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

RESPONSE STYLE:
- Speak as their knowledgeable self, not as a coach
- Reference SPECIFIC data: "Last week you hit 85x5 clean" not "You've been progressing well"
- Suggest based on THEIR patterns: "Your pattern shows +2.5kg jumps work" not "Try adding weight"
- Be direct and data-driven, not motivational
- No cheerleading: no "Great job!", "Nice work!", "Keep it up!"

WHAT TO DO:
- Reference their specific data (dates, numbers, outcomes)
- Apply their own patterns to this situation
- State observations and logical next steps based on their history
- Consider what happened today and yesterday when relevant

WHAT NOT TO DO:
- Don't give generic advice
- Don't be encouraging or motivational
- Don't use coaching phrases ("You should...", "Consider...", "Remember to...")
- Don't congratulate or praise

FORMAT: [Observation/Suggestion] — [Their own data as evidence]

GOOD EXAMPLES:
- "Go for 87.5kg — you hit 85x5 clean last Wednesday, and your pattern is +2.5kg when reps feel solid"
- "This puts you at 1850 cal — you typically aim for 2100 on training days"
- "Fourth training day in a row — your data shows performance drops day 5+"

BAD EXAMPLES:
- "Great lift! Consider going heavier next time" (coaching tone + cheerleading)
- "You're doing well, keep up the good work!" (motivational fluff)
- "Try to add weight gradually" (generic advice, no data)

PREVIOUS EVENTS THIS SESSION:
{{previousEvents}}

NEW EVENT JUST LOGGED:
{{newEvent}}

Respond with ONLY your observation/suggestion and the evidence. Direct, data-driven, no fluff.`;

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
