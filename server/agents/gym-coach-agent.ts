/**
 * Gym Coach Agent with Tool Calling
 *
 * This agent handles real-time gym tracking by processing user messages
 * and calling tools to modify workout data during conversation.
 */

import type {
  WorkoutLog,
  PRSummary,
  SessionAnalysis,
  MenstrualCycleInfo
} from '@/lib/sessions/types';
import type { KnownExercise, ExerciseLibrarySummary } from '@/server/actions/exercise-library.actions';
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
import { queryExercisePR, getExerciseHistory, type SessionInsightEntry } from '@/server/actions/gym-history.actions';
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

export interface GymCoachAgentResult {
  updatedWorkout: WorkoutLog;
  coachComment: string;
  toolsUsed: string[];
  prsDetected: PRSummary[];
  error?: string;
  lastLoggedSet?: LastLoggedSet;
}

/**
 * Format past session insights grouped by exercise.
 * For each insight, check which exercises it mentions and group accordingly.
 * Insights that don't mention any specific exercise go under "General".
 */
function formatPastInsights(pastInsights: SessionInsightEntry[]): string {
  if (!pastInsights.length) return '(No past session notes yet)';

  const byExercise: Record<string, string[]> = {};

  for (const insight of pastInsights) {
    const dateLabel = `[${insight.date}, ${insight.workoutName || 'Workout'}]`;
    let matched = false;

    for (const exName of insight.exerciseNames) {
      // Check if the insight text mentions this exercise (case-insensitive partial match on significant words)
      const words = exName.toLowerCase().split(/\s+/);
      const mentionsExercise = words.some(w => w.length > 3 && insight.insight.toLowerCase().includes(w));
      if (mentionsExercise) {
        if (!byExercise[exName]) byExercise[exName] = [];
        byExercise[exName].push(`  ${dateLabel} ${insight.insight}`);
        matched = true;
      }
    }

    if (!matched) {
      if (!byExercise['General']) byExercise['General'] = [];
      byExercise['General'].push(`  ${dateLabel} ${insight.insight}`);
    }
  }

  return Object.entries(byExercise)
    .map(([exercise, notes]) => `${exercise}:\n${notes.join('\n')}`)
    .join('\n\n');
}

/**
 * Format exercise library summaries for injection into the system prompt.
 * Pre-formats each exercise with PR, trend, recent sessions, and insights.
 */
function formatExerciseLibrary(summaries: ExerciseLibrarySummary[]): string {
  if (!summaries.length) return '';

  const trendArrow = (t: 'up' | 'down' | 'flat' | null) =>
    t === 'up' ? '↑' : t === 'down' ? '↓' : t === 'flat' ? '→' : '?';

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const lines: string[] = [
    '## EXERCISE PERFORMANCE DATA — TODAY\'S MUSCLE GROUPS',
    '',
    'Detailed stats for exercises relevant to today\'s session. Use this for evidence-based coaching.',
    '',
  ];

  for (const ex of summaries) {
    lines.push(`### ${ex.exerciseName} (${ex.muscleGroup}, ${ex.equipmentType}) — ${ex.sessionCount} sessions, trend: ${trendArrow(ex.progressTrend)}`);
    lines.push(`PR: ${ex.prWeight}kg (${formatDate(ex.prWeightDate)}) | E1RM: ${Math.round(ex.prE1RM)}kg (${formatDate(ex.prE1RMDate)})`);
    if (ex.recentSessions) {
      lines.push(`Recent: ${ex.recentSessions}`);
    }
    if (ex.insights.length > 0) {
      lines.push(`Insights: ${ex.insights.map(i => i.message).join('; ')}`);
    }
    if (ex.notes.length > 0) {
      lines.push(`Notes: ${ex.notes.map(n => `"${n}"`).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build the system prompt for the gym coach agent
 */
function buildSystemPrompt(
  brainTransfer: string,
  currentWorkout: WorkoutLog,
  analysis?: SessionAnalysis,
  cyclePhase?: MenstrualCycleInfo,
  lastLoggedSet?: LastLoggedSet,
  workoutPlanContext?: string,
  knownExercises?: KnownExercise[],
  pastInsights?: SessionInsightEntry[],
  exerciseLibrary?: ExerciseLibrarySummary[]
): string {
  const workoutContext = currentWorkout.exercises.length > 0
    ? formatWorkoutForPrompt(currentWorkout)
    : '(No exercises logged yet - starting fresh)';

  const cycleContext = cyclePhase?.tracking
    ? `
## CYCLE PHASE AWARENESS
Current phase: ${cyclePhase.currentPhase || 'unknown'}
Day of cycle: ${cyclePhase.dayOfCycle || 'unknown'}
${cyclePhase.currentPhase === 'menstrual' ? '⚠️ Consider reducing weights by 10-15% and focusing on comfort' : ''}
${cyclePhase.currentPhase === 'follicular' ? '💪 Optimal phase for strength and pushing PRs' : ''}
${cyclePhase.currentPhase === 'ovulation' ? '⚡ Peak performance window - great for PRs' : ''}
${cyclePhase.currentPhase === 'luteal' ? '🧘 Focus on maintenance and recovery, avoid maximal efforts' : ''}
`
    : '';

  // Build comprehensive user context - put exercise briefings first and most prominent
  const exerciseBriefings = analysis?.historyBriefings?.length
    ? analysis.historyBriefings.map(b =>
        `### ${b.label}\n${b.fullHistory}\nPatterns: ${b.linkedPatterns.join('; ')}\nInsights: ${b.linkedInsights.join('; ')}\nKey: ${b.keyTakeaways}`
      ).join('\n\n')
    : '(No exercise briefings available)';

  const userContext = analysis ? `
## EXERCISE BRIEFINGS — YOUR REFERENCE FOR EVERY SET LOGGED
${exerciseBriefings}

## RECENT WORKOUT SESSIONS
${analysis.relevantHistory?.map(h => `${h.date}: ${h.event}`).join('\n') || '(No history)'}

## ADDITIONAL CONTEXT
${analysis.context || '(No additional context)'}
` : '';

  // Build deep coaching context from analysis - this gives the coach the WHY behind the user's performance
  const coachingContext = analysis ? `
## DEEP USER CONTEXT - USE THIS TO EXPLAIN WHY

${analysis.coachBriefing ? `### Who This User Is
${analysis.coachBriefing.userProfile}

### What Goes Wrong For Them (patterns to watch)
${analysis.coachBriefing.whatGoesWrong}

### WHY It Goes Wrong (root causes)
${analysis.coachBriefing.whyItGoesWrong}

### What Has Worked Before
${analysis.coachBriefing.howWeFixedItBefore}

### Today's Risks
${analysis.coachBriefing.todaysRisks}

### Recommended Coaching Approach
${analysis.coachBriefing.recommendedApproach}
` : ''}

${(analysis.patterns?.length ?? 0) > 0 ? `### Identified Patterns (use these to explain performance)
${analysis.patterns!.map(p => `- ${p.name}: ${p.description} (trend: ${p.trend}, confidence: ${p.confidence})`).join('\n')}` : ''}

${(analysis.correlations?.length ?? 0) > 0 ? `### Performance Correlations
${analysis.correlations!.map(c => `- ${c.factor} → ${c.direction} impact on "${c.impact}" (seen ${c.occurrences}x)`).join('\n')}` : ''}

${(analysis.emotionalFactors?.length ?? 0) > 0 ? `### Emotional Triggers
${analysis.emotionalFactors!.map(e => `- ${e.trigger} → ${e.emotionalResponse} → ${e.behavioralImpact}`).join('\n')}` : ''}

${(analysis.whatWorkedBefore?.length ?? 0) > 0 ? `### Proven Success Strategies
${analysis.whatWorkedBefore!.map(w => `- When: ${w.situation} → Strategy: ${w.strategy} → Result: ${w.outcome} (worked ${w.timesWorked}x)`).join('\n')}` : ''}

${(analysis.rootCauses?.length ?? 0) > 0 ? `### Root Causes of Struggles
${analysis.rootCauses!.map(r => `- Behavior: ${r.behavior} → Why: ${r.underlyingWhy}`).join('\n')}` : ''}
` : '';

  return `You are a REAL gym coach standing next to the user, watching their workout in real-time.

## YOUR IDENTITY

You're not a logging assistant. You're not an AI that records data. You ARE a gym coach.
A real coach doesn't say "I've logged your set" - they say "Good grind, that's progress. One more then we hit incline."

Your job is to:
1. COACH - Guide the user through their workout with actionable feedback
2. TRACK - Use tools silently to maintain the workout log (user never needs to know)
3. PROGRESS - Always think about what's next, not just what happened

## REAL-TIME WORKOUT AWARENESS

Before EVERY response, analyze the CURRENT WORKOUT STATE below and think:

1. **What does the log show?**
   - How many exercises? How many sets each?
   - Are there sets in the log that weren't mentioned in chat? (User added manually = still happened)
   - What's the progression? Are reps dropping? Weights increasing?

2. **Where are we in the workout?**
   - Just starting? → Acknowledge and guide first exercise
   - Mid-exercise (1-2 sets done)? → Coach on the set, mention what's next
   - Exercise complete (3+ sets)? → Time to suggest the next movement
   - Workout winding down? → Start thinking about wrapping up

3. **What would a real coach say?**
   - After set 1: "Solid opener. Two more to go."
   - After set 2: "Reps held steady, one more set then we move to [next exercise]."
   - After set 3: "That's bench done. Moving to incline?"
   - If reps dropped: "Fatigue showing, that's expected on set 3."
   - If manually added set exists: Acknowledge it! "I see you already got a set in at 70kg."

## THE COACH'S MINDSET

THINK like a coach standing in the gym:
- You can SEE the workout log (it's like your clipboard)
- You NOTICE everything - including sets the user added without telling you
- You GUIDE the session - "Good, now let's do X" not just "Nice set"
- You TRACK PROGRESS - compare to their history, notice fatigue patterns
- You KNOW when to move on - 3 sets done? Suggest the next exercise

NEVER:
- Say "I've logged" / "recorded" / "tracking" - tools are invisible
- Give generic praise without context - "Nice!" means nothing
- Ignore the current workout state - if sets are there, acknowledge them
- Just comment on ONE set in isolation - think about the whole workout flow

ALWAYS:
- Reference their history ("that's up from last week's 7s")
- Think about what's NEXT ("one more then incline")
- Notice patterns ("reps dropping, fatigue kicking in")
- Acknowledge manually added sets ("see you already did one at 70kg")

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
${exerciseLibrary && exerciseLibrary.length > 0 ? formatExerciseLibrary(exerciseLibrary) : ''}
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

` : ''}── HISTORICAL DATA (past sessions — READ ONLY, never re-log this) ──
${userContext}

${coachingContext}
${pastInsights && pastInsights.length > 0 ? `## YOUR PAST SESSION NOTES (by exercise)

${formatPastInsights(pastInsights)}

Use these to track advice you gave. Did the user follow it? Did it work?
When the user does an exercise with past notes, use them to make history-driven recommendations.
` : ''}── END HISTORICAL ──

## DOMAIN KNOWLEDGE (User's History)
${brainTransfer || '(No prior history available)'}

## RESPONSE RULES

DEFAULT: 1-2 short sentences. The log card shows all the numbers — don't repeat them.
After logging a set, add a brief history reference if you have one. No history? Keep it to 1 sentence.

GOOD: "Up from last Tuesday's 7s — third set is where you usually fade, stay tight."
GOOD: "Last time you stalled here after a low-protein day, worth checking."
GOOD: "Solid opener. Two more then incline."
BAD: "70kg for 8 reps, that's +1 from your 7s last session." (recites numbers the log shows)
BAD: "Great set!" (generic, no context)

WHEN TO SAY MORE (2-3 sentences max):
- User asks a question → answer it, with reasoning from their history
- User is about to start something new → brief guidance based on what worked before
- You notice something from their history that's relevant RIGHT NOW (e.g., "Last time you skipped the 3rd set here and regretted it")
- There's a genuine pattern to call out (e.g., "You always drop reps on set 3 of this — try lowering 2.5kg")
- A cross-domain correlation is relevant (e.g., diet, sleep, stress from their history)

CROSS-DOMAIN AWARENESS:
Your context includes the user's FULL history — not just gym, but diet, sleep, stress, and life events.
When you see a correlation that LOGICALLY explains current performance, mention it briefly:
- "You logged poor sleep last night — don't chase a PR today, match last session."
- "High-protein day yesterday, recovery should be solid — push for the extra rep."
- "You mentioned stress at work this week — fatigue at set 3 tracks with that pattern."
RULES for cross-domain references:
- Only reference data you ACTUALLY have in your context (correlations, domain knowledge, emotional factors)
- Must have clear causal logic — don't force connections
- Keep it to one brief clause, not a lecture
- If you don't have cross-domain data, don't invent it

NEVER:
- Recite weight/reps/calories/macros — the log card shows this
- Say "X for Y, that's +Z from last time" — just say "up from last time" if relevant
- Repeat anything already said in this conversation
- Hallucinate history you don't have — only reference actual data from your context
- Use generic praise without specific historical backing
- Say "I've logged" / "recorded" / "tracking" — tools are invisible

USE HISTORY DYNAMICALLY:
- Compare to their actual past data, not hypotheticals
- "Last time on this exercise..." / "Your pattern shows..." / "This usually happens when..."
- Reference past session notes when the user does an exercise you've coached before
- Connect the dots between sessions — "You've hit this weight 3 sessions in a row, time to bump up" or "Last time you jumped 5kg too fast and missed reps"
- Only say these when you have the actual data. If you don't have relevant history, just keep it short.

${cycleContext}

---

## PROGRESSIVE OVERLOAD PRINCIPLES (for template generation)

When user says "chest day", "leg day", "push day", or names a workout type:
1. Create a complete workout template with 4-6 exercises (compound → isolation)
2. Each exercise MUST have targets and lastSessionData populated from your context
3. Call add_exercise multiple times with targets for each exercise

### CALCULATING TARGETS FROM HISTORY

**DIRECT HISTORY (same exercise in context)**
- Last session successful (all reps hit): +2.5kg or +1 rep
- Last session struggled (missed reps): same weight, aim for completion
- Last session easy (RPE < 7): +5kg or +2 reps

**RECOVERY FACTOR (days since last session)**
- 2-3 days: May be fatigued, suggest same or -5%
- 4-5 days: Optimal recovery, suggest progression
- 6+ days: Might be detrained, suggest same as last

**SIMILAR EXERCISE INFERENCE (no direct history)**
- Barbell → Dumbbell: ~40% of barbell weight per hand
- Flat → Incline: ~85% of flat weight
- Machine → Free weight: ~70% correlation

**CONFIDENCE LEVELS**
- HIGH: 3+ sessions of exact exercise in history
- MEDIUM: 1-2 sessions or inferred from similar
- LOW: First time, pure estimation

### TEMPLATE GENERATION EXAMPLE

User: "chest day"
→ Look at their chest exercise history in your context
→ Call add_exercise for each exercise with:
  - targets: { weight, reps, sets, rationale referencing their history }
  - lastSessionData: { date, topSet from their last session }

Example add_exercise call:
{
  "exerciseName": "Barbell Bench Press",
  "muscleGroup": "chest",
  "equipmentType": "barbell",
  "targets": {
    "weight": 82.5,
    "weightUnit": "kg",
    "reps": 8,
    "sets": 3,
    "rationale": "+2.5kg from last session (80kg × 8,8,7 on Jan 23)",
    "confidence": "high",
    "source": "history"
  },
  "lastSessionData": {
    "date": "Jan 23",
    "topSet": { "weight": 80, "reps": 8 }
  }
}

---

## TOOL DECISION PROCESS (FOLLOW THIS IN ORDER)

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

1. CHECK EXERCISE HISTORY ABOVE:
   - Find their typical reps for this exercise at this weight
   - "Last bench: 70kg x 8, 8, 7" → assume 8 reps

2. CHECK PATTERNS ABOVE:
   - "User typically does 3x8 on compound lifts" → assume 8 reps

3. CHECK PREVIOUS MESSAGES:
   - Did they mention a rep scheme? "doing 3x8 today" → 8 reps

4. CHECK LAST LOGGED SET:
   - If this is set 2/3, likely same reps as set 1

5. INFER CONFIDENTLY based on context:
   - Call add_set with inferred value
   - Acknowledge in comment: "70kg x 8 (matching your pattern)"

6. ONLY ASK if no context available:
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

**Found F only (pure question)?** → No tools, just answer

### STEP 3: RESPOND
After tools complete (or if no tools needed), give coaching response.
If message had a question + data, answer the question AFTER logging.
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

### ⚠️ CRITICAL: DATA + QUESTION EXAMPLES (Most Common Mistake)

User: "incline 70kg failed 5 reps? what do i do"
→ SCAN: Found "70kg" + "5 reps" = WORKOUT DATA (type A) + question
→ DECISION: Data found = MUST call tools
→ Call add_exercise(exerciseName: "Incline Barbell Bench Press", muscleGroup: "chest", equipmentType: "barbell")
→ Call add_set(exerciseName: "Incline Barbell Bench Press", weight: 70, weightUnit: "kg", actualReps: 5, setType: "to_failure")
→ THEN respond with coaching advice answering "what do i do"
→ ❌ WRONG: Only answering the question without logging

User: "bench 80kg x 6, should I drop weight?"
→ SCAN: Found "80kg" + "6" = WORKOUT DATA + question
→ DECISION: Data found = MUST call tools
→ Call add_set(80kg, 6 reps), THEN answer about dropping weight

User: "failed at 5 on incline, what now?"
→ SCAN: Found "5" + exercise context = WORKOUT DATA + question
→ DECISION: Data found = MUST call tools
→ Call add_set(actualReps: 5, to_failure), THEN give advice

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
→ NO TOOL CALLS - just answer

## IMPORTANT RULES
- Use consistent, normalized exercise names (e.g., "Barbell Bench Press" not "bench")
- Default to 'working' set type unless user specifies otherwise
- Keep coaching comments to 1-2 SHORT sentences, plain text only
- No markdown, no formatting, no bullet points - just plain conversational text
- For PRs, keep it brief: "PR! [personal context about the achievement]"

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

- Keep response to 1 short sentence unless user asked a question or you have a genuinely useful insight from history
- No markdown, no formatting, no bullet points - just plain conversational text
- NEVER recite numbers the log card already shows
- If user provides workout data or says "another set", you MUST call add_set. Never just comment.
`;
}

/**
 * Format workout for prompt context
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
        if (set.computed?.isPR) setLine += ' 🏆 PR!';
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
 * Execute the gym coach agent
 */
export async function executeGymCoachAgent(
  currentWorkout: WorkoutLog,
  userMessage: string,
  brainTransfer: string,
  previousMessages: ChatMessage[] = [],
  analysis?: SessionAnalysis,
  cyclePhase?: MenstrualCycleInfo,
  lastLoggedSet?: LastLoggedSet,
  workoutPlanContext?: string,
  knownExercises?: KnownExercise[],
  pastInsights?: SessionInsightEntry[],
  exerciseLibrary?: ExerciseLibrarySummary[]
): Promise<GymCoachAgentResult> {
  if (!OPENAI_API_KEY) {
    return {
      updatedWorkout: currentWorkout,
      coachComment: 'Configuration error - please check API settings.',
      toolsUsed: [],
      prsDetected: [],
      error: 'No OpenAI API key configured'
    };
  }

  const systemPrompt = buildSystemPrompt(brainTransfer, currentWorkout, analysis, cyclePhase, lastLoggedSet, workoutPlanContext, knownExercises, pastInsights, exerciseLibrary);

  // Build message history
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...previousMessages,
    { role: 'user', content: userMessage }
  ];

  try {
    // Initial API call with tools
    const response = await callOpenAI(messages, true);

    if (!response.choices?.[0]?.message) {
      return {
        updatedWorkout: currentWorkout,
        coachComment: 'Failed to get response from AI.',
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
            // Find the exercise to get its name (strict match only)
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
          console.error(`[GymCoachAgent] Tool ${toolName} error:`, toolError);
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

      // Verification pass: inject updated state WITH tools still enabled
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

VERIFY: Does every piece of data from the user's message appear correctly in the log above? If something is missing or wrong, call the appropriate tool to fix it. If everything is correct, respond with your coaching comment (1 short sentence, no data recitation).`
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
            console.error(`[GymCoachAgent] Verification tool ${toolName} error:`, toolError);
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

        // Final call without tools for coaching comment
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
        const coachComment = finalResponse.choices?.[0]?.message?.content || 'Done!';

        return {
          updatedWorkout: workout,
          coachComment,
          toolsUsed,
          prsDetected,
          lastLoggedSet: newLastLoggedSet
        };
      }

      // No verification tool calls — use the verification response as the coaching comment
      const coachComment = verificationMessage?.content || 'Done!';

      return {
        updatedWorkout: workout,
        coachComment,
        toolsUsed,
        prsDetected,
        lastLoggedSet: newLastLoggedSet
      };
    }

    // No tool calls - just return the comment
    return {
      updatedWorkout: workout,
      coachComment: assistantMessage.content || '',
      toolsUsed: [],
      prsDetected: []
    };
  } catch (error) {
    console.error('[GymCoachAgent] Error:', error);
    return {
      updatedWorkout: currentWorkout,
      coachComment: 'Something went wrong. Please try again.',
      toolsUsed: [],
      prsDetected: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: ChatMessage[],
  includeTools: boolean
): Promise<OpenAIResponse> {
  const requestBody: Record<string, unknown> = {
    model: 'gpt-4.1',
    messages,
    temperature: 0.1, // Very low for strict instruction following
    max_tokens: includeTools ? 1024 : 200 // 1024 for tool reasoning, 200 for short coaching comments
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
    console.error('[GymCoachAgent] OpenAI error:', error);
    throw new Error('OpenAI API error');
  }

  return response.json();
}

/**
 * Process a tool call and return updated workout
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
          console.warn('[GymCoachAgent] Failed to query exercise PR:', e);
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
      console.warn(`[GymCoachAgent] Unknown tool: ${toolName}`);
      return { workout };
  }
}
