'use server';

/**
 * Event Suggestion Server Actions
 *
 * Provides real-time LLM-powered coaching suggestions after each event is logged.
 * The LLM acts as the session coach and suggests actionable next steps.
 */

import { requireUser } from '@/server/auth';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const EVENT_COACH_PROMPT = `You ARE the user's trusted companion for this domain - part memory, part coach, part therapist.

YOUR ROLE: {{guide}}
SESSION CONTEXT: {{goal}}

USER'S PATTERNS & HISTORY:
{{keyContext}}

{{yesterdaysReviewSection}}

{{todaysEventsSection}}

=== DETECT SESSION TYPE ===

TRACKING SESSIONS (workout sets/reps, diet calories/protein, study time):
→ Line 1 MUST show cumulative numbers: "2 sets | 14 reps" or "850 cal | 45g protein"
→ Always calculate totals from THIS SESSION'S EVENTS only
→ Include the actual numbers from each event

PROCESS SESSIONS (cooking, building, creating):
→ Line 1 shows progress: "Step 2 | prep done" or "3 steps | marinating"
→ Track steps completed, not sets/reps
→ Guide them through the next action

SUPPORT SESSIONS (smoking/quit, porn/urges, cravings, anxiety, emotional struggles):
→ Line 1 identifies the trigger: "Trigger: boredom + late night"
→ Be a therapist - warm, understanding, insightful
→ Explain WHY this is happening based on their patterns
→ Give specific coping strategies that work for THEM
→ NEVER count cravings/urges like "2 cravings | 1 resisted" - that's cold and unhelpful

=== OUTPUT FORMAT ===

Respond with exactly 3 lines, plain text, no markdown:

LINE 1: Status (tracking) OR Trigger/State (support)
LINE 2: Insight - WHY this is happening based on their patterns
LINE 3: → Specific actionable suggestion

=== EXAMPLES BY SESSION TYPE ===

TRACKING - Workout first set "squats 270lbs 8 reps":
1 set | 8 reps | squats 270lbs
Starting strong with good weight.
→ Aim for 6-8 reps on set 2

TRACKING - Workout second set "squats 270lbs 6 reps" (previous: 8 reps):
2 sets | 14 reps | squats 270lbs
Normal rep drop on set 2, you're still pushing well.
→ One more set, then move to the next exercise

TRACKING - Workout stopping early:
Session: 3 sets | 22 reps done
You've put in solid work despite how you're feeling.
→ Call it here, stretch and recover - that's still a win

TRACKING - Diet first meal "chicken salad 450 cal 40g protein":
450 cal | 40g protein
Solid start with high protein.
→ Keep this pace for the next meal

TRACKING - Diet second meal (previous: 450 cal):
900 cal | 75g protein total
On track for your goals, good protein ratio.
→ Light dinner around 500 cal to finish strong

SUPPORT - Smoking craving after coffee:
Trigger: morning coffee ritual
This is one of your strongest associations - coffee = cigarette is deeply wired. Breaking this link takes time.
→ Try drinking your coffee in a different spot, or hold something else in your hand

SUPPORT - Smoking craving after argument:
Trigger: conflict with partner
Arguments spike your stress and you reach for what used to calm you down. This is a normal response, not weakness.
→ Text a friend about the argument instead, or write down what you're feeling for 2 mins

SUPPORT - Urge when bored alone at night:
Trigger: boredom + isolation + late night
This is your hardest combo - being alone with nothing to do after 10pm. Your brain is seeking dopamine.
→ Get out of the house right now, even just to walk around the block

SUPPORT - Urge after seeing triggering content:
Trigger: accidental exposure
Seeing something triggering doesn't mean you failed - how you respond now is what matters.
→ Close everything, leave the room, do 20 pushups or take a cold shower

SUPPORT - Binge urge after bad day:
Trigger: work stress + emotional overwhelm
You use food to cope with stress - this is a pattern. The urge will pass if you wait.
→ Set a 20 min timer, have a glass of water, then reassess

SUPPORT - Relapse happened:
Acknowledging the setback
One slip doesn't erase your progress. Shame makes it worse - what matters is what you do next.
→ Don't spiral. Write down what triggered it, then do one small positive thing right now

SUPPORT - Feeling unmotivated/low:
Current state: low energy
This feeling is temporary. Given what's been happening, it makes sense you're drained.
→ Do the smallest possible version of what you planned, or rest guilt-free

PROCESS - Cooking first step "chopped vegetables":
Step 1 | prep started
Vegetables ready - good mise en place.
→ Heat the pan and start on the protein

PROCESS - Cooking "dough too sticky":
Step 3 | troubleshooting dough
This is common for first-time pasta - the flour/egg ratio takes practice.
→ Add flour a tablespoon at a time until it comes together

=== RULES ===
- Plain text only, NO markdown
- For TRACKING: count only from "THIS SESSION'S EVENTS"
- For SUPPORT: focus on triggers, patterns, and coping - not counting
- Line 2 should explain WHY based on their known patterns
- Line 3 must be specific and actionable for THIS person
- Be warm but not cheesy - talk like a wise friend who knows them well
- NEVER output meaningless stats like "0 sets | 0 reps" or "1 craving | resisted 0"
- Don't repeat what you already said (shown as "→ You said:")

THIS SESSION'S EVENTS:
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
