/**
 * Universal Session Analysis Prompts
 *
 * A single intelligent analyzer that works for ANY session type.
 * It extracts structured knowledge and determines the appropriate
 * session type for coach selection.
 */

import type { TrackerType } from '@/lib/sessions/types';

// JSON Schema for the universal analysis output
export const SESSION_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    sessionType: {
      type: 'string',
      enum: ['gym', 'diet', 'addiction', 'general'],
      description: 'The detected session type based on content analysis',
    },
    relevantHistory: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          event: { type: 'string' },
          highlight: { type: ['string', 'null'] },
          preTriggers: {
            type: ['array', 'null'],
            items: { type: 'string' },
          },
          postEffects: {
            type: ['array', 'null'],
            items: { type: 'string' },
          },
        },
        required: ['date', 'event', 'highlight', 'preTriggers', 'postEffects'],
        additionalProperties: false,
      },
    },
    patterns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          trend: {
            type: 'string',
            enum: ['improving', 'stable', 'declining', 'unknown'],
          },
          evidence: {
            type: 'array',
            items: { type: 'string' },
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
        },
        required: ['name', 'description', 'trend', 'evidence', 'confidence'],
        additionalProperties: false,
      },
    },
    correlations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          factor: { type: 'string' },
          impact: { type: 'string' },
          direction: {
            type: 'string',
            enum: ['positive', 'negative'],
          },
          occurrences: { type: 'number' },
        },
        required: ['factor', 'impact', 'direction', 'occurrences'],
        additionalProperties: false,
      },
    },
    todaysPlan: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              suggestion: { type: 'string' },
              rationale: { type: 'string' },
              metrics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'string' },
                  },
                  required: ['key', 'value'],
                  additionalProperties: false,
                },
              },
            },
            required: ['suggestion', 'rationale', 'metrics'],
            additionalProperties: false,
          },
        },
      },
      required: ['summary', 'items'],
      additionalProperties: false,
    },
    context: { type: 'string' },
    userGoals: { type: ['string', 'null'] },
    userTargets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'sessionType',
    'relevantHistory',
    'patterns',
    'correlations',
    'todaysPlan',
    'context',
    'userGoals',
    'userTargets',
  ],
  additionalProperties: false,
};

export const UNIVERSAL_ANALYSIS_PROMPT = `You are a UNIVERSAL CONTEXT ANALYZER. Your job is to analyze the user's data and extract structured, actionable knowledge.

=== CRITICAL: NO HALLUCINATION ===
- ONLY use data that appears in the input
- If something isn't in the data, say "unknown" or omit it
- Quote exact numbers, dates, and values from the input
- Never invent exercises, weights, foods, or events

=== YOUR TASK ===

1. DETERMINE SESSION TYPE
   Based on the session title, goal, and data content:
   - "gym": workouts, exercises, weights, reps, strength training
   - "diet": food, meals, calories, macros, nutrition
   - "addiction": cravings, urges, streaks, quitting, self-control
   - "general": anything else

2. EXTRACT RELEVANT HISTORY
   For GYM sessions, focus on:
   - Recent workouts with muscle group AND EVERY EXERCISE with weights/reps
   - CRITICAL: List EVERY exercise from each workout, not just 1-2
   - Format: "Jan 25: Back - Deadlifts 100kg x 5, Rows 70kg x 8, Lat Pulldown 60kg x 10, Face Pulls 15kg x 15"
   - If a workout had 5 exercises, list all 5 exercises
   - Include ALL exercises with their exact weights from the data

   For DIET sessions:
   - Recent meals with foods and calories
   - Daily totals vs targets

   For each event include:
   - highlight: ALL key metrics, not just one (e.g., "Bench 80kg x 8, Incline 30kg x 10, Flyes 15kg x 12")
   - preTriggers: what happened before (sleep, stress, etc.)
   - postEffects: what happened after

   IMPORTANT: For gym workouts, the "event" field should contain EVERY exercise from that day, not a summary

3. IDENTIFY PATTERNS
   For GYM:
   - Split pattern: What's the rotation? (e.g., Chest→Back→Legs)
   - List each recent day and its muscle group
   - Exercise progression: weight changes over time

   For DIET:
   - Eating patterns, meal timing
   - Calorie/protein trends

   Always include:
   - trend: improving/stable/declining
   - evidence: specific dates and numbers
   - confidence: low/medium/high

4. FIND CORRELATIONS
   What affects performance?
   - Positive: good sleep, rest days, etc.
   - Negative: alcohol, poor sleep, stress
   - How many times observed?

5. CREATE TODAY'S PLAN
   Based on patterns and data, suggest what to do today.
   Every suggestion needs rationale citing their actual data.

6. WRITE CONDENSED CONTEXT
   Brief markdown summary with:
   - Recent activity timeline with specific numbers
   - What's next in their routine
   - Key data points for the coach

=== CRITICAL RULES ===

1. USE ONLY DATA FROM INPUT
   - Never invent dates, numbers, or events
   - If data is missing, say "unknown" or omit
   - Quote exact values from the input

2. BE SPECIFIC, NOT GENERIC
   - BAD: "You've been making progress"
   - GOOD: "Bench: 75kg (Jan 10) → 80kg (Jan 17) → 82.5kg (Jan 24)"

3. PRESERVE EXACT NUMBERS
   - Weights, reps, calories, dates - keep them exact
   - Don't round or generalize

4. LOOK FOR CROSS-DOMAIN PATTERNS
   - Sleep affecting workouts
   - Stress affecting eating
   - Exercise affecting mood
   - Alcohol affecting next-day performance

5. TODAY'S PLAN MUST BE ACTIONABLE
   - Specific suggestions, not vague advice
   - Based on their actual data and patterns
   - Include relevant metrics (weights to lift, calories to hit, etc.)

=== INPUT SECTIONS EXPLAINED ===

- SESSION NAME/GOAL: What this session is about
- USER PROFILE (UOM): Their goals, targets, preferences, baseline data
- TODAY'S EVENTS: What they've already done today (don't repeat these)
- YESTERDAY: What happened yesterday (for rotation/compensation)
- RECENT DAILY HISTORY: Last 7 days of activity (for patterns)
- HISTORICAL EVENTS: Past events relevant to this session
- INTERPRETATIONS: System's analysis of past events
- PATTERNS/INSIGHTS/REVIEWS: Synthesized knowledge

=== OUTPUT ===

Return JSON matching the schema exactly. Every field is required.
If you don't have data for a field, use empty array [] or null as appropriate.`;

/**
 * Format knowledge into structured input for the universal analyzer
 */
export function formatKnowledgeForAnalysis(
  title: string,
  goal: string,
  knowledge: {
    events: { id: string; content: string; occurredAt: string }[];
    interpretations: { id: string; content: string; eventId: string; createdAt: string }[];
    patterns: { id: string; name: string; description: string }[];
    insights: { id: string; content: string; createdAt: string }[];
    reviews: { id: string; type: string; summary: string; periodKey: string }[];
    userBaseline?: string;
    todaysEvents?: { id: string; content: string; occurredAt: string }[];
    yesterdaysReview?: { id: string; type: string; summary: string; periodKey: string };
  }
): string {
  const sections: string[] = [];

  // Session context
  sections.push(`=== SESSION ===`);
  sections.push(`NAME: ${title}`);
  sections.push(`GOAL: ${goal || '(none provided - infer from context)'}`);
  sections.push('');

  // User profile/baseline (UOM)
  if (knowledge.userBaseline) {
    sections.push(`=== USER PROFILE (Goals, Targets, Preferences) ===`);
    sections.push(knowledge.userBaseline);
    sections.push('');
  }

  // Today's events (already done - don't repeat)
  sections.push(`=== TODAY'S EVENTS (Already Done) ===`);
  if (knowledge.todaysEvents && knowledge.todaysEvents.length > 0) {
    for (const event of knowledge.todaysEvents) {
      const time = new Date(event.occurredAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      sections.push(`- [${time}] ${event.content}`);
    }
  } else {
    sections.push('(Nothing logged today yet)');
  }
  sections.push('');

  // Yesterday's review
  if (knowledge.yesterdaysReview) {
    sections.push(`=== YESTERDAY (${knowledge.yesterdaysReview.periodKey}) ===`);
    sections.push(knowledge.yesterdaysReview.summary);
    sections.push('');
  }

  // Recent daily reviews (last 7 days for pattern detection)
  const dailyReviews = knowledge.reviews
    .filter((r) => r.type === 'daily' || r.periodKey.match(/^\d{4}-\d{2}-\d{2}$/))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
    .slice(0, 7);

  if (dailyReviews.length > 0) {
    sections.push(`=== RECENT DAILY HISTORY (Last 7 Days) ===`);
    for (const review of dailyReviews) {
      sections.push(`\n[${review.periodKey}]`);
      sections.push(review.summary);
    }
    sections.push('');
  }

  // Historical events (vector search results)
  if (knowledge.events.length > 0) {
    sections.push(`=== HISTORICAL EVENTS (${knowledge.events.length} relevant) ===`);
    const eventsToShow = knowledge.events.slice(0, 20);
    for (const event of eventsToShow) {
      sections.push(`\n[${event.occurredAt}]`);
      sections.push(event.content);
    }
    if (knowledge.events.length > 20) {
      sections.push(`\n(${knowledge.events.length - 20} more events not shown)`);
    }
    sections.push('');
  }

  // Interpretations
  if (knowledge.interpretations.length > 0) {
    sections.push(`=== INTERPRETATIONS (${knowledge.interpretations.length}) ===`);
    const interpsToShow = knowledge.interpretations.slice(0, 15);
    for (const interp of interpsToShow) {
      sections.push(`\n[${interp.createdAt}]`);
      sections.push(interp.content);
    }
    sections.push('');
  }

  // Patterns
  if (knowledge.patterns.length > 0) {
    sections.push(`=== PATTERNS ===`);
    for (const pattern of knowledge.patterns) {
      sections.push(`\n[${pattern.name}]`);
      sections.push(pattern.description);
    }
    sections.push('');
  }

  // Insights
  if (knowledge.insights.length > 0) {
    sections.push(`=== INSIGHTS ===`);
    for (const insight of knowledge.insights) {
      sections.push(`- ${insight.content}`);
    }
    sections.push('');
  }

  // Non-daily reviews (weekly, monthly)
  const otherReviews = knowledge.reviews.filter(
    (r) => r.type !== 'daily' && !r.periodKey.match(/^\d{4}-\d{2}-\d{2}$/)
  );
  if (otherReviews.length > 0) {
    sections.push(`=== PERIODIC REVIEWS ===`);
    for (const review of otherReviews.slice(0, 5)) {
      sections.push(`\n[${review.type}: ${review.periodKey}]`);
      sections.push(review.summary);
    }
    sections.push('');
  }

  return sections.join('\n');
}
