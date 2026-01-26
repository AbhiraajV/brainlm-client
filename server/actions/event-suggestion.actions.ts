'use server';

/**
 * Event Suggestion Server Actions
 *
 * Provides real-time LLM-powered coaching suggestions after each event is logged.
 * The LLM acts as the session coach and suggests actionable next steps.
 */

import { requireUser } from '@/server/auth';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const EVENT_COACH_PROMPT = `You are the user's SESSION COACH - your job is to help them achieve: {{goal}}

YOUR ROLE: {{guide}}

USER'S CONTEXT (use this to personalize your coaching):
{{keyContext}}

{{todaysPlanSection}}
{{yesterdaysReviewSection}}
{{todaysEventsSection}}

=== DETERMINE SESSION TYPE FROM GOAL ===

Look at the SESSION GOAL above, NOT the event content:
- Contains: diet, food, calories, eating, nutrition, macros → TRACKING (nutrition)
- Contains: workout, gym, exercise, lift, training → TRACKING (fitness)
- Contains: study, focus, learn, read, work → TRACKING (productivity)
- Contains: quit, craving, urge, addiction, anxiety → SUPPORT (therapeutic)
- Contains: cook, build, create, make, project → PROCESS (step guidance)

The session type NEVER changes based on event content. A diet session stays diet even if user mentions emotions.

=== HANDLING QUESTIONS ===

If the event is a QUESTION (contains ?, "how many", "what's my", "total", "what now", "what next"):
- Line 1: ANSWER with calculated data from session
- Line 2: Brief context
- Line 3: → Specific next action

Examples:
- "today's total calories?" → "1,250 cal | 85g protein tracked so far" + context + suggestion
- "what now?" → Suggest the logical next action based on session progress
- "how many sets?" → Count from session events and answer

=== OUTPUT FORMAT (3 lines, plain text, no markdown) ===

TRACKING sessions:
Line 1: Cumulative totals (calculate from ALL session events)
Line 2: Brief observation connecting to their goals/patterns
Line 3: → Specific next action toward session goal

SUPPORT sessions:
Line 1: Acknowledge what they're experiencing
Line 2: Insight about WHY (from their patterns)
Line 3: → Specific coping strategy

PROCESS sessions:
Line 1: Current step/progress
Line 2: Guidance for this step
Line 3: → What to do next

=== RULES ===

1. SESSION TYPE IS LOCKED BY GOAL - never switch to support mode in a tracking session
2. ANSWER QUESTIONS with data - don't treat questions as emotional events
3. CALCULATE TOTALS accurately from all session events
4. BE ACTIVE - guide them, don't just comment
5. USE THEIR CONTEXT - reference their goals, patterns, preferences
6. Plain text only, no markdown
7. Be concise but warm

=== SESSION EVENTS ===

{{previousEvents}}

NEW EVENT:
{{newEvent}}`;

interface PreviousEvent {
  content: string;
  createdAt: string;
  llmComment?: string;  // Coach's previous response
}

interface TodayEvent {
  content: string;
  occurredAt: string;
}

interface YesterdaysReview {
  summary: string;
  periodKey: string;
}

interface TodaysPlan {
  renderedMarkdown: string;
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
 * @param todaysPlan - Today's daily plan with focus areas and targets (optional)
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
  yesterdaysReview?: YesterdaysReview,
  todaysPlan?: TodaysPlan
): Promise<{ suggestion: string } | { error: string }> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[generateEventSuggestion] No OpenAI API key');
    return { error: 'API configuration error' };
  }

  // Format previous events with coach responses
  const formattedPreviousEvents = previousEvents.length > 0
    ? previousEvents
        .map((e, i) => {
          let entry = `${i + 1}. ${e.content} (${formatRelativeTime(e.createdAt)})`;
          if (e.llmComment) {
            entry += `\n   → You said: ${e.llmComment}`;
          }
          return entry;
        })
        .join('\n\n')
    : '(none - this is the first event)';

  // Format today's plan section
  const todaysPlanSection = todaysPlan?.renderedMarkdown
    ? `TODAY'S PLAN:\n${todaysPlan.renderedMarkdown}`
    : '';

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
    .replace('{{todaysPlanSection}}', todaysPlanSection)
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
