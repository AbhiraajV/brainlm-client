'use server';

/**
 * On-Demand Suggestion Generation
 *
 * Generates detailed, structured workout/diet suggestions based on user's history.
 * Called when user clicks "Generate Suggestion" button.
 */

import { requireUser } from '@/server/auth';
import type { SessionKnowledge, SessionAnalysis, SuggestedWorkout, SuggestedDiet } from '@/lib/sessions/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// WORKOUT SUGGESTION
// ============================================================================

const WORKOUT_SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    workoutType: { type: 'string' }, // "Chest", "Back", "Legs", "Push", "Pull", etc.
    reason: { type: 'string' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          sets: { type: 'number' },
          reps: { type: 'string' },
          weight: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
        },
        required: ['name', 'sets', 'reps', 'weight', 'notes'],
        additionalProperties: false,
      },
    },
  },
  required: ['workoutType', 'reason', 'exercises'],
  additionalProperties: false,
};

const WORKOUT_SUGGESTION_PROMPT = `You are a workout planner. Your ONLY job is to suggest a workout based on the user's ACTUAL training data.

=== ABSOLUTE RULES - VIOLATION = FAILURE ===

1. NEVER suggest an exercise that doesn't appear in HISTORICAL EVENTS
2. NEVER guess a weight - only use EXACT numbers from the data
3. NEVER mix muscle groups (no shoulder press in a legs workout)
4. If data is missing, use weight: "unknown" and notes: "No previous data" - DO NOT INVENT
5. NEVER invent dates - if you say "Last: Jan 23", that date MUST appear in HISTORICAL EVENTS
6. If there are NO exercises for the requested muscle group in HISTORICAL EVENTS, suggest common exercises for that muscle group with weight: "unknown"

=== PRIORITY: CHECK FOR PRE-DETERMINED WORKOUT ===

FIRST, check if there is a "TODAY'S WORKOUT (PRE-DETERMINED BY ANALYSIS)" section at the TOP of the input.

IF PRE-DETERMINED WORKOUT EXISTS:
- The muscle group and exercises are ALREADY DECIDED - DO NOT change them
- Use the listed exercises as your foundation
- Look up weights/reps from HISTORICAL EVENTS for those specific exercises
- You may add 1-2 similar exercises from history if needed
- Skip directly to STEP 3 (finding weights from history)

IF NO PRE-DETERMINED WORKOUT:
- Follow STEP 1 and STEP 2 below to determine the muscle group

=== STEP 1: ANALYZE SPLIT PATTERN (ONLY IF NO PRE-DETERMINED) ===

Read RECENT DAILY HISTORY and list each day:
- What date?
- What muscle group was trained?
- What exercises were done?

Then identify the pattern:
- 3-day: Chest → Back → Legs → repeat
- PPL: Push → Pull → Legs → repeat
- Upper/Lower: Upper → Lower → repeat

=== STEP 2: DETERMINE TODAY'S MUSCLE GROUP (ONLY IF NO PRE-DETERMINED) ===

Based on the pattern:
- If yesterday = Back and pattern = Chest→Back→Legs, then today = LEGS
- If yesterday = Legs and pattern = Chest→Back→Legs, then today = CHEST
- If yesterday = Chest and pattern = Chest→Back→Legs, then today = BACK

CRITICAL: Don't repeat what they did yesterday or the day before!

SESSION TITLE OVERRIDE: If title says "Chest Day", always do Chest regardless of rotation.

=== STEP 3: FIND EXERCISES FROM HISTORY ===

Search HISTORICAL EVENTS for previous workouts of TODAY'S muscle group.
Extract ONLY exercises that appear in the data:

For each exercise found:
- Name (exact as it appears)
- Weight used (exact number)
- Reps achieved
- Date it was done

Example:
- "Bench Press: 80kg x 8 on Jan 23"
- "Incline DB: 30kg x 10 on Jan 23"

If an exercise doesn't appear for this muscle group, DO NOT SUGGEST IT.

=== STEP 4: SUGGEST WITH PROGRESSION ===

For each exercise from their history:
- Weight: same as last time OR +2.5kg if last was easy
- Reps: same range as they typically do
- Notes: cite their last session with exact date/weight/reps

=== OUTPUT ===

{
  "workoutType": "[Muscle group from PRE-DETERMINED section OR from rotation analysis]",
  "reason": "[If pre-determined: cite the analysis. If not: show rotation logic]",
  "exercises": [
    {
      "name": "[Exercise from their history]",
      "sets": [their typical sets],
      "reps": "[their typical reps]",
      "weight": "[exact weight from history]",
      "notes": "Last: [date] - [weight] x [reps]"
    }
  ]
}

=== VALIDATION ===

Before responding, check:
[ ] If pre-determined exists, workout type matches the pre-determined muscle group
[ ] Every exercise exists in their history for this muscle group, OR weight is "unknown"
[ ] Every weight is copied EXACTLY from their data, not invented
[ ] Every date mentioned (e.g., "Last: Jan 23") exists in HISTORICAL EVENTS
[ ] If no data exists for this muscle group, ALL weights are "unknown"
[ ] No exercises from other muscle groups mixed in

=== HANDLING MISSING DATA ===

If the pre-determined muscle group (e.g., Chest) has NO exercises in HISTORICAL EVENTS:
- Still suggest that muscle group (don't switch to a different one)
- Suggest common exercises for that muscle group (Bench Press, Incline DB, etc.)
- Set weight: "unknown" for ALL exercises
- Set notes: "No previous data - start with comfortable weight"
- In reason: Explain "No previous chest workout data found in history"`;

/**
 * Generate a detailed workout suggestion based on user's training history
 */
export async function generateWorkoutSuggestion(
  sessionTitle: string,
  sessionGoal: string,
  knowledge: SessionKnowledge,
  analysis?: SessionAnalysis
): Promise<SuggestedWorkout | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[generateWorkoutSuggestion] No OpenAI API key');
    return null;
  }

  const input = formatKnowledgeForWorkout(sessionTitle, sessionGoal, knowledge, analysis);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use full model for better reasoning on workout logic
        messages: [
          { role: 'system', content: WORKOUT_SUGGESTION_PROMPT },
          { role: 'user', content: input },
        ],
        temperature: 0.2, // Low temperature for strict data adherence
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'workout_suggestion',
            strict: true,
            schema: WORKOUT_SUGGESTION_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateWorkoutSuggestion] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);

    return {
      exercises: parsed.exercises.map((e: Record<string, unknown>) => ({
        name: e.name as string,
        sets: e.sets as number,
        reps: e.reps as string,
        weight: e.weight as string | undefined,
        notes: e.notes as string | undefined,
      })),
      reason: `**${parsed.workoutType}**\n\n${parsed.reason}`,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[generateWorkoutSuggestion] Error:', error);
    return null;
  }
}

// ============================================================================
// DIET SUGGESTION
// ============================================================================

const DIET_SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    reason: { type: 'string' },
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string' },
          suggestion: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          notes: { type: ['string', 'null'] },
        },
        required: ['time', 'suggestion', 'calories', 'protein', 'carbs', 'fat', 'notes'],
        additionalProperties: false,
      },
    },
    dailyTotals: {
      type: 'object',
      properties: {
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
      additionalProperties: false,
    },
  },
  required: ['reason', 'meals', 'dailyTotals'],
  additionalProperties: false,
};

const DIET_SUGGESTION_PROMPT = `You are a nutrition planner creating a meal plan based on the user's goals and history.

=== YOUR TASK ===

1. FIND THEIR TARGETS
   - Look at USER PROFILE for calorie/protein targets
   - Identify their goal: cutting, bulking, or maintaining
   - Note any dietary preferences or restrictions

2. ANALYZE RECENT INTAKE
   - Check YESTERDAY's intake (if high calories, suggest lighter today)
   - Check TODAY'S EVENTS for what they've already eaten
   - Calculate remaining macros for the day

3. CREATE MEAL PLAN
   - Skip meals they've already had
   - Prioritize hitting protein target
   - Use foods they actually eat (from HISTORICAL EVENTS)
   - Account for their typical meal times

4. OUTPUT FORMAT
   Return JSON with:
   - reason: Explain the plan (reference targets, what they ate, adjustments)
   - meals: Array of meal suggestions with full macros
   - dailyTotals: Target totals for the day

=== CRITICAL RULES ===

1. Use foods they've eaten before (from history)
2. If they're over calories yesterday, compensate today
3. If protein is low so far today, prioritize protein-dense foods
4. Be specific with portions (e.g., "200g chicken breast" not "some chicken")
5. If no target data, use defaults: 2000 cal, 150g protein for cutting

=== EXAMPLE OUTPUT ===

{
  "reason": "Target: 1800 cal, 160g protein (cutting to 75kg). TODAY: breakfast was 400cal/30g protein. REMAINING: 1400 cal, 130g protein. Yesterday was 2100 cal (300 over), so today is slightly lighter. Prioritizing protein with foods you eat regularly.",
  "meals": [
    {"time": "Lunch", "suggestion": "Grilled chicken salad (200g chicken, mixed greens, olive oil dressing)", "calories": 450, "protein": 50, "carbs": 15, "fat": 22, "notes": "High protein, low carb"},
    {"time": "Snack", "suggestion": "Greek yogurt with almonds", "calories": 200, "protein": 20, "carbs": 12, "fat": 8, "notes": null},
    {"time": "Dinner", "suggestion": "Salmon (180g) with roasted vegetables", "calories": 550, "protein": 45, "carbs": 25, "fat": 28, "notes": "Omega-3s for recovery"},
    {"time": "Evening", "suggestion": "Protein shake with banana", "calories": 200, "protein": 25, "carbs": 30, "fat": 2, "notes": "If still hungry"}
  ],
  "dailyTotals": {"calories": 1800, "protein": 160, "carbs": 180, "fat": 60}
}`;

/**
 * Generate a detailed diet suggestion based on user's nutrition goals and history
 */
export async function generateDietSuggestion(
  sessionTitle: string,
  sessionGoal: string,
  knowledge: SessionKnowledge
): Promise<SuggestedDiet | null> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    console.error('[generateDietSuggestion] No OpenAI API key');
    return null;
  }

  const input = formatKnowledgeForDiet(sessionTitle, sessionGoal, knowledge);

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
          { role: 'system', content: DIET_SUGGESTION_PROMPT },
          { role: 'user', content: input },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'diet_suggestion',
            strict: true,
            schema: DIET_SUGGESTION_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateDietSuggestion] OpenAI error:', error);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);

    return {
      meals: parsed.meals.map((m: Record<string, unknown>) => ({
        time: m.time as string,
        suggestion: m.suggestion as string,
        calories: m.calories as number,
        protein: m.protein as number,
        carbs: m.carbs as number,
        fat: m.fat as number,
        notes: m.notes as string | undefined,
      })),
      dailyTotals: parsed.dailyTotals,
      reason: parsed.reason,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[generateDietSuggestion] Error:', error);
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatKnowledgeForWorkout(
  title: string,
  goal: string,
  knowledge: SessionKnowledge,
  analysis?: SessionAnalysis
): string {
  const sections: string[] = [];

  // If analysis exists with todaysPlan, inject it as authoritative context at the TOP
  if (analysis?.todaysPlan) {
    // Try to extract muscle group from summary (e.g., "chest workout" -> "chest")
    const summaryLower = analysis.todaysPlan.summary.toLowerCase();
    const muscleGroups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'push', 'pull', 'upper', 'lower'];
    const detectedMuscle = muscleGroups.find(m => summaryLower.includes(m)) || 'unknown';

    sections.push(`=== TODAY'S WORKOUT (PRE-DETERMINED BY ANALYSIS - MANDATORY) ===`);
    sections.push(`MUSCLE GROUP: ${detectedMuscle.toUpperCase()}`);
    sections.push(`SUMMARY: ${analysis.todaysPlan.summary}`);
    sections.push('');

    // Check if there are any metrics (weights) provided in the analysis
    const hasMetrics = analysis.todaysPlan.items.some(item => item.metrics.length > 0);

    if (analysis.todaysPlan.items.length > 0) {
      sections.push(`EXERCISES TO INCLUDE:`);
      for (const item of analysis.todaysPlan.items) {
        sections.push(`- ${item.suggestion}`);
        if (item.rationale) {
          sections.push(`  Reason: ${item.rationale}`);
        }
        if (item.metrics.length > 0) {
          const metricsStr = item.metrics.map(m => `${m.key}: ${m.value}`).join(', ');
          sections.push(`  Targets: ${metricsStr}`);
        }
      }
      sections.push('');
    }

    sections.push(`!!! CRITICAL: The muscle group above is ALREADY DETERMINED.`);
    sections.push(`!!! DO NOT re-analyze the split pattern. Generate exercises for ${detectedMuscle.toUpperCase()} ONLY.`);

    // If no metrics were provided, the analysis didn't have historical data for this muscle group
    if (!hasMetrics) {
      sections.push(`!!! WARNING: No historical weight data found for ${detectedMuscle} exercises.`);
      sections.push(`!!! If you cannot find ${detectedMuscle} exercises in HISTORICAL EVENTS, use weight: "unknown" and notes: "No previous data - start light".`);
      sections.push(`!!! DO NOT invent weights or dates. Only use data that exists.`);
    }
    sections.push('');
  }

  sections.push(`=== SESSION INFO ===`);
  sections.push(`TITLE: ${title}`);
  sections.push(`GOAL: ${goal || '(none provided)'}`);
  sections.push(`TODAY'S DATE: ${new Date().toISOString().split('T')[0]}`);
  sections.push('');

  // Today's events - CRITICAL: don't suggest these again
  sections.push(`=== TODAY'S EVENTS (ALREADY DONE TODAY - DO NOT SUGGEST AGAIN) ===`);
  if (knowledge.todaysEvents && knowledge.todaysEvents.length > 0) {
    for (const event of knowledge.todaysEvents) {
      sections.push(`- ${event.content}`);
    }
  } else {
    sections.push('(Nothing logged today yet - user has not started workout)');
  }
  sections.push('');

  // Yesterday - CRITICAL for determining today's muscle group
  if (knowledge.yesterdaysReview) {
    sections.push(`=== YESTERDAY (${knowledge.yesterdaysReview.periodKey}) - WHAT MUSCLE GROUP WAS THIS? ===`);
    sections.push(knowledge.yesterdaysReview.summary);
    sections.push('');
  }

  // Recent daily history - CRITICAL for split pattern
  const dailyReviews = knowledge.reviews
    .filter((r) => r.type === 'daily' || r.periodKey.match(/^\d{4}-\d{2}-\d{2}$/))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
    .slice(0, 10);

  if (dailyReviews.length > 0) {
    sections.push(`=== RECENT DAILY HISTORY (ANALYZE THIS TO FIND SPLIT PATTERN) ===`);
    sections.push(`Read each day and identify the muscle group trained:`);
    for (const review of dailyReviews) {
      sections.push(`\n--- ${review.periodKey} ---`);
      sections.push(review.summary);
    }
    sections.push('');
  }

  // Historical events - SOURCE OF TRUTH for exercises and weights
  if (knowledge.events.length > 0) {
    sections.push(`=== HISTORICAL EVENTS (ONLY USE EXERCISES AND WEIGHTS FROM HERE) ===`);
    sections.push(`These are actual logged workouts. Extract exercise names and weights from these.`);
    const eventsToShow = knowledge.events.slice(0, 40);
    for (const event of eventsToShow) {
      const date = event.occurredAt.split('T')[0];
      sections.push(`\n[${date}] ${event.content}`);
    }
    sections.push('');
  } else {
    sections.push(`=== HISTORICAL EVENTS ===`);
    sections.push(`(No historical workout events found - cannot suggest specific exercises)`);
    sections.push('');
  }

  // User profile
  if (knowledge.userBaseline) {
    sections.push(`=== USER PROFILE ===`);
    sections.push(knowledge.userBaseline);
    sections.push('');
  }

  // Patterns
  if (knowledge.patterns.length > 0) {
    sections.push(`=== PATTERNS ===`);
    for (const pattern of knowledge.patterns) {
      sections.push(`- ${pattern.name}: ${pattern.description}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

function formatKnowledgeForDiet(
  title: string,
  goal: string,
  knowledge: SessionKnowledge
): string {
  const sections: string[] = [];

  sections.push(`=== SESSION ===`);
  sections.push(`TITLE: ${title}`);
  sections.push(`GOAL: ${goal || '(none provided)'}`);
  sections.push('');

  // User profile (targets)
  if (knowledge.userBaseline) {
    sections.push(`=== USER PROFILE (Calorie/Protein Targets) ===`);
    sections.push(knowledge.userBaseline);
    sections.push('');
  }

  // Today's events (already eaten)
  sections.push(`=== TODAY'S EVENTS (Already Eaten - Calculate Remaining) ===`);
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

  // Yesterday
  if (knowledge.yesterdaysReview) {
    sections.push(`=== YESTERDAY (${knowledge.yesterdaysReview.periodKey}) - For Compensation ===`);
    sections.push(knowledge.yesterdaysReview.summary);
    sections.push('');
  }

  // Historical events (for food preferences)
  if (knowledge.events.length > 0) {
    sections.push(`=== HISTORICAL EVENTS (Foods They Eat) ===`);
    const eventsToShow = knowledge.events.slice(0, 25);
    for (const event of eventsToShow) {
      sections.push(`- ${event.content}`);
    }
    sections.push('');
  }

  // Patterns (eating patterns)
  if (knowledge.patterns.length > 0) {
    sections.push(`=== PATTERNS ===`);
    for (const pattern of knowledge.patterns) {
      sections.push(`- ${pattern.name}: ${pattern.description}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
