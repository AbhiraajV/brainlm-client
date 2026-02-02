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
□ Does todaysPlan explain WHY with specific data? If no, ADD REASONING.

╔══════════════════════════════════════════════════════════════════════════════╗
║                    GYM ROTATION - MANDATORY VALIDATION                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

BEFORE writing todaysPlan, you MUST include this in your context field:

"ROTATION VALIDATION:
- [Date 1]: [Muscle Group] - [exercises]
- [Date 2]: [Muscle Group] - [exercises]
- [Date 3]: [Muscle Group] - [exercises]
- Most recent: [Muscle Group]
- Detected split: [PPL/Upper-Lower/Bro/etc]
- Today MUST be: [Next muscle in rotation]
- CHECK: Is todaysPlan suggesting [correct muscle]? YES/NO"

If NO → REWRITE todaysPlan to follow rotation.

EXAMPLE:
"ROTATION VALIDATION:
- Jan 24: LEGS - Squats 280lbs x 6, Leg Press 400lbs x 10, RDL 185lbs x 8
- Jan 25: BACK - Deadlifts 315lbs x 5, Rows 185lbs x 8, Pulldowns 150lbs x 10
- Jan 26: CHEST - Bench 225lbs x 6, Incline DB 80lbs x 8, Cable Flyes 50lbs x 12
- Most recent: CHEST (Jan 26)
- Detected split: Legs → Back → Chest (3-day rotation)
- Today MUST be: LEGS
- CHECK: Is todaysPlan suggesting LEGS? YES ✓"

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

╔══════════════════════════════════════════════════════════════════════════════╗
║                         GYM SESSION RULES                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝

=== ROTATION RULE (MANDATORY - VALIDATE BEFORE OUTPUT) ===

STEP 1: List the last 3 workout dates and their muscle groups
STEP 2: Identify the MOST RECENT workout's muscle group = X
STEP 3: Today's workout MUST be DIFFERENT from X (follow rotation)
STEP 4: Check for injuries/discomfort - see INJURY HANDLING section

VALIDATION CHECK (do this before writing todaysPlan):
- If todaysPlan muscle group = most recent muscle group → WRONG, follow rotation
- If injury exists → provide test protocol + pivot option (see below)

=== ROTATION IDENTIFICATION ===
Identify the user's training split from their workout history:
- PPL (Push/Pull/Legs): Chest+Shoulders+Triceps → Back+Biceps → Legs → repeat
- Upper/Lower: Upper body → Lower body → repeat
- Bro Split: Chest → Back → Shoulders → Arms → Legs (one muscle per day)
- Full Body: All muscles each session

State the identified rotation in your analysis, e.g., "User follows PPL rotation"
If today's data suggests a different split, note the change.

=== INJURY/DISCOMFORT HANDLING ===
ONLY applies when rotation actually suggests the injured muscle group.

1. First, compute rotation → determine what muscle TODAY should be
2. IF today's muscle = injured muscle, THEN apply injury handling:

   MINOR DISCOMFORT (soreness, tightness, mild discomfort):
   - Suggest testing with LIGHT weights (50% of usual)
   - Provide pivot option if pain during warm-up

   ACTUAL PAIN/INJURY (sharp pain, couldn't finish, mentioned injury):
   - Skip that muscle group entirely
   - Suggest logical pivot based on rotation

3. IF today's muscle ≠ injured muscle → proceed normally, just note the injury needs rest

FAILED SETS DO NOT CHANGE ROTATION:
- If user failed 82kg bench on chest day, they still move to next muscle tomorrow
- Don't suggest "retry chest" - follow the rotation

EXAMPLE:
Input: Jan 24=Legs, Jan 25=Back (Pull), Jan 26=Chest/Push (shoulder discomfort after)
Today: Jan 27
Detected Rotation: Legs → Pull → Push → repeat

STEP 1: Last workout was Push (Jan 26)
STEP 2: Next in rotation = LEGS
STEP 3: Legs has no injury concern
RESULT: Today = LEGS

Analysis: "User follows Legs→Pull→Push rotation. Last workout was Push (chest) on Jan 26.
Today is LEGS. Last legs session (Jan 24): Squats 270-280lbs x 6.
Note: Chest/shoulders need rest due to shoulder discomfort from Jan 26."

WRONG: "Focus on chest workout with attention to shoulder" ← IGNORES ROTATION
WRONG: "Retry chest since you failed 82kg" ← Failed sets don't change rotation
RIGHT: Follow rotation (Legs), reference last legs session, note injury needs rest

=== SAME-SESSION COMPARISON (CRITICAL) ===
Find the LAST TIME user did this muscle group. Compare and suggest improvements.

BAD: "Complete a legs workout today"
GOOD: "Legs day. Last legs (Jan 24): Squats 280lbs x 6 felt heavy after watching reels.
Today: Start with lighter warm-up (225lbs x 8) to prime CNS before working sets.
You did 280lbs last time - aim for 285lbs if warm-up feels good."

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

=== todaysPlan EXAMPLES ===

❌ WRONG todaysPlan.summary:
"Complete a chest workout focusing on compound movements."

✓ RIGHT todaysPlan.summary:
"LEGS DAY (rotation: Jan 24 Legs → Jan 25 Back → Jan 26 Chest → TODAY LEGS)

Last legs session (Jan 24): Squats 280lbs x 6 felt heavy after scrolling phone between sets.
Today's plan:
1. Squats: Start 250lbs x 8 warm-up, work to 285lbs x 5 (attempt +5lbs from last time)
2. Leg Press: 400lbs x 10,10,8 (same as last time, focus on depth)
3. RDL: 185lbs x 8,8,8 (last time grip failed - use straps)
4. Leg Curls: 3x12 (new addition for hamstring isolation)

Recovery note: You had shoulder discomfort after chest yesterday - won't affect legs but avoid holding bar too narrow on squats."

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
Today's plan: Have cold water ready, plan a walk after work, avoid phone if argument happens."

╔══════════════════════════════════════════════════════════════════════════════╗
║                       TODAY'S PLAN REQUIREMENTS                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

todaysPlan MUST include:

FOR GYM:
1. ROTATION: State the split (PPL/Upper-Lower/Bro/etc.) and what today should be
2. INJURY CHECK: If any discomfort → test protocol + pivot option
3. WHAT to do: Specific muscle group with exercises from their history
4. SAME-SESSION COMPARISON: Reference last time they did this muscle
5. IMPROVEMENTS: What to do differently based on last session's issues

FOR DIET:
1. WHAT to eat (specific foods from their history)
2. WHY (deficit/surplus, compensation for yesterday)
3. TRIGGER AVOIDANCE (what situations to avoid based on binge patterns)

FOR ADDICTION:
1. HIGH-RISK TIMES today (based on patterns)
2. COPING STRATEGIES that worked before
3. TRIGGER AVOIDANCE plan

The coach reading this knows NOTHING. Give them everything they need to help this specific user today.

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

=== 5. CREATE TODAY'S PLAN ===

Follow the rules above for your session type. Remember:
- Reference the LAST TIME user did this specific activity
- Include specific metrics (weights, calories, times)
- Explain the reasoning based on their data
- Account for injuries/discomfort
- Account for emotional factors from recent events

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
- TODAY'S DATE: Use this to determine correct rotation and timing
- SESSION NAME/GOAL: What this session is about
- USER PROFILE (UOM): Their goals, targets, preferences
- TODAY'S EVENTS: What they've already done today
- YESTERDAY: What happened yesterday (critical for rotation)
- RECENT DAILY HISTORY: Last 7 days (for patterns)
- HISTORICAL EVENTS: Past events relevant to this session

=== OUTPUT ===
Return JSON matching the schema exactly. Every field is required.
If you don't have data for a field, use empty array [] or appropriate defaults.
For coachBriefing fields with no data, write "(No data available yet)"
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
  },
  trackerType?: TrackerType
): string {
  const sections: string[] = [];

  // TODAY'S DATE - CRITICAL for rotation logic - Make it VERY prominent
  const today = new Date().toISOString().split('T')[0];
  sections.push(`╔══════════════════════════════════════════════════════════════════════════════╗`);
  sections.push(`║                         TODAY'S DATE: ${today}                            ║`);
  sections.push(`╚══════════════════════════════════════════════════════════════════════════════╝`);
  sections.push(`Plan for TODAY (${today}). Most recent workout was YESTERDAY or earlier.`);
  sections.push('');

  // For gym sessions, add ROTATION SUMMARY section at the top
  if (trackerType === 'gym') {
    const dailyReviews = knowledge.reviews
      .filter((r) => r.type === 'daily' || r.periodKey.match(/^\d{4}-\d{2}-\d{2}$/))
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
      .slice(0, 5);

    if (dailyReviews.length > 0) {
      sections.push(`╔══════════════════════════════════════════════════════════════════════════════╗`);
      sections.push(`║              WORKOUT ROTATION (ANALYZE THIS FIRST FOR GYM)                   ║`);
      sections.push(`╚══════════════════════════════════════════════════════════════════════════════╝`);
      sections.push(`Last 5 workouts with their muscle groups:`);
      sections.push('');

      // Extract muscle group keywords from each review summary
      for (const review of dailyReviews) {
        const summary = review.summary.toLowerCase();
        let muscleGroup = 'UNKNOWN';

        // Detect muscle group from summary content
        if (summary.includes('chest') || summary.includes('bench') || summary.includes('push')) {
          muscleGroup = 'CHEST/PUSH';
        } else if (summary.includes('back') || summary.includes('pull') || summary.includes('deadlift') || summary.includes('row')) {
          muscleGroup = 'BACK/PULL';
        } else if (summary.includes('leg') || summary.includes('squat') || summary.includes('lower')) {
          muscleGroup = 'LEGS';
        } else if (summary.includes('shoulder') || summary.includes('press')) {
          muscleGroup = 'SHOULDERS';
        } else if (summary.includes('arm') || summary.includes('bicep') || summary.includes('tricep')) {
          muscleGroup = 'ARMS';
        }

        // Extract first line or first 100 chars of summary for exercises
        const exercisePreview = review.summary.split('\n')[0].substring(0, 100);
        sections.push(`- ${review.periodKey}: ${muscleGroup} - ${exercisePreview}`);
      }

      sections.push('');
      sections.push(`→ ANALYZE the pattern above to determine TODAY's muscle group`);
      sections.push(`→ Today MUST be DIFFERENT from the most recent workout's muscle group`);
      sections.push(`→ Include ROTATION VALIDATION in your context field`);
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
