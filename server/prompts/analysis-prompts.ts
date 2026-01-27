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
          emotionalContext: { type: ['string', 'null'] },
          whatWorked: { type: ['string', 'null'] },
        },
        required: ['date', 'event', 'highlight', 'preTriggers', 'postEffects', 'emotionalContext', 'whatWorked'],
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
    // THE KEY ADDITION - detailed narrative briefing for the coach
    coachBriefing: {
      type: 'object',
      properties: {
        userProfile: { type: 'string' },
        whatGoesWrong: { type: 'string' },
        whyItGoesWrong: { type: 'string' },
        howWeFixedItBefore: { type: 'string' },
        todaysRisks: { type: 'string' },
        recommendedApproach: { type: 'string' },
      },
      required: ['userProfile', 'whatGoesWrong', 'whyItGoesWrong', 'howWeFixedItBefore', 'todaysRisks', 'recommendedApproach'],
      additionalProperties: false,
    },
    // Emotional factors affecting behavior
    emotionalFactors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          trigger: { type: 'string' },
          emotionalResponse: { type: 'string' },
          behavioralImpact: { type: 'string' },
          frequency: { type: 'number' },
        },
        required: ['trigger', 'emotionalResponse', 'behavioralImpact', 'frequency'],
        additionalProperties: false,
      },
    },
    // Strategies that have worked before
    whatWorkedBefore: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          situation: { type: 'string' },
          strategy: { type: 'string' },
          outcome: { type: 'string' },
          timesWorked: { type: 'number' },
        },
        required: ['situation', 'strategy', 'outcome', 'timesWorked'],
        additionalProperties: false,
      },
    },
    // Root cause analysis
    rootCauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          behavior: { type: 'string' },
          underlyingWhy: { type: 'string' },
          evidence: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['behavior', 'underlyingWhy', 'evidence'],
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
    'coachBriefing',
    'emotionalFactors',
    'whatWorkedBefore',
    'rootCauses',
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
   - emotionalContext: what emotional state the user was in (if mentioned)
   - whatWorked: what strategy worked in this situation (if applicable)

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

=== 6. WRITE DETAILED COACH BRIEFING ===

This is the MOST IMPORTANT output. You are briefing a coach who knows NOTHING about this user.
The coach will read this briefing and then help the user in real-time.

Your briefing must be EXHAUSTIVE. If the input data is 10,000 words, your briefing should capture
ALL the relevant patterns, not summarize them into 500 words.

WRITE EACH SECTION IN FULL DETAIL:

### USER PROFILE
Who is this person? Write 3-5 paragraphs covering:
- Their stated goals (quote exactly from data)
- Their current situation (weight, fitness level, addiction status, etc.)
- Their lifestyle factors (work schedule, stress sources, sleep patterns, relationships)
- Their personality patterns (do they respond to tough love? need encouragement? data-driven?)
- Any special circumstances (menstrual cycle, injuries, mental health, medications)

### WHAT GOES WRONG (Be Exhaustive)
List EVERY failure pattern you find in the data. For each one:
- Describe the pattern in detail
- Give 3-5 specific examples with dates
- Note frequency (how often does this happen?)
- Rate severity (minor slip vs major problem)

Example of GOOD detail:
"EVENING OVEREATING PATTERN:
- Jan 15: Ate 1200cal dinner after 900cal day (binged on pasta + bread + ice cream)
- Jan 18: Same pattern - 1100cal by 6pm → 800cal dinner → 200cal snack at 10pm
- Jan 21: Skipped lunch due to meeting, ate 1500cal from 7-10pm
- Jan 24: Reported 'lost control' at dinner, estimated 1000cal over target
- Jan 26: Ate kids' leftovers + second dinner
Frequency: 5/12 days this month (42%)
Severity: HIGH - this is their #1 obstacle"

Do this for EVERY pattern. Don't summarize. Don't say "user sometimes overeats."
Give the coach the FULL picture.

### WHY IT GOES WRONG (Root Cause Analysis)
For EACH failure pattern above, explain WHY it happens:
- What triggers it? (hunger, stress, boredom, social, habit, emotional)
- What's the underlying mechanism? (calorie deficit, blood sugar, willpower depletion, emotional regulation)
- What makes THIS user vulnerable? (their specific circumstances)

Example:
"WHY EVENING OVEREATING HAPPENS:
1. PHYSIOLOGICAL: User consistently under-eats during day (avg 1100cal by 5pm vs 1800 target).
   By evening, ghrelin is spiking and leptin is suppressed. Body is literally demanding food.
2. WILLPOWER DEPLETION: User has stressful job (mentioned work stress 8 times). By evening,
   prefrontal cortex is fatigued. Decision-making capacity is lowest.
3. ENVIRONMENTAL: Kids' leftovers present a constant trigger (mentioned 3x). Food is visible and easy.
4. EMOTIONAL: Evening is when loneliness hits (user mentioned feeling isolated after kids sleep, 2x).
   Food becomes comfort/companion.
5. HABIT LOOP: Years of conditioning - TV time = snack time. Trying to watch TV without eating
   creates psychological discomfort."

### HOW WE FIXED IT BEFORE (Success Stories)
List EVERY time the user successfully overcame a challenge. Be specific:
- What was the situation?
- What exactly did they do?
- What was the result?
- Could this work again?

Example:
"SUCCESSFUL INTERVENTIONS:
1. Jan 17: Had craving at 3pm, ate Greek yogurt (25g protein) → reported craving gone in 20 min.
   SUCCESS RATE: 4/5 times protein stopped afternoon cravings.

2. Jan 19: Felt like skipping gym, texted friend instead → friend convinced them to go →
   reported feeling great after. SUCCESS RATE: 3/3 times accountability worked.

3. Jan 22: Evening craving hit, went for 10-min walk instead of eating → craving passed.
   SUCCESS RATE: 2/3 times (1x walked but still ate after).

4. Jan 23: Pre-portioned dinner before sitting down → ate only what was plated, didn't go back.
   SUCCESS RATE: 2/2 times pre-portioning worked.

5. Week of Jan 10: Ate bigger breakfast (500cal vs usual 200cal) → reported less evening hunger.
   SUCCESS RATE: 5/7 days that week stayed on track."

### TODAY'S RISKS
Based on patterns, what should the coach watch for TODAY:
- Day of week patterns (e.g., "Fridays are high-risk - user mentioned 'weekend mentality' 3x")
- Time of day risks (e.g., "3pm is danger zone - 6/10 cravings happened 2-4pm")
- Current context (e.g., "User mentioned big meeting today - expect stress eating risk tonight")
- Cycle phase if applicable (e.g., "Day 24 luteal - expect +200cal hunger, don't fight it")

### RECOMMENDED APPROACH FOR COACH
How should the coach interact with this user?
- What tone works? (tough love vs gentle vs data-focused)
- What motivates them? (cite examples from data)
- What doesn't work? (cite failed approaches)
- Key phrases that resonate with them (quote their own words back)

Example:
"THIS USER RESPONDS TO:
- Data and logic (they track meticulously, mentioned 'I like seeing the numbers' on Jan 12)
- Direct, no-BS feedback (they complained about 'fluffy advice' on Jan 8)
- Being reminded of their WHY (they mentioned wanting energy for kids 4 times)

DON'T:
- Be preachy (they pushed back against 'should' language on Jan 15)
- Focus on weight (they mentioned scale anxiety, prefer non-scale victories)
- Suggest meditation (they tried it, said 'not for me' on Jan 20)

KEY PHRASES THEY USE:
- 'Lost control' (signals guilt - respond with data, not reassurance)
- 'Feel like crap' (usually means tired + overate previous night)
- 'Back on track' (they want validation that one day doesn't ruin everything)"

=== 7. EMOTIONAL FACTOR ANALYSIS ===

Search ALL data for emotional patterns. For EACH situation, identify:
- What emotional state PRECEDED the behavior? (stress, anxiety, loneliness, boredom, celebration)
- What emotional state FOLLOWED? (guilt, relief, satisfaction, regret)
- Did emotional factors CAUSE or CONTRIBUTE to the behavior?

Extract patterns like:
- "Stress at work → overeating at dinner" (observed 5x)
- "Loneliness on weekends → relapse" (observed 3x)
- "Anxiety → skipped workout" (observed 2x)

BE EXHAUSTIVE. Don't summarize. List every emotional pattern you find.

=== 8. WHAT WORKED BEFORE ===

This is CRITICAL. Search the ENTIRE knowledge base for:
- Times user successfully overcame a challenge
- Strategies that led to positive outcomes
- Actions that broke negative patterns
- Specific things that helped in the moment

For EACH success, document:
- What was the situation/problem?
- What EXACTLY did they do?
- What was the result?
- How many times has this worked?

Examples:
- "Craving at 3pm → had Greek yogurt → craving passed in 20 min" (worked 4/5 times)
- "Felt like skipping gym → texted accountability partner → went anyway" (worked 3/3 times)
- "Stress eating urge → went for 10 min walk → didn't binge" (worked 2/3 times)

NEVER skip this section. This is what makes coaching personalized.

=== 9. ROOT CAUSE ANALYSIS (WHY) ===

For EVERY recurring pattern, analyze the UNDERLYING WHY:

WRONG approach: Just noting "user overeats at dinner"
RIGHT approach: "User overeats at dinner BECAUSE:
  - Skips breakfast (creates 1000+ cal deficit by 6pm)
  - Willpower depletes through day (ego depletion)
  - Evening = low cortisol, high ghrelin
  - Evidence: 8/10 overeating episodes followed <1200 cal by 4pm"

WRONG: "User relapses after arguments"
RIGHT: "User relapses after arguments BECAUSE:
  - Uses substance for emotional regulation
  - No alternative coping mechanism for anger
  - Pattern: argument → isolation → craving → use
  - Evidence: 3/4 relapses within 2 hrs of interpersonal conflict"

Include cross-domain causes:
- Poor sleep → affects workouts AND diet compliance
- Work stress → affects all domains
- Menstrual cycle → affects energy, cravings, strength

=== CRITICAL: BE EXHAUSTIVE ===

This analysis is the SINGLE SOURCE OF TRUTH for the coach.
If a pattern exists in the data, it MUST appear in your analysis.
If a success strategy exists, it MUST be documented.
If an emotional factor is present, it MUST be captured.

The coach can only use what you give it. Missing data = worse coaching.

=== 10. OUTPUT LENGTH REQUIREMENT ===

Your output should be PROPORTIONAL to the input.
- If input has 50+ events, your coachBriefing should be 2000-4000 words
- If input has 20-50 events, your coachBriefing should be 1000-2000 words
- If input has <20 events, your coachBriefing should be 500-1000 words

DO NOT SUMMARIZE. DO NOT CONDENSE. The coach needs ALL the details.

When in doubt, include more detail. A coach who knows too much about the user
is better than a coach who doesn't know enough.

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
If you don't have data for a field, use empty array [] or appropriate defaults.
For coachBriefing fields with no data, write "(No data available yet - this is a new user)"
For emotionalFactors, whatWorkedBefore, rootCauses with no data, use empty arrays [].`;

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

  // Historical events (vector search results) - increased limit for detailed analysis
  if (knowledge.events.length > 0) {
    sections.push(`=== HISTORICAL EVENTS (${knowledge.events.length} relevant) ===`);
    const eventsToShow = knowledge.events.slice(0, 50);
    for (const event of eventsToShow) {
      sections.push(`\n[${event.occurredAt}]`);
      sections.push(event.content);
    }
    if (knowledge.events.length > 50) {
      sections.push(`\n(${knowledge.events.length - 50} more events not shown)`);
    }
    sections.push('');
  }

  // Interpretations - increased limit for detailed analysis
  if (knowledge.interpretations.length > 0) {
    sections.push(`=== INTERPRETATIONS (${knowledge.interpretations.length}) ===`);
    const interpsToShow = knowledge.interpretations.slice(0, 30);
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
