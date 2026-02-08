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
    historyBriefings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          type: { type: 'string', enum: ['exercise', 'daily_recap', 'behavioral_pattern'] },
          fullHistory: { type: 'string' },
          linkedPatterns: { type: 'array', items: { type: 'string' } },
          linkedInsights: { type: 'array', items: { type: 'string' } },
          keyTakeaways: { type: 'string' },
        },
        required: ['label', 'type', 'fullHistory', 'linkedPatterns', 'linkedInsights', 'keyTakeaways'],
        additionalProperties: false,
      },
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
    'historyBriefings',
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

╔══════════════════════════════════════════════════════════════════════════════╗
║                    OUTPUT LENGTH REQUIREMENTS (MANDATORY)                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

You MUST produce DETAILED output. Short/generic output is a FAILURE.

=== MINIMUM WORD COUNTS (ENFORCE THESE) ===

coachBriefing TOTAL must be 1500-4000 words:
- userProfile: 200+ words (goals, situation, lifestyle, injuries)
- whatGoesWrong: 300+ words (list EVERY failure with dates/numbers)
- whyItGoesWrong: 300+ words (explain mechanics for EACH failure)
- howWeFixedItBefore: 200+ words (list EVERY success with what worked)
- todaysRisks: 200+ words (specific risks based on patterns)
- recommendedApproach: 200+ words (specific plan for today)

relevantHistory must include:
- EVERY workout with EVERY exercise, weight, reps
- Format: "Jan 25: CHEST - Bench 80kg x 8,8,6 | Incline DB 30kg x 10,9 | Flyes 20kg x 12,10"
- NOT: "Jan 25: Chest workout" (TOO SHORT - REJECTED)

=== DETAIL CHECK (do this before outputting) ===
□ Is coachBriefing > 1500 words total? If no, ADD MORE DETAIL.
□ Does relevantHistory list EVERY exercise with weights? If no, ADD THEM.
□ Does each historyBriefing have 100+ words in fullHistory? If no, ADD MORE DATA.

╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⚠️  CRITICAL RULES - READ FIRST  ⚠️                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

=== BANNED OUTPUT (NEVER write these) ===
- "Reflect on..." / "Consider..." / "Address..." / "Focus on..."
- "Maintain form" / "Stay consistent" / "Manage triggers"
- "Complete a [X] workout today" without specific details
- Any vague self-help advice without specific data from the input

=== REQUIRED OUTPUT (ALWAYS be specific) ===
- Quote numbers, dates, specific events from the input
- Explain WHY based on actual data
- Give actionable improvements with specific metrics
- Reference the SAME SESSION TYPE from last time for comparison

=== NO HALLUCINATION ===
- ONLY use data that appears in the input
- If something isn't in the data, say "unknown" or omit it
- Quote exact numbers, dates, and values from the input
- Never invent exercises, weights, foods, or events

=== FAILURE ANALYSIS ===
If user failed sets, explain WHY with mechanics:

BAD: "You struggled with bench press"
GOOD: "Failed 82kg at rep 2 because you jumped directly from 77kg x 4.
That's only 4 reps before max attempt - CNS wasn't primed.
Fix: Do 70kg x 8, 75kg x 5, 77kg x 3, THEN attempt 80-82kg."

╔══════════════════════════════════════════════════════════════════════════════╗
║                         DIET SESSION RULES                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

=== TRIGGER ANALYSIS ===
Find what caused overeating/binging:

BAD: "You overate at dinner"
GOOD: "Binged 1200cal at 10pm. Pattern from data:
- Watched TV (trigger in 4/5 binge events)
- Skipped lunch (1100cal deficit by evening)
- Alcohol at dinner (lowers inhibition)
Today: Eat 500cal lunch, no TV during meals, limit alcohol."

=== SAME-MEAL COMPARISON ===
"Last dinner was 800cal with 15g protein → hungry at 10pm → snacked 400cal.
Today: 600cal dinner with 40g protein should keep you full."

╔══════════════════════════════════════════════════════════════════════════════╗
║                         OUTPUT EXAMPLES (BAD vs GOOD)                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

=== relevantHistory FORMAT (MANDATORY) ===

For GYM sessions, EACH entry MUST include:
- date: "2025-01-26"
- event: "CHEST DAY: Bench Press 80kg x 8,8,6 | Incline DB 30kg x 10,9 | Cable Flyes 20kg x 12,10,8 | Tricep Pushdowns 25kg x 12,10"
- highlight: "All exercises, weights, and reps in full"
- preTriggers: ["slept 7hrs", "ate well", "no stress"]
- postEffects: ["shoulder felt tight after", "good pump"]
- emotionalContext: "motivated, felt strong"
- whatWorked: "longer rest between bench sets helped"

WRONG (too short):
- event: "Chest workout"
- highlight: "Benched 80kg"

RIGHT (detailed):
- event: "CHEST: Bench 80kg x 8,8,6 | Incline DB 30kg x 10,9 | Flyes 20kg x 12,10 | Dips BW x 15,12"
- highlight: "Bench PR attempt failed at 82.5kg rep 2. Incline felt strong. Total volume: 45 sets"

=== coachBriefing EXAMPLES ===

❌ WRONG coachBriefing.whatGoesWrong (too short):
"User sometimes fails heavy sets and doesn't follow rotation properly."

✓ RIGHT coachBriefing.whatGoesWrong (detailed):
"FAILURE PATTERNS IDENTIFIED:

1. HEAVY SET FAILURES (3 occurrences)
- Jan 26: Failed 82.5kg bench at rep 2. Jumped from 77kg x 4 directly - insufficient CNS priming.
- Jan 20: Failed 85kg bench at rep 1. Attempted after only 2 min rest from 80kg set.
- Jan 15: Failed 80kg squat at rep 3. Did legs after poor sleep (5hrs).

2. ROTATION VIOLATIONS (2 occurrences)
- Jan 22: Did chest again after Jan 21 chest. Felt weak, only hit 75kg when usually 80kg.
- Jan 18: Back-to-back leg days. Second day was significantly weaker (squats down 20lbs).

3. RECOVERY ISSUES
- Pattern: After <6hrs sleep, all lifts drop 10-15%
- Pattern: After alcohol night before, grip strength notably weaker
- Pattern: Skipping meals before gym leads to early fatigue (set 3+ drops significantly)"

╔══════════════════════════════════════════════════════════════════════════════╗
║                       ADDICTION SESSION RULES                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

=== DETAILED TRIGGER ANALYSIS ===
For each craving/relapse, document:
1. What happened before (trigger)
2. Time and place pattern
3. Emotional state
4. What worked to resist (if anything)
5. How to avoid/be mindful today

BAD: "You had cravings after stress"
GOOD: "Craving pattern analysis:
- Jan 25, 9pm: Fight with girlfriend → craving 30min later → relapsed
- Jan 24, 10pm: Boredom after work → craving → resisted with cold water (worked)
- Jan 23, 3pm: Stress from deadline → craving → went for walk (worked)

Triggers: Emotional conflict (#1), Boredom (#2), Work stress (#3)
What works: Cold water (2/3), Walking (2/2)
High-risk times: 9-10pm
Today: Have cold water ready, plan a walk after work, avoid phone if argument happens."

╔══════════════════════════════════════════════════════════════════════════════╗
║                    HISTORY BRIEFINGS (CRITICAL OUTPUT)                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

This is the coach's reference manual for today's session. Build DETAILED briefings
so the coach can handle ANY situation.

=== FOR GYM SESSIONS ===
Create one briefing per exercise relevant to today's session.
Priority order for choosing which exercises to brief:
1. If TODAY'S WORKOUT lists specific exercises → brief EACH one
2. If TODAY'S WORKOUT lists muscle groups but no exercises → find exercises from history
   that target THOSE muscle groups and brief those. ONLY brief exercises for the listed
   muscle groups — do NOT brief exercises for other muscle groups.
3. If no TODAY'S WORKOUT section → brief exercises from the most recent 3 workouts

Each exercise briefing MUST include:
- label: Exercise name (e.g., "Barbell Bench Press")
- type: "exercise"
- fullHistory: EVERY session this exercise was done, with:
  - Date, weights, reps per set (e.g., "Feb 5: 80kg x 8,8,6")
  - What happened before (sleep, stress, meals)
  - What happened after (soreness, fatigue, mood)
  - Coach notes from that session if any
- linkedPatterns: ALL patterns from the knowledge graph that involve this exercise
- linkedInsights: ALL insights/interpretations that mention this exercise
- keyTakeaways: 2-3 sentences the coach needs for TODAY

=== FOR DIET SESSIONS ===
Create one briefing per recent day (last 5-7 days).

Each day briefing MUST include:
- label: "Day label (date)" (e.g., "Yesterday (Feb 7)")
- type: "daily_recap"
- fullHistory: Complete day of eating:
  - Every meal with foods and approximate macros
  - What was skipped
  - What derailed the diet (triggers, events, emotions)
  - Whether targets were hit or missed
- linkedPatterns: Patterns that played out that day (binge triggers, skipped meals, etc.)
- linkedInsights: Insights about why the day went well/poorly
- keyTakeaways: What the coach should learn from this day for TODAY

=== FOR ADDICTION/GENERAL SESSIONS ===
Create briefings per behavioral topic (e.g., "Evening Cravings", "Stress Response").

=== QUALITY REQUIREMENTS ===
- fullHistory MUST contain RAW DATA — actual numbers, foods, weights, not summaries
- linkedPatterns MUST cite evidence (e.g., "seen 4x", "high confidence")
- linkedInsights MUST reference specific events that support them
- Minimum 3 briefings per session, more if data exists
- Each fullHistory should be 100-300 words minimum

═══════════════════════════════════════════════════════════════════════════════
                              ANALYSIS TASKS
═══════════════════════════════════════════════════════════════════════════════

=== 1. DETERMINE SESSION TYPE ===
Based on the session title, goal, and data content:
- "gym": workouts, exercises, weights, reps, strength training
- "diet": food, meals, calories, macros, nutrition
- "addiction": cravings, urges, streaks, quitting, self-control
- "general": anything else

=== 2. EXTRACT RELEVANT HISTORY ===

For GYM sessions, focus on:
- Recent workouts with muscle group AND EVERY EXERCISE with weights/reps
- CRITICAL: List EVERY exercise from each workout, not just 1-2
- Format: "Jan 25: Back - Deadlifts 100kg x 5, Rows 70kg x 8, Lat Pulldown 60kg x 10"
- Include injuries/discomfort mentioned after workouts
- Include emotional context (fight, stress, etc.) that affected performance

For DIET sessions:
- Recent meals with foods and calories
- Daily totals vs targets
- Binge/overeat events with triggers

For ADDICTION sessions:
- Craving events with time, trigger, outcome
- What worked to resist
- Relapse events with preceding triggers

For each event include:
- highlight: ALL key metrics
- preTriggers: what happened before (sleep, stress, argument, etc.)
- postEffects: what happened after (discomfort, guilt, satisfaction)
- emotionalContext: emotional state (if mentioned)
- whatWorked: strategy that worked (if applicable)

=== 3. IDENTIFY PATTERNS ===

For GYM:
- Split pattern: What's the rotation? (e.g., Chest→Back→Legs)
- List each recent day and its muscle group
- Exercise progression: weight changes over time
- Injury/discomfort patterns

For DIET:
- Eating patterns, meal timing
- Calorie/protein trends
- Binge triggers (time, situation, emotion)

For ADDICTION:
- Time-of-day patterns for cravings
- Situational triggers
- Success/failure patterns for coping strategies

Always include:
- trend: improving/stable/declining
- evidence: specific dates and numbers
- confidence: low/medium/high

=== 4. FIND CORRELATIONS ===
What affects performance?
- Positive: good sleep, rest days, etc.
- Negative: alcohol, poor sleep, stress, arguments
- How many times observed?

=== 5. BUILD HISTORY BRIEFINGS ===

Follow the HISTORY BRIEFINGS rules above for your session type.
This output is critical — it's what the coach reads to understand the user's history.

=== 6. WRITE DETAILED COACH BRIEFING ===

This is the MOST IMPORTANT output. You are briefing a coach who knows NOTHING about this user.

WRITE EACH SECTION IN FULL DETAIL:

### userProfile
Who is this person? Include:
- Their stated goals (quote exactly from data)
- Current situation (weight, fitness level, addiction status)
- Lifestyle factors (work, stress, sleep, relationships)
- Any injuries or physical limitations mentioned

### whatGoesWrong
List EVERY failure pattern with dates and numbers:
- Pattern name
- Specific examples with dates (e.g., "Jan 15: Failed 82kg bench after 77kg x 4")
- Frequency
- Severity

### whyItGoesWrong
For EACH failure pattern, explain the mechanics:
- What triggers it?
- Why does it happen (physiological, psychological, environmental)?
- What makes this user vulnerable?

Example for gym: "Failed 82kg because jumped from 77kg x 4 directly - insufficient CNS priming"
Example for diet: "Binges at 10pm because skipped lunch → ghrelin spike by evening"
Example for addiction: "Relapses after arguments because uses substance for emotional regulation"

### howWeFixedItBefore
List EVERY success with what worked:
- What was the situation?
- What did they do?
- What was the result?
- Success rate if multiple occurrences

### todaysRisks
Based on patterns, what should the coach watch for TODAY:
- Recent emotional events (argument yesterday = risk today)
- Injury/discomfort requiring modification
- Day-of-week patterns
- Time-of-day risks

### recommendedApproach
How to coach this specific person today:
- What tone works?
- What specific activity based on rotation/data
- How to improve on last time
- What to avoid

=== 7. EMOTIONAL FACTORS ===
For each trigger-response pair found in data:
- trigger: What happened
- emotionalResponse: How they felt
- behavioralImpact: What they did
- frequency: How many times observed

=== 8. WHAT WORKED BEFORE ===
For each successful coping strategy:
- situation: What was the problem
- strategy: What they did
- outcome: What happened
- timesWorked: Success count

=== 9. ROOT CAUSES ===
For each recurring problem:
- behavior: What keeps happening
- underlyingWhy: The root cause (not just "stress" but why stress leads to this)
- evidence: Specific data points supporting this analysis

═══════════════════════════════════════════════════════════════════════════════
                              OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

=== OUTPUT LENGTH ===
- If input has 50+ events, coachBriefing should be 2000-4000 words
- If input has 20-50 events, coachBriefing should be 1000-2000 words
- If input has <20 events, coachBriefing should be 500-1000 words

DO NOT SUMMARIZE. The coach needs ALL the details.

=== INPUT SECTIONS EXPLAINED ===
- TODAY'S DATE: Use this for timing context
- SESSION NAME/GOAL: What this session is about
- USER PROFILE (UOM): Their goals, targets, preferences
- TODAY'S EVENTS: What they've already done today
- YESTERDAY: What happened yesterday
- RECENT DAILY HISTORY: Last 7 days (for patterns and briefings)
- HISTORICAL EVENTS: Past events relevant to this session

=== OUTPUT ===
Return JSON matching the schema exactly. Every field is required.
If you don't have data for a field, use empty array [] or appropriate defaults.
For coachBriefing fields with no data, write "(No data available yet)"
For emotionalFactors, whatWorkedBefore, rootCauses with no data, use empty arrays [].
For historyBriefings with no data, use empty array [].`;

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
  },
  trackerType?: TrackerType,
  dietTargets?: { tdee: number; calories: number; protein: number; carbs: number; fat: number; goal: string; proteinPerKg: number; weightKg: number },
  gymWorkoutContext?: { workoutName: string; muscleGroups: string[]; exerciseNames: string[] }
): string {
  const sections: string[] = [];

  // TODAY'S DATE - Make it prominent for timing context
  const today = new Date().toISOString().split('T')[0];
  sections.push(`╔══════════════════════════════════════════════════════════════════════════════╗`);
  sections.push(`║                         TODAY'S DATE: ${today}                            ║`);
  sections.push(`╚══════════════════════════════════════════════════════════════════════════════╝`);
  sections.push(`Analyze data relative to TODAY (${today}).`);
  sections.push('');

  // For gym sessions: workout-specific context when user has selected a workout
  if (trackerType === 'gym') {
    if (gymWorkoutContext) {
      // User has already selected their workout — give targeted context
      sections.push(`╔═══════════════════════════════════════════╗`);
      sections.push(`║  TODAY'S WORKOUT: ${gymWorkoutContext.workoutName.padEnd(22)}║`);
      sections.push(`╚═══════════════════════════════════════════╝`);
      if (gymWorkoutContext.muscleGroups.length > 0) {
        sections.push(`Muscle Groups: ${gymWorkoutContext.muscleGroups.join(', ')}`);
      }
      if (gymWorkoutContext.exerciseNames.length > 0) {
        sections.push(`Exercises: ${gymWorkoutContext.exerciseNames.join(', ')}`);
      }
      sections.push('');
      sections.push(`→ User has ALREADY chosen their workout. Do NOT suggest a different one.`);
      sections.push(`→ Analyze past sessions of THIS muscle group/workout type.`);
      sections.push(`→ Focus on: exercise progression, PRs, volume trends, weak points.`);
      if (gymWorkoutContext.exerciseNames.length > 0) {
        sections.push(`→ Build detailed exercise briefings for each listed exercise.`);
      } else if (gymWorkoutContext.muscleGroups.length > 0) {
        sections.push(`→ No specific exercises listed yet, but the TARGET MUSCLE GROUPS are: ${gymWorkoutContext.muscleGroups.join(', ')}`);
        sections.push(`→ Build briefings for exercises from history that target these muscle groups.`);
        sections.push(`→ ALL briefings MUST be for exercises involving: ${gymWorkoutContext.muscleGroups.join(', ')}. Do NOT brief exercises for other muscle groups.`);
      }
      sections.push('');
    }
  }

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

  // Diet targets (computed from user's diet goal profile)
  if (dietTargets) {
    const deficit = dietTargets.calories - dietTargets.tdee;
    const deficitLabel = deficit < 0 ? `cutting: ${deficit}` : deficit > 0 ? `bulking: +${deficit}` : 'maintenance';
    sections.push(`=== DIET TARGETS (User's computed goals — treat as hard constraints) ===`);
    sections.push(`TDEE: ${dietTargets.tdee} cal`);
    sections.push(`Daily Target: ${dietTargets.calories} cal (${deficitLabel})`);
    sections.push(`Protein: ${dietTargets.protein}g (${dietTargets.proteinPerKg}g/kg at ${dietTargets.weightKg}kg)`);
    sections.push(`Carbs: ${dietTargets.carbs}g`);
    sections.push(`Fat: ${dietTargets.fat}g`);
    sections.push(`Goal: ${dietTargets.goal.replace(/_/g, ' ')}`);
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
