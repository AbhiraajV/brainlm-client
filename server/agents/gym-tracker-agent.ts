/**
 * Gym Tracker Agent — Pure Data Parser
 *
 * Stripped-down agent focused solely on converting user input into
 * tool calls that update the workout log. No coaching, no advice.
 * Uses gpt-4.1-mini for fast, cheap data parsing.
 *
 * All data-parsing prompt sections are preserved verbatim from
 * gym-coach-agent.ts to maintain parsing reliability.
 */

import type {
  WorkoutLog,
  PRSummary,
} from '@/lib/sessions/types';
import type { KnownExercise } from '@/server/actions/exercise-library.actions';
import {
  GYM_COACH_TOOLS,
  type SearchExerciseDatabaseArgs,
  type AddExerciseArgs,
  type AddSetArgs,
  type UpdateSetArgs,
  type RemoveSetArgs,
  type RemoveExerciseArgs,
  type RenameExerciseArgs,
  type GetExerciseHistoryArgs,
  type UpdateExerciseNotesArgs,
  type UpdateWorkoutNotesArgs
} from './gym-coach-tools';
import {
  handleAddExercise,
  handleAddSet,
  handleUpdateSet,
  handleRemoveSet,
  handleRemoveExercise,
  handleRenameExercise,
  handleUpdateWorkout,
  handleUpdateExerciseNotes,
  type ExercisePRData
} from './handlers';
import { queryExercisePR, getExerciseHistory } from '@/server/actions/gym-history.actions';
import { searchExercises, findExerciseById } from '@/lib/gym/exercise-database';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
      refusal?: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LastLoggedSet {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  weightUnit: string;
  reps: number;
}

export interface GymTrackerResult {
  updatedWorkout: WorkoutLog;
  trackerResponse: string;   // "OK" | "NO_DATA" | clarification question
  toolsUsed: string[];
  prsDetected: PRSummary[];
  lastLoggedSet?: LastLoggedSet;
  error?: string;
}

/**
 * Build the system prompt for the gym tracker agent.
 * All data-parsing sections are preserved verbatim from gym-coach-agent.ts.
 * Coaching identity, response rules, and deep user context are removed.
 */
function buildTrackerPrompt(
  currentWorkout: WorkoutLog,
  lastLoggedSet?: LastLoggedSet,
  workoutPlanContext?: string,
  knownExercises?: KnownExercise[]
): string {
  const workoutContext = currentWorkout.exercises.length > 0
    ? formatWorkoutForPrompt(currentWorkout)
    : '(No exercises logged yet - starting fresh)';

  return `You are a structured data parser for workout tracking.
Your ONLY job is to convert user messages into tool calls that update the workout log.

RULES:
- Parse the message and call the appropriate tools to update the workout
- If the message contains workout data, you MUST call tools — no exceptions
- After tools execute successfully, respond "OK"
- If no workout data found in the message, respond "NO_DATA"
- If ambiguous (can't determine exercise, weight, or reps), ask a brief clarification (under 15 words)
- NEVER give advice, coaching, analysis, or explain what you logged
- NEVER say "I've logged", "recorded", "tracking" — just respond "OK"
- Tools run SILENTLY — the workout log card shows the user what was logged

---

════════════════════════════════════════
CURRENT SESSION (TODAY — this is what you modify with tools)
════════════════════════════════════════
${workoutContext}
════════════════════════════════════════

CRITICAL: If data already appears in CURRENT SESSION above, it is ALREADY LOGGED.
Only call tools for NEW data from the user's CURRENT message.

${knownExercises && knownExercises.length > 0 ? `
## YOUR USER'S EXERCISE LIBRARY

These are exercises the user has done before. When logging exercises, ALWAYS check this list first.
If the user mentions an exercise that matches one below, use the EXACT name from this list.
Only create a new exercise if it genuinely doesn't exist here.

| Exercise | Muscle Group | Equipment | Sessions |
|----------|-------------|-----------|----------|
${knownExercises.map(ke => `| ${ke.exerciseName} | ${ke.muscleGroup} | ${ke.equipmentType} | ${ke.sessionCount} |`).join('\n')}

### EXERCISE LIBRARY MATCHING (CRITICAL — FOLLOW EXACTLY)

1. When the user mentions an exercise, FIRST check the library above.
2. If you find a match (even approximate), use the EXACT exerciseName from the library.
   - "bench" → matches "Barbell Bench Press" in library → use "Barbell Bench Press"
   - "incline db" → matches "Incline Dumbbell Press" → use "Incline Dumbbell Press"
3. If no match in the library, check if this is a well-known exercise and use its proper name.
4. NEVER create a variation of an exercise that already exists in the library.
   - BAD: library has "Bench Press", you create "Flat Bench Press"
   - GOOD: library has "Bench Press", you use "Bench Press"
5. Use the most specific muscle group possible from the expanded list.
   - Incline Bench → upper_chest (not just chest)
   - Lateral Raise → side_delts (not just shoulders)
   - Skull Crushers → triceps_long_head (not just triceps)
   - Cable Fly → mid_chest (not just chest)
   - Face Pulls → rear_delts (not just shoulders)
   - Hammer Curls → brachialis (not just biceps)
` : ''}
## EXERCISE NOTES — QUALITATIVE OBSERVATIONS

You can store persistent notes on any exercise using update_exercise_notes.
These notes carry forward to future sessions via the exercise library.

USE THIS FOR:
- Physical observations: "Left side noticeably weaker", "Shoulder impingement at bottom ROM"
- Setup notes: "Needs liftoff on sets >80kg", "Seat position 3 on this machine"
- Form cues: "Tendency to flare elbows", "Better mind-muscle connection with slow eccentric"
- Equipment preferences: "Wider grip feels better on shoulders"

DO THIS AUTOMATICALLY when you observe something noteworthy from the user's messages.
DO NOT ask permission — just note it, like a coach writing on their clipboard.
When the user reports improvement ("left side is catching up", "shoulder feels fine now"):
→ Update the note to reflect the change or remove the outdated observation.

KEEP NOTES BRIEF — 1 line per observation, comma-separated if multiple.

${workoutPlanContext ? `── USER'S WORKOUT PLAN (their intended program) ──
${workoutPlanContext}
Use this to understand the weekly structure and guide today's session.
────────────────────────────────────────

` : ''}## TOOL DECISION PROCESS (FOLLOW THIS IN ORDER)

RULE: When calling add_set for an existing exercise, you MUST provide the exerciseId
from CURRENT WORKOUT STATE. The IDs are shown as (ID: exercise_xxx).
NEVER rely on exerciseName matching for existing exercises.

Tools run SILENTLY - NEVER say "I'll log that", "Let me record", "logging your set". Just DO IT.

### STEP 1: SCAN THE MESSAGE FOR DATA TYPES

Scan the user's message and identify ALL of the following (in priority order):

**A) WORKOUT DATA (weight + reps) - HIGHEST PRIORITY**
If you find ANY of these, you MUST call tools - questions don't cancel this:
- Explicit: "70kg x 8", "135 for 6", "50lbs failed at 5"
- With question: "incline 70kg failed 5? what do i do" ← STILL HAS DATA, MUST LOG
- Failed/tried: "tried 80kg, failed at 4" ← COMPLETED 4 REPS, MUST LOG
- Multiple: "50lbs 8, 7, 6" ← THREE SETS to log
- Partial: "only got 6", "couldn't finish, stopped at 5" ← STILL DATA

**B) REPEAT INDICATORS (use LAST LOGGED SET values)**
- "another set", "another", "one more"
- "same", "same again", "repeat", "again"
- "failed again", "another fail", "same thing"
- Just a number: "8", "7 this time", "5 again"

**C) CORRECTIONS**
- "actually it was 75kg", "no wait, that was 6 reps"
- "wrong weight, it was X"

**D) REMOVALS**
- "remove that", "delete last set", "scratch that"
- "remove [exercise name]"

**E) EXERCISE DECLARATIONS (no sets yet)**
- "chest day", "leg day", "push day" → create full template
- "I'll do X", "let's add X", "doing X today"
- User states their plan → ACCEPT IT, don't argue

**F) PURE QUESTION (ONLY if none of A-E found)**
- "what should I do?", "is this good?", "what's next?"
- Questions ABOUT exercises without intent: "what's good for chest?"

### SMART DATA INFERENCE (USE YOUR CONTEXT!)

If the user provides INCOMPLETE data (weight but no reps, or vice versa):

1. CHECK PREVIOUS MESSAGES:
   - Did they mention a rep scheme? "doing 3x8 today" → 8 reps

2. CHECK LAST LOGGED SET:
   - If this is set 2/3, likely same reps as set 1

3. CHECK CURRENT WORKOUT STATE:
   - Find their typical reps for this exercise at this weight from earlier sets

4. INFER CONFIDENTLY based on context:
   - Call add_set with inferred value

5. ONLY ASK if no context available:
   - New exercise, no history, unusual weight

### BACKFILL MISSED LOGS

When user says "set 2" or "second set", CHECK if set 1 was logged:

1. Look at CURRENT WORKOUT STATE below
2. If set 1 is missing for this exercise:
   - Find set 1 data in the chat history (previous messages)
   - Infer any missing values (see SMART DATA INFERENCE)
   - Call add_set for set 1 FIRST, then set 2

Example:
- Previous message: "70kg bench" (no reps, not logged)
- Current message: "set 2 8 reps"
- Action: Log set 1 as 70kg x 8, then log set 2 as 70kg x 8

Use parallel tool calls to log multiple sets efficiently.

### STEP 2: CALL TOOLS BASED ON WHAT YOU FOUND

**Found A (workout data)?** → MUST call tools, even if there's also a question
1. Check CURRENT WORKOUT STATE below
2. New exercise? → add_exercise + add_set
3. Existing exercise? → add_set only (use exerciseId from state)
4. Multiple sets in message? → multiple add_set calls

**Found B (repeat)?** → MUST call add_set with LAST LOGGED SET values below
- Use same exerciseId, weight, weightUnit, reps
- "failed again" = same weight, same reps, setType: "to_failure"

**Found C (correction)?** → Call update_set

**Found D (removal)?** → Call remove_set or remove_exercise

**Found E (exercise declaration)?** → Call add_exercise with targets

**Found F only (pure question)?** → No tools, respond "NO_DATA"

### STEP 3: RESPOND
After tools complete, respond "OK".
If message had a question + data, log the data first, then respond "OK".
If no data found, respond "NO_DATA".
If ambiguous, ask a brief clarification (under 15 words).
${lastLoggedSet ? `
## LAST LOGGED SET (for "another set" / "same" / "again" / "failed again")
Exercise: ${lastLoggedSet.exerciseName} (ID: ${lastLoggedSet.exerciseId})
Weight: ${lastLoggedSet.weight}${lastLoggedSet.weightUnit}
Reps: ${lastLoggedSet.reps}

When user says "another set", "same", "again", "one more", "failed again", or just a number:
→ Use exerciseId: "${lastLoggedSet.exerciseId}"
→ Use weight: ${lastLoggedSet.weight}, weightUnit: "${lastLoggedSet.weightUnit}"
→ Use actualReps: ${lastLoggedSet.reps} (or the number they said if different)
→ "failed again" = setType: "to_failure" with same weight/reps
` : ''}

## EXERCISE RESOLUTION (MANDATORY)
Before calling add_exercise for a NEW exercise, you MUST call search_exercise_database first.
- Use the exercise name as query, include the broad muscle group if known
- Review results: prefer exercises marked isKnown (user's existing library)
- Pass the selected exercise's id as globalExerciseId to add_exercise
- If no good match exists, call add_exercise without globalExerciseId (custom exercise)
- This ensures 100% correct exercise identity — never skip this step for new exercises

## EXERCISE HANDLING
- BEFORE calling add_exercise, check CURRENT WORKOUT STATE section below
- If exercise ALREADY EXISTS (by name), DO NOT call add_exercise - just call add_set with existing exercise ID
- Only call add_exercise for exercises NOT already in the workout
- When user states their plan, ACCEPT IT - don't argue about what day it "should" be

## WEIGHT HANDLING - READ CAREFULLY
ALWAYS use weightUnit: "lbs" in ALL tool calls. If user says "kg", multiply by 2.2 and round to nearest 0.5.
Example: User says "60kg" → 60 × 2.2 = 132 → use weight: 132, weightUnit: "lbs"
The system will auto-convert if you accidentally pass kg, but prefer doing it yourself.

BARBELL WEIGHT MATH (bar + plates):
- "45 + 5 each side" or "45 + 5 either side" = 45 + 5 + 5 = 55 total
- "135 on the bar" = 135 total
- "bar + 25s" = 45 + 25 + 25 = 95 total (assuming standard 45lb bar)
- "plate each side" = 45 + 45 + 45 = 135 total

DUMBBELL WEIGHT (per hand):
- "30lb dumbbells" = 30 per hand, so weight: 30 (log the single dumbbell weight)
- "30s each hand" = weight: 30

PLATE NOTATION:
- "X each side" or "X either side" = the plate weight per side, add both sides to bar
- "45 + 10s" = 45 bar + 10 + 10 = 65 total

ALL tool calls MUST use weightUnit: "lbs".

## EXAMPLES - FOLLOW TOOL DECISION PROCESS

### CRITICAL: DATA + QUESTION EXAMPLES (Most Common Mistake)

User: "incline 70kg failed 5 reps? what do i do"
→ SCAN: Found "70kg" + "5 reps" = WORKOUT DATA (type A) + question
→ DECISION: Data found = MUST call tools
→ Call add_exercise(exerciseName: "Incline Barbell Bench Press", muscleGroup: "chest", equipmentType: "barbell")
→ Call add_set(exerciseName: "Incline Barbell Bench Press", weight: 70, weightUnit: "kg", actualReps: 5, setType: "to_failure")
→ THEN respond "OK"
→ ❌ WRONG: Only answering the question without logging

User: "bench 80kg x 6, should I drop weight?"
→ SCAN: Found "80kg" + "6" = WORKOUT DATA + question
→ DECISION: Data found = MUST call tools
→ Call add_set(80kg, 6 reps), THEN respond "OK"

User: "failed at 5 on incline, what now?"
→ SCAN: Found "5" + exercise context = WORKOUT DATA + question
→ DECISION: Data found = MUST call tools
→ Call add_set(actualReps: 5, to_failure), THEN respond "OK"

### Repeat/Context Shortcuts

User: "another set" (after logging 70kg x 8)
→ SCAN: "another set" = REPEAT INDICATOR (type B)
→ Call add_set with LAST LOGGED SET values: weight: 70, actualReps: 8

User: "failed again" (after failing at 70kg x 5)
→ SCAN: "failed again" = REPEAT INDICATOR (type B)
→ Call add_set with LAST LOGGED SET values: weight: 70, actualReps: 5, setType: "to_failure"
→ ❌ WRONG: Asking "what weight/reps?" when we just logged a set

User: "7 this time" (after 70kg x 8)
→ SCAN: Just a number = REPEAT INDICATOR with new reps
→ Call add_set with same weight (70), new reps (7)

### Standard Data Logging

User: "bench press 135 for 8"
→ Call add_exercise + add_set (BOTH tools in ONE response)

User: "45 + 5 either side for 10" (exercise already exists)
→ Math: 45 + 5 + 5 = 55lbs total
→ Call add_set(exerciseId from CURRENT WORKOUT STATE, weight: 55, actualReps: 10)

User: "tried 50lbs failed at 6 reps"
→ Call add_set(weight: 50, actualReps: 6, setType: "to_failure")
→ "failed" still means they completed 6 reps = DATA

User: "50lbs 8, 7, 6" (three sets)
→ Call add_set THREE times: (50, 8), (50, 7), (50, 6)

### Pure Questions (NO tools)

User: "what should I do for chest?"
→ SCAN: No data, no intent = PURE QUESTION (type F)
→ NO TOOL CALLS - respond "NO_DATA"

## IMPORTANT RULES
- Use consistent, normalized exercise names (e.g., "Barbell Bench Press" not "bench")
- Default to 'working' set type unless user specifies otherwise
- No markdown, no formatting, no bullet points - just plain text

## EXERCISE NAMING CONVENTIONS
- Always include equipment type: "Barbell", "Dumbbell", "Cable", "Machine"
- Use proper capitalization: "Barbell Bench Press", "Lat Pulldown", "Romanian Deadlift"
- Be specific: "Incline Dumbbell Press" not just "incline press"

## SET TYPE INFERENCE - ALWAYS INFER AND SET

ALWAYS set a setType - never leave it undefined. Infer from context:

WARMUP indicators:
- "warmup", "warm up", "warming up"
- Light weight with high reps before working sets
- First 1-2 sets of an exercise at <60% working weight

WORKING indicators (default):
- Regular sets at working intensity
- No special qualifier mentioned
- Most sets should be "working"

TO_FAILURE indicators:
- "to failure", "til failure", "failed at X"
- "tried X, couldn't finish", "only got X"
- "pushed to failure", "AMRAP"
- Any set where user says they couldn't complete target

TOP indicators:
- "top set", "heavy set", "max effort"
- Heaviest set of the day for that exercise

BACKOFF indicators:
- "back off", "backoff", "back down"
- Sets after top set at reduced weight

DROPSET indicators:
- "drop set", "dropset"
- Immediately reduced weight, no rest

Examples:
- "135 for 8" → setType: "working"
- "just warming up with 95" → setType: "warmup"
- "tried 155, failed at 6" → setType: "to_failure", actualReps: 6
- "top set 185 for 5" → setType: "top"
- "dropped to 135 for 10" → setType: "backoff" or "dropset" (context dependent)

## FINAL RULES

- Response must be "OK", "NO_DATA", or a brief clarification question (under 15 words)
- No markdown, no formatting, no bullet points - just plain text
- NEVER recite numbers the log card already shows
- If user provides workout data or says "another set", you MUST call add_set. Never just comment.
`;
}

/**
 * Format workout for prompt context (verbatim from gym-coach-agent.ts)
 */
function formatWorkoutForPrompt(workout: WorkoutLog): string {
  const lines: string[] = [];

  if (workout.workoutName) {
    lines.push(`Workout: ${workout.workoutName}`);
  }
  lines.push(`Date: ${workout.date}`);
  lines.push(`Preferred unit: ${workout.preferredUnit}`);
  lines.push('');

  for (const exercise of workout.exercises) {
    lines.push(`### ${exercise.exerciseName} (ID: ${exercise.id})`);
    lines.push(`Muscle: ${exercise.muscleGroup} | Equipment: ${exercise.equipmentType}`);

    if (exercise.sets.length > 0) {
      for (const set of exercise.sets) {
        let setLine = `  Set ${set.setNumber}: ${set.weight}${set.weightUnit} × ${set.actualReps}`;
        if (set.setType !== 'working') setLine += ` [${set.setType}]`;
        if (set.rpe) setLine += ` @ RPE ${set.rpe}`;
        if (set.computed?.isPR) setLine += ' PR!';
        lines.push(setLine);
      }
    } else {
      lines.push('  (no sets logged yet)');
    }
    lines.push('');
  }

  if (workout.computed?.prsThisSession && workout.computed.prsThisSession.length > 0) {
    lines.push('### PRs This Session');
    for (const pr of workout.computed.prsThisSession) {
      lines.push(`- ${pr.exerciseName}: ${pr.prType} PR! (+${pr.improvement.toFixed(1)}%)`);
    }
  }

  return lines.join('\n');
}

/**
 * Execute the gym tracker agent
 */
export async function executeGymTracker(
  currentWorkout: WorkoutLog,
  userMessage: string,
  previousMessages: ChatMessage[] = [],
  lastLoggedSet?: LastLoggedSet,
  workoutPlanContext?: string,
  knownExercises?: KnownExercise[],
): Promise<GymTrackerResult> {
  if (!OPENAI_API_KEY) {
    return {
      updatedWorkout: currentWorkout,
      trackerResponse: 'Configuration error - please check API settings.',
      toolsUsed: [],
      prsDetected: [],
      error: 'No OpenAI API key configured'
    };
  }

  const systemPrompt = buildTrackerPrompt(currentWorkout, lastLoggedSet, workoutPlanContext, knownExercises);

  // Build message history
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
    { role: 'user', content: userMessage }
  ];

  try {
    // Phase 1: Initial API call with tools
    const response = await callOpenAI(messages, true);

    if (!response.choices?.[0]?.message) {
      return {
        updatedWorkout: currentWorkout,
        trackerResponse: 'Failed to get response from AI.',
        toolsUsed: [],
        prsDetected: [],
        error: 'Empty response'
      };
    }

    const assistantMessage = response.choices[0].message;
    let workout = currentWorkout;
    const toolsUsed: string[] = [];
    const prsDetected: PRSummary[] = [];
    let newLastLoggedSet: LastLoggedSet | undefined = lastLoggedSet;

    // Process tool calls if any
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: ChatMessage[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await processToolCall(workout, toolName, args, knownExercises);

          workout = result.workout;
          if (result.pr) {
            prsDetected.push(result.pr);
          }

          // Capture last logged set for "another set" context
          if (toolName === 'add_set') {
            const setArgs = args as AddSetArgs;
            const exercise = setArgs.exerciseId
              ? workout.exercises.find(e => e.id === setArgs.exerciseId)
              : setArgs.exerciseName
                ? workout.exercises.find(e =>
                    e.exerciseName.toLowerCase().trim() === (setArgs.exerciseName?.toLowerCase().trim() ?? '')
                  )
                : undefined;

            newLastLoggedSet = {
              exerciseId: exercise?.id || setArgs.exerciseId || '',
              exerciseName: exercise?.exerciseName || setArgs.exerciseName || '',
              weight: setArgs.weight,
              weightUnit: setArgs.weightUnit,
              reps: setArgs.actualReps
            };
          }

          toolResults.push({
            role: 'tool',
            content: JSON.stringify({
              success: true,
              ...result.data
            }),
            tool_call_id: toolCall.id
          });
        } catch (toolError) {
          console.error(`[GymTracker] Tool ${toolName} error:`, toolError);
          toolResults.push({
            role: 'tool',
            content: JSON.stringify({
              success: false,
              error: toolError instanceof Error ? toolError.message : 'Unknown error'
            }),
            tool_call_id: toolCall.id
          });
        }
      }

      // Phase 2: Verification pass — inject updated state WITH tools still enabled
      const updatedWorkoutContext = formatWorkoutForPrompt(workout);
      const verificationMessages: ChatMessage[] = [
        ...messages,
        {
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls
        },
        ...toolResults,
        {
          role: 'system',
          content: `UPDATED WORKOUT STATE after your tool calls:
${updatedWorkoutContext}

VERIFY: Does every piece of data from the user's message appear correctly in the log above? If something is missing or wrong, call the appropriate tool to fix it. If everything is correct, respond "OK".`
        }
      ];

      const verificationResponse = await callOpenAI(verificationMessages, true);
      const verificationMessage = verificationResponse.choices?.[0]?.message;

      // If verification found issues and made more tool calls, process them
      if (verificationMessage?.tool_calls && verificationMessage.tool_calls.length > 0) {
        const verificationToolResults: ChatMessage[] = [];

        for (const toolCall of verificationMessage.tool_calls) {
          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await processToolCall(workout, toolName, args, knownExercises);
            workout = result.workout;
            if (result.pr) prsDetected.push(result.pr);

            // Update lastLoggedSet if add_set
            if (toolName === 'add_set') {
              const setArgs = args as AddSetArgs;
              const exercise = setArgs.exerciseId
                ? workout.exercises.find(e => e.id === setArgs.exerciseId)
                : setArgs.exerciseName
                  ? workout.exercises.find(e =>
                      e.exerciseName.toLowerCase().trim() === (setArgs.exerciseName?.toLowerCase().trim() ?? '')
                    )
                  : undefined;
              newLastLoggedSet = {
                exerciseId: exercise?.id || setArgs.exerciseId || '',
                exerciseName: exercise?.exerciseName || setArgs.exerciseName || '',
                weight: setArgs.weight,
                weightUnit: setArgs.weightUnit,
                reps: setArgs.actualReps
              };
            }

            verificationToolResults.push({
              role: 'tool',
              content: JSON.stringify({ success: true, ...result.data }),
              tool_call_id: toolCall.id
            });
          } catch (toolError) {
            console.error(`[GymTracker] Verification tool ${toolName} error:`, toolError);
            verificationToolResults.push({
              role: 'tool',
              content: JSON.stringify({
                success: false,
                error: toolError instanceof Error ? toolError.message : 'Unknown error'
              }),
              tool_call_id: toolCall.id
            });
          }
        }

        // Final call without tools for tracker response
        const finalMessages: ChatMessage[] = [
          ...verificationMessages,
          {
            role: 'assistant',
            content: verificationMessage.content || '',
            tool_calls: verificationMessage.tool_calls
          },
          ...verificationToolResults
        ];

        const finalResponse = await callOpenAI(finalMessages, false);
        const trackerResponse = finalResponse.choices?.[0]?.message?.content || 'OK';

        return {
          updatedWorkout: workout,
          trackerResponse,
          toolsUsed,
          prsDetected,
          lastLoggedSet: newLastLoggedSet
        };
      }

      // No verification tool calls — use the verification response
      const trackerResponse = verificationMessage?.content || 'OK';

      return {
        updatedWorkout: workout,
        trackerResponse,
        toolsUsed,
        prsDetected,
        lastLoggedSet: newLastLoggedSet
      };
    }

    // No tool calls - return the response (likely "NO_DATA" or a clarification)
    return {
      updatedWorkout: workout,
      trackerResponse: assistantMessage.content || 'NO_DATA',
      toolsUsed: [],
      prsDetected: []
    };
  } catch (error) {
    console.error('[GymTracker] Error:', error);
    return {
      updatedWorkout: currentWorkout,
      trackerResponse: 'Something went wrong. Please try again.',
      toolsUsed: [],
      prsDetected: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Call OpenAI API — uses gpt-4.1-mini for cost efficiency
 */
async function callOpenAI(
  messages: ChatMessage[],
  includeTools: boolean
): Promise<OpenAIResponse> {
  const requestBody: Record<string, unknown> = {
    model: 'gpt-4.1-mini',
    messages,
    temperature: 0.1, // Very low for strict instruction following
    max_tokens: includeTools ? 1024 : 100 // 1024 for tool reasoning, 100 for short tracker responses
  };

  if (includeTools) {
    requestBody.tools = GYM_COACH_TOOLS;
    requestBody.tool_choice = 'auto';
    requestBody.parallel_tool_calls = true; // Enable calling multiple tools at once
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[GymTracker] OpenAI error:', error);
    throw new Error('OpenAI API error');
  }

  return response.json();
}

/**
 * Process a tool call and return updated workout
 * (Verbatim from gym-coach-agent.ts)
 */
async function processToolCall(
  workout: WorkoutLog,
  toolName: string,
  args: unknown,
  knownExercises?: KnownExercise[]
): Promise<{ workout: WorkoutLog; pr?: PRSummary; data?: Record<string, unknown> }> {
  switch (toolName) {
    case 'search_exercise_database': {
      const searchArgs = args as SearchExerciseDatabaseArgs;
      const globalResults = searchExercises(searchArgs.query, {
        muscleGroup: searchArgs.muscleGroup,
        limit: 15,
      });

      // Merge with user's known exercises (known first, deduplicated)
      const merged: { id: number; name: string; muscleGroup: string; equipmentType: string; isKnown: boolean }[] = [];
      const seenNames = new Set<string>();

      if (knownExercises) {
        const queryLower = searchArgs.query.toLowerCase();
        const queryTokens = queryLower.split(/\s+/);
        for (const ke of knownExercises) {
          const keLower = ke.exerciseName.toLowerCase();
          const matches = queryTokens.every(t => keLower.includes(t));
          if (matches) {
            merged.push({
              id: ke.exerciseRegistryId ? parseInt(ke.exerciseRegistryId, 10) : 0,
              name: ke.exerciseName,
              muscleGroup: ke.muscleGroup,
              equipmentType: ke.equipmentType,
              isKnown: true,
            });
            seenNames.add(keLower);
          }
        }
      }

      for (const g of globalResults) {
        if (!seenNames.has(g.name.toLowerCase())) {
          merged.push({
            id: g.id,
            name: g.name,
            muscleGroup: g.muscleGroup,
            equipmentType: g.equipmentType,
            isKnown: false,
          });
          seenNames.add(g.name.toLowerCase());
        }
      }

      return {
        workout,
        data: { exercises: merged.slice(0, 15) },
      };
    }

    case 'add_exercise': {
      const addArgs = args as AddExerciseArgs;
      const result = handleAddExercise(workout, addArgs);

      // If agent provided a globalExerciseId, use canonical data from global DB
      if (addArgs.globalExerciseId && !result.alreadyExists) {
        const globalEx = findExerciseById(addArgs.globalExerciseId);
        if (globalEx) {
          const exIdx = result.workout.exercises.findIndex(e => e.id === result.exerciseId);
          if (exIdx >= 0) {
            result.workout.exercises[exIdx].globalExerciseId = globalEx.id;
            result.workout.exercises[exIdx].exerciseName = globalEx.name;
            result.workout.exercises[exIdx].muscleGroup = globalEx.muscleGroup;
            result.workout.exercises[exIdx].equipmentType = globalEx.equipmentType;
          }
        }
      } else if (!addArgs.globalExerciseId && !result.alreadyExists) {
        // Agent didn't provide globalExerciseId — check known exercises as fallback
        if (knownExercises) {
          const nameLower = addArgs.exerciseName.toLowerCase();
          const knownMatch = knownExercises.find(
            ke => ke.exerciseName.toLowerCase() === nameLower
          );
          if (knownMatch) {
            const exIdx = result.workout.exercises.findIndex(e => e.id === result.exerciseId);
            if (exIdx >= 0 && knownMatch.exerciseRegistryId) {
              result.workout.exercises[exIdx].exerciseRegistryId = knownMatch.exerciseRegistryId;
            }
          }
        }
      }

      // Always show resolve popup for new exercises so user can confirm identity
      if (!result.alreadyExists) {
        const exIdx = result.workout.exercises.findIndex(e => e.id === result.exerciseId);
        if (exIdx >= 0) {
          result.workout.exercises[exIdx].needsResolution = true;
        }
      }

      return {
        workout: result.workout,
        data: {
          exerciseId: result.exerciseId,
          exerciseName: result.workout.exercises.find(e => e.id === result.exerciseId)?.exerciseName || addArgs.exerciseName,
          alreadyExists: result.alreadyExists,
          message: result.alreadyExists
            ? `Exercise "${addArgs.exerciseName}" already exists, using existing ID`
            : `Created new exercise "${addArgs.exerciseName}"`
        }
      };
    }

    case 'add_set': {
      const setArgs = args as AddSetArgs;
      // Get historical PR data for this exercise - lookup by ID or name
      let exercise = setArgs.exerciseId
        ? workout.exercises.find(e => e.id === setArgs.exerciseId)
        : undefined;

      // Fallback to name lookup if not found by ID (strict match only)
      if (!exercise && setArgs.exerciseName) {
        const searchName = setArgs.exerciseName.toLowerCase().trim();
        exercise = workout.exercises.find(e =>
          e.exerciseName.toLowerCase().trim() === searchName
        );
      }

      let historicalBest: ExercisePRData | null = null;
      const exerciseNameForPR = exercise?.exerciseName ?? setArgs.exerciseName;
      const registryIdForPR = exercise?.exerciseRegistryId;

      if (exerciseNameForPR) {
        try {
          historicalBest = await queryExercisePR(exerciseNameForPR, registryIdForPR);
        } catch (e) {
          console.warn('[GymTracker] Failed to query exercise PR:', e);
        }
      }

      const result = handleAddSet(
        workout,
        setArgs,
        historicalBest ?? undefined
      );

      return {
        workout: result.workout,
        pr: result.pr,
        data: {
          setNumber: result.setNumber,
          isPR: !!result.pr,
          prType: result.pr?.prType,
          wasDuplicate: result.wasDuplicate
        }
      };
    }

    case 'update_set': {
      const result = handleUpdateSet(workout, args as UpdateSetArgs);
      return { workout: result.workout, data: { updated: result.updated } };
    }

    case 'remove_set': {
      const result = handleRemoveSet(workout, args as RemoveSetArgs);
      return { workout: result.workout, data: { removed: result.removed } };
    }

    case 'remove_exercise': {
      const result = handleRemoveExercise(workout, args as RemoveExerciseArgs);
      return {
        workout: result.workout,
        data: { removed: result.removed, exerciseName: result.exerciseName }
      };
    }

    case 'rename_exercise': {
      const result = handleRenameExercise(workout, args as RenameExerciseArgs);
      return {
        workout: result.workout,
        data: { renamed: result.renamed, oldName: result.oldName, newName: result.newName }
      };
    }

    case 'get_exercise_history': {
      const historyArgs = args as GetExerciseHistoryArgs;
      // Look up exercise in current workout to get registryId for better matching
      const histExercise = workout.exercises.find(
        e => e.exerciseName.toLowerCase() === historyArgs.exerciseName.toLowerCase()
      );
      const history = await getExerciseHistory(
        historyArgs.exerciseName,
        historyArgs.limit ?? 10,
        histExercise?.exerciseRegistryId
      );
      return {
        workout,
        data: { history }
      };
    }

    case 'update_exercise_notes': {
      const result = handleUpdateExerciseNotes(workout, args as UpdateExerciseNotesArgs);
      return { workout: result.workout, data: { updated: result.updated } };
    }

    case 'update_workout_notes': {
      const result = handleUpdateWorkout(workout, args as UpdateWorkoutNotesArgs);
      return { workout: result.workout, data: { updated: result.updated } };
    }

    default:
      console.warn(`[GymTracker] Unknown tool: ${toolName}`);
      return { workout };
  }
}
