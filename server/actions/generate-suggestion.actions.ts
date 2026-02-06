'use server';

/**
 * On-Demand Suggestion Generation
 *
 * Generates detailed, structured workout/diet suggestions based on user's history.
 * Called when user clicks "Generate Suggestion" button.
 */

import { requireUser } from '@/server/auth';
import type { SessionKnowledge, SessionAnalysis, SuggestedWorkout, SuggestedDiet, MenstrualCycleInfo } from '@/lib/sessions/types';

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
- VALIDATE IT FIRST by checking RECENT DAILY HISTORY
- If the pre-determined muscle group is the SAME as the most recent workout, IGNORE IT and determine the correct muscle group using STEP 1 and STEP 2
- Example: If pre-determined says "CHEST" but yesterday was also Chest → IGNORE and pick the next muscle in rotation
- If the pre-determined muscle group is DIFFERENT from the most recent workout, use it
- Use the listed exercises as your foundation
- Look up weights/reps from HISTORICAL EVENTS for those specific exercises
- You may add 1-2 similar exercises from history if needed

IF NO PRE-DETERMINED WORKOUT OR IF PRE-DETERMINED IS INVALID:
- Follow STEP 1 and STEP 2 below to determine the muscle group

CRITICAL VALIDATION:
- NEVER repeat the same muscle group as the most recent workout day
- If analysis says "Chest" and most recent was "Chest", OVERRIDE and pick next in rotation

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
- In reason: Explain "No previous chest workout data found in history"

=== CYCLE-AWARE ADJUSTMENTS (if MENSTRUAL CYCLE PHASE section exists) ===

If user has menstrual cycle info, adjust suggestions:

MENSTRUAL (days 1-5):
- Suggest 10-15% lower weights than usual
- Add note: "Phase-adjusted - focus on technique"
- In reason: "Menstrual phase (day X) - weights reduced, focus on form"

FOLLICULAR (days 6-14):
- Can suggest slight increases (+2.5kg) if recent sessions were strong
- Good time for PRs
- In reason: "Follicular phase - good window for progressive overload"

OVULATION (days 14-17):
- Peak performance, can push harder
- Best time for max attempts
- In reason: "Ovulation window - peak strength phase"

LUTEAL (days 18-28):
- Keep weights same as last session (don't increase)
- Note: "May feel harder - RPE +1-2 expected"
- In reason: "Luteal phase (day X) - maintaining weights, expect higher RPE"`;

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
   - CHECK if MENSTRUAL CYCLE PHASE section exists - adjust targets accordingly

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

=== CYCLE-AWARE ADJUSTMENTS (if MENSTRUAL CYCLE PHASE section exists) ===

MENSTRUAL PHASE (days 1-5):
- Prioritize iron-rich foods: red meat, spinach, legumes, fortified cereals
- Suggest warm, easy-to-digest foods
- In reason: "Menstrual phase - including iron-rich foods for energy"

FOLLICULAR PHASE (days 6-14):
- Normal targets apply
- Good phase for higher carb days if training hard
- In reason: "Follicular phase - carbs utilized efficiently"

LUTEAL PHASE (days 18-28):
- ADD 100-300 calories to daily target (metabolism increases)
- Include magnesium-rich foods: dark chocolate, nuts, leafy greens
- NEVER suggest restriction - hunger is biological
- In reason: "Luteal phase (day X) - daily target increased by ~200cal for higher BMR. Cravings are normal."

CRITICAL for luteal phase:
- If user's target is 1700 cal, suggest 1900-2000 cal during luteal
- Always mention this is biological, not overeating
- Include a treat (dark chocolate, etc.) - it helps with magnesium

=== CRITICAL RULES ===

1. Use foods they've eaten before (from history)
2. If they're over calories yesterday, compensate today
3. If protein is low so far today, prioritize protein-dense foods
4. Be specific with portions (e.g., "200g chicken breast" not "some chicken")
5. If no target data, use defaults: 2000 cal, 150g protein for cutting
6. During luteal phase, DO NOT suggest restriction - add 100-300 cal to target

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
}

LUTEAL PHASE EXAMPLE:

{
  "reason": "Target: 1800 cal normally, but LUTEAL PHASE (day 23) - BMR increases 100-300cal. Adjusted target: 2000 cal. Cravings are biological. Including magnesium-rich foods.",
  "meals": [
    {"time": "Lunch", "suggestion": "Steak salad (150g sirloin, mixed greens, avocado)", "calories": 550, "protein": 45, "carbs": 12, "fat": 35, "notes": "Iron + protein"},
    {"time": "Snack", "suggestion": "Dark chocolate (30g) + handful of almonds", "calories": 250, "protein": 6, "carbs": 18, "fat": 18, "notes": "Magnesium helps with luteal symptoms"},
    {"time": "Dinner", "suggestion": "Salmon with sweet potato and broccoli", "calories": 650, "protein": 50, "carbs": 45, "fat": 28, "notes": null},
    {"time": "Evening", "suggestion": "Greek yogurt with berries", "calories": 200, "protein": 18, "carbs": 22, "fat": 4, "notes": "If hungry - this is normal during luteal"}
  ],
  "dailyTotals": {"calories": 2000, "protein": 155, "carbs": 180, "fat": 70}
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
// DETERMINISTIC ROTATION DETECTION
// ============================================================================

/**
 * Map of exercise keywords → canonical muscle group.
 * Broader than the old keyword check — covers exercise names that don't
 * contain the muscle-group word (e.g. "Bench Press" → CHEST).
 */
const EXERCISE_MUSCLE_MAP: Record<string, string[]> = {
  CHEST: [
    'chest', 'bench', 'push-up', 'pushup', 'push up',
    'incline db', 'incline dumbbell', 'decline', 'flye', 'fly',
    'cable cross', 'pec', 'dip',
  ],
  BACK: [
    'back', 'pull-up', 'pullup', 'pull up', 'pulldown', 'lat pull',
    'deadlift', 'row', 'barbell row', 'dumbbell row', 'cable row',
    'face pull', 'chin-up', 'chinup', 'chin up', 't-bar',
  ],
  LEGS: [
    'leg', 'squat', 'lower', 'lunge', 'leg press', 'leg curl',
    'leg extension', 'calf', 'rdl', 'romanian', 'hip thrust',
    'hamstring', 'quad', 'glute',
  ],
  SHOULDERS: [
    'shoulder', 'ohp', 'overhead press', 'military press',
    'lateral raise', 'front raise', 'rear delt', 'shrug',
  ],
  ARMS: [
    'arm', 'bicep', 'tricep', 'curl', 'hammer curl',
    'skull crusher', 'tricep pushdown', 'preacher',
  ],
  PUSH: ['push day', 'push session'],
  PULL: ['pull day', 'pull session'],
};

/** Normalised group names that we collapse PPL variants into */
const GROUP_ALIASES: Record<string, string> = {
  'CHEST': 'CHEST',
  'PUSH': 'CHEST',   // Push ≈ Chest+Shoulders+Triceps
  'BACK': 'BACK',
  'PULL': 'BACK',    // Pull ≈ Back+Biceps
  'LEGS': 'LEGS',
  'SHOULDERS': 'SHOULDERS',
  'ARMS': 'ARMS',
};

/**
 * Detect the muscle group trained in a review summary by scanning for
 * exercise-name keywords (not just muscle-group words).
 */
function detectMuscleGroupFromSummary(summary: string): string {
  const lower = summary.toLowerCase();

  // Score each group by how many keywords match
  let bestGroup = 'UNKNOWN';
  let bestScore = 0;

  for (const [group, keywords] of Object.entries(EXERCISE_MUSCLE_MAP)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  }

  // Normalise aliases (PUSH→CHEST, PULL→BACK)
  return GROUP_ALIASES[bestGroup] ?? bestGroup;
}

interface RotationResult {
  /** The detected split as an ordered list of muscle groups, e.g. ['LEGS','BACK','CHEST'] */
  detectedSplit: string[];
  /** The most recent workout's muscle group */
  mostRecentMuscle: string;
  /** The date of the most recent workout */
  mostRecentDate: string;
  /** The code-computed next muscle group */
  nextMuscle: string;
  /** Human-readable explanation of why this muscle was chosen */
  rotationReason: string;
}

/**
 * Deterministically compute the next muscle group from daily reviews.
 *
 * 1. Parse each daily review → muscle group via the broad exercise→muscle map
 * 2. Deduce the repeating split (e.g. LEGS→BACK→CHEST)
 * 3. Return the next muscle via modular wrap-around
 */
function detectRotationAndNextMuscle(
  reviews: { id: string; type: string; summary: string; periodKey: string }[]
): RotationResult | null {
  // Filter to daily reviews and sort newest-first
  const dailyReviews = reviews
    .filter(r => r.type === 'daily' || r.periodKey.match(/^\d{4}-\d{2}-\d{2}$/))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  if (dailyReviews.length === 0) return null;

  // Build ordered history: [ { date, muscle } ] newest-first
  const history: { date: string; muscle: string }[] = [];
  for (const review of dailyReviews) {
    const muscle = detectMuscleGroupFromSummary(review.summary);
    if (muscle !== 'UNKNOWN') {
      history.push({ date: review.periodKey, muscle });
    }
  }

  if (history.length === 0) return null;

  const mostRecentMuscle = history[0].muscle;
  const mostRecentDate = history[0].date;

  // --- Detect the repeating split pattern ---
  // Walk backwards (oldest→newest) through unique consecutive groups
  // e.g. [CHEST, BACK, LEGS, CHEST, BACK, LEGS] → split = [CHEST, BACK, LEGS]
  const reversed = [...history].reverse(); // oldest-first
  const uniqueSequence: string[] = [];
  for (const entry of reversed) {
    // Only add if different from last (collapse consecutive same-muscle days)
    if (uniqueSequence.length === 0 || uniqueSequence[uniqueSequence.length - 1] !== entry.muscle) {
      uniqueSequence.push(entry.muscle);
    }
  }

  // Try to find the shortest repeating cycle (length 2..uniqueSequence.length)
  let detectedSplit: string[] = uniqueSequence; // fallback: full sequence
  for (let cycleLen = 2; cycleLen <= Math.min(6, uniqueSequence.length); cycleLen++) {
    const candidate = uniqueSequence.slice(0, cycleLen);
    let matches = true;
    for (let i = cycleLen; i < uniqueSequence.length; i++) {
      if (uniqueSequence[i] !== candidate[i % cycleLen]) {
        matches = false;
        break;
      }
    }
    if (matches && uniqueSequence.length >= cycleLen * 2) {
      // We found a repeating cycle with at least 2 full repetitions
      detectedSplit = candidate;
      break;
    }
  }

  // If we couldn't find a strict repeat but have ≤6 unique groups, use as-is
  if (detectedSplit.length > 6) {
    detectedSplit = uniqueSequence.slice(0, Math.min(uniqueSequence.length, 6));
  }

  // --- Compute next muscle via modular arithmetic ---
  const lastIndex = detectedSplit.indexOf(mostRecentMuscle);
  let nextMuscle: string;
  if (lastIndex === -1) {
    // Most recent muscle not in detected split (unusual) → default to first in split
    nextMuscle = detectedSplit[0];
  } else {
    nextMuscle = detectedSplit[(lastIndex + 1) % detectedSplit.length];
  }

  // Build a readable explanation
  const historyStr = history
    .slice(0, 5)
    .reverse()
    .map(h => `${h.date} ${h.muscle}`)
    .join(', ');

  const splitStr = detectedSplit.join(' → ');
  const isWrap = lastIndex === detectedSplit.length - 1;
  const wrapNote = isWrap
    ? ` Most recent was ${mostRecentMuscle} (END of cycle) → wrap to start = ${nextMuscle}.`
    : ` Most recent was ${mostRecentMuscle} → next in sequence = ${nextMuscle}.`;

  const rotationReason =
    `Last workouts: ${historyStr}. ` +
    `Detected split: ${splitStr} (${detectedSplit.length}-day rotation).` +
    wrapNote;

  return {
    detectedSplit,
    mostRecentMuscle,
    mostRecentDate,
    nextMuscle,
    rotationReason,
  };
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

  // Add cycle phase section if available
  if (knowledge.cyclePhase?.tracking && knowledge.cyclePhase.currentPhase) {
    sections.push(`=== MENSTRUAL CYCLE PHASE ===`);
    sections.push(`Current phase: ${knowledge.cyclePhase.currentPhase.toUpperCase()} (Day ${knowledge.cyclePhase.dayOfCycle})`);

    if (knowledge.cyclePhase.currentPhase === 'menstrual') {
      sections.push(`ADJUST: Lower weights by 10-15%, focus on volume not intensity`);
      sections.push(`AVOID: Max attempts, new PRs`);
      sections.push(`NOTE: Strength typically 10-20% lower - this is normal physiology`);
    } else if (knowledge.cyclePhase.currentPhase === 'luteal') {
      sections.push(`ADJUST: Same weights will feel harder (higher RPE), this is normal`);
      sections.push(`AVOID: Aggressive progressive overload this week`);
      sections.push(`NOTE: Don't chase PRs - maintain current weights`);
    } else if (knowledge.cyclePhase.currentPhase === 'follicular') {
      sections.push(`OPTIMAL: Good phase for intensity, can push progressive overload`);
      sections.push(`NOTE: Recovery is efficient - can train harder`);
    } else if (knowledge.cyclePhase.currentPhase === 'ovulation') {
      sections.push(`OPTIMAL: Peak performance window - best time for PRs`);
      sections.push(`NOTE: Strength and coordination at highest`);
    }
    sections.push('');
  }

  // ── Deterministic rotation: compute next muscle from reviews ──
  const rotation = detectRotationAndNextMuscle(knowledge.reviews);
  const computedNextMuscle = rotation?.nextMuscle ?? null;

  // Inject authoritative rotation section so the LLM has correct context
  if (rotation) {
    sections.push(`=== ROTATION (COMPUTED — AUTHORITATIVE) ===`);
    sections.push(`${rotation.rotationReason}`);
    sections.push(`TODAY'S MUSCLE GROUP: ${rotation.nextMuscle}`);
    sections.push(`THIS IS COMPUTED BY CODE AND IS AUTHORITATIVE. Do NOT override this.`);
    sections.push('');
  }

  // If analysis exists with todaysPlan, validate it against the code-computed rotation
  if (analysis?.todaysPlan) {
    // Detect muscle from analysis summary using the same broad mapping
    const analysisMuscle = detectMuscleGroupFromSummary(analysis.todaysPlan.summary);

    // Determine if the analysis agrees with the code-computed rotation
    const analysisMatchesRotation =
      !computedNextMuscle ||
      analysisMuscle === 'UNKNOWN' ||
      analysisMuscle === computedNextMuscle;

    if (!analysisMatchesRotation) {
      // Analysis conflicts with code-computed rotation → OVERRIDE
      sections.push(`=== WARNING: ANALYSIS OVERRIDDEN BY ROTATION ===`);
      sections.push(`Analysis suggested: ${analysisMuscle}`);
      sections.push(`Code-computed rotation says: ${computedNextMuscle}`);
      sections.push(`USING CODE-COMPUTED ROTATION (${computedNextMuscle}).`);
      sections.push(`The analysis was wrong — generate exercises for ${computedNextMuscle} ONLY.`);
      sections.push('');
    } else {
      // Analysis agrees (or we can't tell) — use it
      const displayMuscle = computedNextMuscle ?? analysisMuscle;
      sections.push(`=== TODAY'S WORKOUT (PRE-DETERMINED BY ANALYSIS, CONFIRMED BY ROTATION) ===`);
      sections.push(`MUSCLE GROUP: ${displayMuscle}`);
      sections.push(`SUMMARY: ${analysis.todaysPlan.summary}`);
      if (rotation) {
        sections.push(`ROTATION CONFIRMATION: ${rotation.rotationReason}`);
      }
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
      sections.push(`!!! DO NOT re-analyze the split pattern. Generate exercises for ${displayMuscle} ONLY.`);

      // If no metrics were provided, the analysis didn't have historical data for this muscle group
      if (!hasMetrics) {
        sections.push(`!!! WARNING: No historical weight data found for ${displayMuscle} exercises.`);
        sections.push(`!!! If you cannot find ${displayMuscle} exercises in HISTORICAL EVENTS, use weight: "unknown" and notes: "No previous data - start light".`);
        sections.push(`!!! DO NOT invent weights or dates. Only use data that exists.`);
      }
      sections.push('');
    }
  } else if (computedNextMuscle) {
    // No analysis but we have a rotation → tell the LLM what to do
    sections.push(`=== TODAY'S WORKOUT (COMPUTED FROM ROTATION) ===`);
    sections.push(`MUSCLE GROUP: ${computedNextMuscle}`);
    sections.push(`${rotation!.rotationReason}`);
    sections.push(`Generate exercises for ${computedNextMuscle} ONLY.`);
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

  // Add cycle phase section if available
  if (knowledge.cyclePhase?.tracking && knowledge.cyclePhase.currentPhase) {
    sections.push(`=== MENSTRUAL CYCLE PHASE ===`);
    sections.push(`Current phase: ${knowledge.cyclePhase.currentPhase.toUpperCase()} (Day ${knowledge.cyclePhase.dayOfCycle})`);

    if (knowledge.cyclePhase.currentPhase === 'luteal') {
      sections.push(`CALORIE ADJUSTMENT: Add 100-300 cal to daily target (BMR increases)`);
      sections.push(`CRAVINGS: Normal and biological - DO NOT suggest restriction`);
      sections.push(`MAGNESIUM FOODS: Include dark chocolate, nuts, leafy greens`);
      sections.push(`NOTE: Eating 100-300 cal more during luteal is not overeating - it's biology`);
    } else if (knowledge.cyclePhase.currentPhase === 'menstrual') {
      sections.push(`IRON NEEDS: Prioritize iron-rich foods (red meat, spinach, legumes)`);
      sections.push(`DIGESTION: Suggest easier-to-digest, warm foods`);
      sections.push(`NOTE: Energy may be lower - nutrient-dense comfort foods are appropriate`);
    } else if (knowledge.cyclePhase.currentPhase === 'follicular') {
      sections.push(`CARBS: Utilized efficiently - good time for higher carb days`);
      sections.push(`NOTE: Normal targets apply, good recovery phase`);
    } else if (knowledge.cyclePhase.currentPhase === 'ovulation') {
      sections.push(`METABOLISM: Slightly higher - normal targets apply`);
      sections.push(`NOTE: Peak energy phase`);
    }
    sections.push('');
  }

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
