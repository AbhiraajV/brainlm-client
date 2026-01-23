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

=== ADAPTIVE CUMULATIVE TRACKING ===
You MUST provide a running total line at the START of every response. Infer what to track from the session type and goal.

TRACKING RULES:
1. **Infer from session goal** - "Diet Log" → track calories + protein; "Chest Workout" → track sets + reps; "Study Session" → track hours focused
2. **Detect user targets** - If goal mentions a target (e.g., "stay within 1400 cal", "hit 100g protein"), show progress as percentage
3. **Respond to triggers** - If user says "start tracking X" or "help me track X", begin tracking X
4. **Blank slate on first event** - First event MUST show "0 →" transition (e.g., "Session: 0 → 350 cal" or "Running: 0 → 350 cal")
5. **Accumulate from previous events** - Sum up all values from previous events in this session

FORMAT - MUST start with "Session:" or "Running:" (ONE LINE):
- **Diet with target**: "Session: 650/1400 cal (46%) | 45g protein"
- **Diet without target**: "Running: 650 cal | 45g protein"
- **Workout**: "Running: 6 sets | 48 total reps"
- **Study**: "Running: 2 hrs focused"
- **First event (blank slate)**: "Session: 0 → 350 cal" or "Running: 0 → 3 sets"
- **Generic/unclear**: Only track if user explicitly mentions what to track, otherwise skip tracking line

CRITICAL: Line MUST start with exactly "Session:" or "Running:" - never "Running total:" or other variations.

RESPONSE STRUCTURE:
[Running total line - ONE line only, MUST start with "Session:" or "Running:"]
[Observation/suggestion with data evidence - existing behavior preserved]

=== END TRACKING ===

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
- Give data-driven advice based on their patterns and goals
- Point out what might be causing issues (e.g., high calorie meal patterns)
- Suggest improvements based on their own history

WHAT NOT TO DO:
- Don't give generic advice without data backing
- Don't use empty motivational phrases
- Don't congratulate without substance

GOOD EXAMPLES:
- "Running: 4 sets | 28 reps
Go for 87.5kg — you hit 85x5 clean last Wednesday, and your pattern is +2.5kg when reps feel solid"
- "Session: 650/1400 cal (46%) | 45g protein
This leaves 750 cal — you typically have a 400 cal dinner, so 350 cal buffer for snacks"
- "Running: 2 hrs focused
Fourth session this week — your data shows retention drops after 2.5 hrs"

BAD EXAMPLES:
- "Great lift!" (empty cheerleading, no data)
- "You're doing well, keep up the good work!" (motivational fluff, no specifics)
- "Try to eat less" (generic advice, no data)

PREVIOUS EVENTS THIS SESSION:
{{previousEvents}}

NEW EVENT JUST LOGGED:
{{newEvent}}

Respond with running total + data-driven observation/advice. Direct, specific, based on their history.`;

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
