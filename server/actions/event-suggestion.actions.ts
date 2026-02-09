'use server';

/**
 * Event Suggestion Server Actions
 *
 * Provides real-time LLM-powered coaching suggestions after each event is logged.
 * Uses specialized prompts based on tracker type (diet, gym, addiction, general).
 *
 * For diet/gym trackers: Returns both masterSummary and comment
 * For addiction/general: Returns comment only
 */

import { requireUser } from '@/server/auth';
import type {
  TrackerType,
  MenstrualCycleInfo,
  SessionAnalysis,
  WorkoutLog,
  DietLog,
} from '@/lib/sessions/types';
import {
  getEventCoachPrompt,
  hasMasterSummary,
} from '@/server/prompts/tracker-prompts';
import { executeGymTracker, type LastLoggedSet } from '@/server/agents/gym-tracker-agent';
import { executeDietTracker, type LastLoggedFood } from '@/server/agents/diet-tracker-agent';
import { getKnownExercises } from '@/server/actions/exercise-library.actions';
import type { PRSummary } from '@/lib/sessions/types';

/**
 * Format the enhanced context from session analysis for coach prompts
 * This extracts the detailed briefing and structured data for personalized coaching
 */
function formatEnhancedContext(analysis?: SessionAnalysis): {
  coachBriefing: string;
  patternSummary: string;
  whatWorkedBefore: string;
  emotionalFactors: string;
  rootCauses: string;
} {
  if (!analysis) {
    return {
      coachBriefing: '(No detailed briefing available yet - this is a new user)',
      patternSummary: '(No patterns identified yet)',
      whatWorkedBefore: '(No prior success strategies recorded)',
      emotionalFactors: '(No emotional patterns observed)',
      rootCauses: '(No root cause analysis available)',
    };
  }

  // THE DETAILED BRIEFING - this is the main context for the coach
  const briefing = analysis.coachBriefing;
  const coachBriefing = briefing ? `
## USER PROFILE
${briefing.userProfile}

## WHAT GOES WRONG WITH THIS USER
${briefing.whatGoesWrong}

## WHY IT GOES WRONG (Root Causes)
${briefing.whyItGoesWrong}

## HOW WE FIXED IT BEFORE (Success Strategies)
${briefing.howWeFixedItBefore}

## TODAY'S RISKS TO WATCH
${briefing.todaysRisks}

## HOW TO APPROACH THIS USER
${briefing.recommendedApproach}
` : '(No detailed briefing available)';

  // Also keep structured data for quick reference
  const patternSummary = analysis.patterns
    ?.map(p => `- ${p.name} (${p.trend}): ${p.description}`)
    .join('\n') || '(No patterns)';

  const whatWorkedBefore = analysis.whatWorkedBefore
    ?.map(w => `- When "${w.situation}": ${w.strategy} → ${w.outcome} (worked ${w.timesWorked}x)`)
    .join('\n') || '(No prior successes recorded)';

  const emotionalFactors = analysis.emotionalFactors
    ?.map(e => `- ${e.trigger} → ${e.emotionalResponse} → ${e.behavioralImpact} (${e.frequency}x)`)
    .join('\n') || '(No emotional patterns)';

  const rootCauses = analysis.rootCauses
    ?.map(r => `- ${r.behavior} BECAUSE: ${r.underlyingWhy}`)
    .join('\n') || '(No root causes analyzed)';

  return { coachBriefing, patternSummary, whatWorkedBefore, emotionalFactors, rootCauses };
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// JSON SCHEMAS FOR OPENAI STRICT MODE
// ============================================================================

// Enum definitions for reuse
const WEIGHT_UNIT_ENUM = ['kg', 'lbs'];
const EQUIPMENT_TYPE_ENUM = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'resistance_band', 'smith_machine', 'ez_bar', 'trap_bar', 'other'
];
const MUSCLE_GROUP_ENUM = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats', 'full_body',
  'upper_chest', 'mid_chest', 'lower_chest',
  'upper_traps', 'mid_traps', 'lower_traps', 'rhomboids', 'teres_major', 'spinal_erectors',
  'front_delts', 'side_delts', 'rear_delts',
  'biceps_long_head', 'biceps_short_head', 'brachialis',
  'triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head',
  'forearm_flexors', 'forearm_extensors', 'brachioradialis',
  'glute_max', 'glute_medius', 'glute_minimus',
  'rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius',
  'biceps_femoris', 'semitendinosus', 'semimembranosus',
  'adductors', 'adductor_longus', 'adductor_magnus', 'adductor_brevis', 'gracilis',
  'gastrocnemius', 'soleus', 'tibialis_anterior',
  'upper_abs', 'lower_abs', 'transverse_abdominis',
];
const SET_TYPE_ENUM = [
  'warmup', 'working', 'top', 'backoff', 'dropset', 'superset',
  'rest_pause', 'to_failure', 'forced_reps', 'myo_reps', 'cluster', 'amrap'
];
const LATERALITY_ENUM = ['bilateral', 'unilateral_left', 'unilateral_right', 'alternating'];
const MEAL_TYPE_ENUM = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
  'dinner', 'evening_snack', 'pre_workout', 'post_workout', 'other'
];
const FOOD_SOURCE_ENUM = ['homemade', 'restaurant', 'fast_food', 'packaged', 'meal_prep', 'other'];
const SERVING_UNIT_ENUM = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'serving', 'scoop'];

// Helper to create nullable type for OpenAI strict mode
const nullable = (schema: Record<string, unknown>) => ({
  anyOf: [schema, { type: 'null' }]
});

// Workout Set Schema
const WORKOUT_SET_SCHEMA = {
  type: 'object',
  properties: {
    setNumber: { type: 'integer' },
    setType: { type: 'string', enum: SET_TYPE_ENUM },
    targetReps: nullable({ type: 'integer' }),
    actualReps: { type: 'integer' },
    weight: { type: 'number' },
    weightUnit: { type: 'string', enum: WEIGHT_UNIT_ENUM },
    equipmentType: { type: 'string', enum: EQUIPMENT_TYPE_ENUM },
    laterality: { type: 'string', enum: LATERALITY_ENUM },
    rpe: nullable({ type: 'number' }),
    rir: nullable({ type: 'integer' }),
    restAfterSeconds: nullable({ type: 'integer' }),
    notes: nullable({ type: 'string' }),
  },
  required: [
    'setNumber', 'setType', 'targetReps', 'actualReps', 'weight',
    'weightUnit', 'equipmentType', 'laterality', 'rpe', 'rir',
    'restAfterSeconds', 'notes'
  ],
  additionalProperties: false,
};

// Exercise Entry Schema
const EXERCISE_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    exerciseName: { type: 'string' },
    muscleGroup: { type: 'string', enum: MUSCLE_GROUP_ENUM },
    secondaryMuscles: nullable({ type: 'array', items: { type: 'string', enum: MUSCLE_GROUP_ENUM } }),
    equipmentType: { type: 'string', enum: EQUIPMENT_TYPE_ENUM },
    sets: { type: 'array', items: WORKOUT_SET_SCHEMA },
    notes: nullable({ type: 'string' }),
    orderIndex: { type: 'integer' },
  },
  required: ['id', 'exerciseName', 'muscleGroup', 'secondaryMuscles', 'equipmentType', 'sets', 'notes', 'orderIndex'],
  additionalProperties: false,
};

// Workout Day Summary Schema
const WORKOUT_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    totalExercises: { type: 'integer' },
    totalSets: { type: 'integer' },
    totalReps: { type: 'integer' },
    totalVolume: { type: 'number' },
    totalVolumeUnit: { type: 'string', enum: WEIGHT_UNIT_ENUM },
    muscleGroupsWorked: { type: 'array', items: { type: 'string', enum: MUSCLE_GROUP_ENUM } },
    prCount: { type: 'integer' },
  },
  required: ['totalExercises', 'totalSets', 'totalReps', 'totalVolume', 'totalVolumeUnit', 'muscleGroupsWorked', 'prCount'],
  additionalProperties: false,
};

// Full Workout Log Schema
const WORKOUT_LOG_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    date: { type: 'string' },
    workoutName: nullable({ type: 'string' }),
    muscleGroups: { type: 'array', items: { type: 'string', enum: MUSCLE_GROUP_ENUM } },
    exercises: { type: 'array', items: EXERCISE_ENTRY_SCHEMA },
    summary: WORKOUT_SUMMARY_SCHEMA,
    preferredUnit: { type: 'string', enum: WEIGHT_UNIT_ENUM },
    notes: nullable({ type: 'string' }),
    workoutRating: nullable({ type: 'integer' }),
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: [
    'id', 'date', 'workoutName', 'muscleGroups', 'exercises', 'summary',
    'preferredUnit', 'notes', 'workoutRating', 'createdAt', 'updatedAt'
  ],
  additionalProperties: false,
};

// Macros Schema
const MACROS_SCHEMA = {
  type: 'object',
  properties: {
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
  },
  required: ['calories', 'protein', 'carbs', 'fat'],
  additionalProperties: false,
};

// Food Item Schema
const FOOD_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    brand: nullable({ type: 'string' }),
    source: { type: 'string', enum: FOOD_SOURCE_ENUM },
    servingSize: { type: 'number' },
    servingUnit: { type: 'string', enum: SERVING_UNIT_ENUM },
    macros: MACROS_SCHEMA,
    fiber: nullable({ type: 'number' }),
    sugar: nullable({ type: 'number' }),
    sodium: nullable({ type: 'number' }),
    notes: nullable({ type: 'string' }),
    loggedAt: { type: 'string' },
  },
  required: [
    'id', 'name', 'brand', 'source', 'servingSize', 'servingUnit',
    'macros', 'fiber', 'sugar', 'sodium', 'notes', 'loggedAt'
  ],
  additionalProperties: false,
};

// Meal Entry Schema
const MEAL_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    mealType: { type: 'string', enum: MEAL_TYPE_ENUM },
    time: nullable({ type: 'string' }),
    foods: { type: 'array', items: FOOD_ITEM_SCHEMA },
    totalMacros: MACROS_SCHEMA,
    notes: nullable({ type: 'string' }),
    orderIndex: { type: 'integer' },
  },
  required: ['id', 'mealType', 'time', 'foods', 'totalMacros', 'notes', 'orderIndex'],
  additionalProperties: false,
};

// Daily Targets Schema
const DAILY_TARGETS_SCHEMA = {
  type: 'object',
  properties: {
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: nullable({ type: 'number' }),
    sugar: nullable({ type: 'number' }),
    sodium: nullable({ type: 'number' }),
  },
  required: ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'],
  additionalProperties: false,
};

// Daily Progress Schema
const DAILY_PROGRESS_SCHEMA = {
  type: 'object',
  properties: {
    consumed: {
      type: 'object',
      properties: {
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        fiber: nullable({ type: 'number' }),
        sugar: nullable({ type: 'number' }),
        sodium: nullable({ type: 'number' }),
      },
      required: ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'],
      additionalProperties: false,
    },
    remaining: MACROS_SCHEMA,
    percentages: {
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
  required: ['consumed', 'remaining', 'percentages'],
  additionalProperties: false,
};

// Diet Day Summary Schema
const DIET_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    totalMeals: { type: 'integer' },
    totalFoods: { type: 'integer' },
    totalMacros: MACROS_SCHEMA,
    totalFiber: nullable({ type: 'number' }),
    totalSugar: nullable({ type: 'number' }),
    totalSodium: nullable({ type: 'number' }),
    targets: DAILY_TARGETS_SCHEMA,
    progress: DAILY_PROGRESS_SCHEMA,
  },
  required: ['totalMeals', 'totalFoods', 'totalMacros', 'totalFiber', 'totalSugar', 'totalSodium', 'targets', 'progress'],
  additionalProperties: false,
};

// Full Diet Log Schema
const DIET_LOG_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    date: { type: 'string' },
    meals: { type: 'array', items: MEAL_ENTRY_SCHEMA },
    targets: DAILY_TARGETS_SCHEMA,
    summary: DIET_SUMMARY_SCHEMA,
    waterIntake: nullable({ type: 'number' }),
    notes: nullable({ type: 'string' }),
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
  required: ['id', 'date', 'meals', 'targets', 'summary', 'waterIntake', 'notes', 'createdAt', 'updatedAt'],
  additionalProperties: false,
};

// Combined response schemas for gym and diet
const GYM_EVENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    workoutLog: WORKOUT_LOG_SCHEMA,
    comment: { type: 'string' },
  },
  required: ['workoutLog', 'comment'],
  additionalProperties: false,
};

const DIET_EVENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    dietLog: DIET_LOG_SCHEMA,
    comment: { type: 'string' },
  },
  required: ['dietLog', 'comment'],
  additionalProperties: false,
};

// Legacy schema for backward compatibility (will be phased out)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LEGACY_EVENT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    masterSummary: { type: 'string' },
    comment: { type: 'string' },
  },
  required: ['masterSummary', 'comment'],
  additionalProperties: false,
};

// Helper to create an empty workout log with default values
function createEmptyWorkoutLog(): WorkoutLog {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  return {
    id: `workout_${Date.now()}`,
    date: today,
    muscleGroups: [],
    exercises: [],
    summary: {
      totalExercises: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalVolumeUnit: 'lbs',
      muscleGroupsWorked: [],
      prCount: 0
    },
    preferredUnit: 'lbs',
    createdAt: now,
    updatedAt: now
  };
}

// Helper to format current workout log for prompt context
function formatWorkoutLogForPrompt(log?: WorkoutLog): string {
  if (!log || log.exercises.length === 0) {
    return '(No exercises logged yet today)';
  }

  const lines: string[] = [];
  lines.push(`Date: ${log.date}`);
  if (log.workoutName) lines.push(`Workout: ${log.workoutName}`);
  lines.push(`Muscle groups: ${log.muscleGroups.join(', ')}`);
  lines.push('');

  for (const ex of log.exercises) {
    lines.push(`${ex.exerciseName} (${ex.muscleGroup}, ${ex.equipmentType}):`);
    for (const set of ex.sets) {
      const setInfo = `  Set ${set.setNumber}: ${set.actualReps} reps @ ${set.weight}${set.weightUnit}`;
      const notes = [set.setType !== 'working' ? set.setType : '', set.notes].filter(Boolean).join(', ');
      lines.push(notes ? `${setInfo} [${notes}]` : setInfo);
    }
  }

  lines.push('');
  lines.push(`Summary: ${log.summary.totalExercises} exercises, ${log.summary.totalSets} sets, ${log.summary.totalReps} reps, ${log.summary.totalVolume}${log.summary.totalVolumeUnit} volume`);

  return lines.join('\n');
}

// Helper to format current diet log for prompt context - returns ACTUAL JSON so LLM can merge properly
function formatDietLogForPrompt(log?: DietLog): string {
  if (!log || log.meals.length === 0) {
    return '(No meals logged yet today - start fresh)';
  }

  // Return the ACTUAL JSON so LLM can properly add to existing meals
  // This is critical - without the actual structure, LLM cannot merge properly
  return `EXISTING DATA (you MUST preserve and add to this):
${JSON.stringify(log, null, 2)}

SUMMARY: ${log.meals.length} meals, ${log.summary.progress.consumed.calories} cal, ${log.summary.progress.consumed.protein}g protein consumed so far.`;
}

interface PreviousEvent {
  content: string;
  createdAt: string;
  llmComment?: string;
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

export interface EventSuggestionResult {
  comment: string;
  masterSummary?: string;  // Legacy - will be phased out
  workoutLog?: WorkoutLog;
  dietLog?: DietLog;
  // JSON serialized versions (to work around Next.js Server Action serialization)
  workoutLogJson?: string;
  dietLogJson?: string;
  // PRs detected during this event (for gym tracker celebration)
  prsDetected?: PRSummary[];
  // Last logged set for "another set" context continuity
  lastLoggedSet?: LastLoggedSet;
  // Last logged food for "another one" context continuity
  lastLoggedFood?: LastLoggedFood;
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
 * @param trackerType - Specialized tracker type (diet, gym, addiction, general)
 * @param currentMasterSummary - Current master summary (for diet/gym trackers) - LEGACY
 * @param todaysEvents - All events from today (optional)
 * @param yesterdaysReview - Yesterday's review summary (optional)
 * @param todaysPlan - Today's daily plan with focus areas and targets (optional)
 * @param cyclePhase - Menstrual cycle phase info for female users (optional)
 * @param analysis - Session analysis with detailed briefing, patterns, and root causes (optional)
 * @param currentWorkoutLog - Current structured workout log (for gym tracker)
 * @param currentDietLog - Current structured diet log (for diet tracker)
 * @returns The suggestion with comment and structured log data, or an error
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
  trackerType: TrackerType = 'general',
  currentMasterSummary?: string,
  todaysEvents?: TodayEvent[],
  yesterdaysReview?: YesterdaysReview,
  todaysPlan?: TodaysPlan,
  cyclePhase?: MenstrualCycleInfo,
  analysis?: SessionAnalysis,
  currentWorkoutLog?: WorkoutLog,
  currentDietLog?: DietLog,
  lastLoggedSet?: LastLoggedSet,
  lastLoggedFood?: LastLoggedFood,
  workoutPlanContext?: string,
  dietHistoryContext?: string,
  dayPlanContext?: string
): Promise<EventSuggestionResult | { error: string }> {
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
            entry += `\n   → Coach: ${e.llmComment}`;
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

  // Format menstrual cycle phase section (if tracking)
  const cyclePhaseSection = formatCyclePhaseSection(cyclePhase);

  // Format enhanced context from analysis (coach briefing, patterns, what worked, etc.)
  const { coachBriefing, patternSummary, whatWorkedBefore, emotionalFactors, rootCauses } =
    formatEnhancedContext(analysis);

  // Format current structured log for context
  const currentLogContext = trackerType === 'gym'
    ? formatWorkoutLogForPrompt(currentWorkoutLog)
    : trackerType === 'diet'
      ? formatDietLogForPrompt(currentDietLog)
      : '(No structured log)';

  // Get the appropriate prompt for this tracker type
  const basePrompt = getEventCoachPrompt(trackerType);

  // Build the prompt by replacing placeholders
  const prompt = basePrompt
    .replace('{{guide}}', guide || 'Session Coach')
    .replace('{{goal}}', sessionGoal || 'Make progress on current goals')
    .replace('{{keyContext}}', keyContext || '(No historical context available)')
    .replace('{{cyclePhaseSection}}', cyclePhaseSection)
    .replace('{{todaysPlanSection}}', todaysPlanSection)
    .replace('{{todaysEventsSection}}', todaysEventsSection)
    .replace('{{yesterdaysReviewSection}}', yesterdaysReviewSection)
    .replace('{{previousEvents}}', formattedPreviousEvents)
    .replace('{{newEvent}}', eventContent)
    .replace('{{currentMasterSummary}}', currentMasterSummary || '(No previous entries)')
    .replace('{{currentLog}}', currentLogContext)
    .replace('{{currentWorkoutLog}}', formatWorkoutLogForPrompt(currentWorkoutLog))
    .replace('{{currentDietLog}}', formatDietLogForPrompt(currentDietLog))
    // Enhanced context from analysis
    .replace('{{coachBriefing}}', coachBriefing)
    .replace('{{patternSummary}}', patternSummary)
    .replace('{{whatWorkedBefore}}', whatWorkedBefore)
    .replace('{{emotionalFactors}}', emotionalFactors)
    .replace('{{rootCauses}}', rootCauses);

  try {
    // =====================================================================
    // GYM TRACKER: Use tracker agent for real-time workout data parsing
    // =====================================================================
    if (trackerType === 'gym') {
      console.log('[generateEventSuggestion] Using gym tracker agent');

      // Create empty workout log if none exists
      const workoutLog: WorkoutLog = currentWorkoutLog || createEmptyWorkoutLog();

      // Fetch user's known exercises for exercise matching
      let knownExercises;
      try {
        knownExercises = await getKnownExercises();
        console.log('[generateEventSuggestion] Known exercises:', knownExercises.length);
      } catch (e) {
        console.warn('[generateEventSuggestion] Failed to fetch known exercises:', e);
      }

      // Build previous messages for context (user messages + tracker responses)
      const previousChatMessages: { role: 'user' | 'assistant'; content: string }[] = [];
      for (const e of previousEvents.slice(-10)) {
        previousChatMessages.push({
          role: 'user' as const,
          content: e.content
        });
        if (e.llmComment) {
          previousChatMessages.push({
            role: 'assistant' as const,
            content: e.llmComment
          });
        }
      }

      // Execute the gym tracker agent (no coaching context needed)
      const agentResult = await executeGymTracker(
        workoutLog,
        eventContent,
        previousChatMessages,
        lastLoggedSet,
        workoutPlanContext,
        knownExercises,
      );

      console.log('[generateEventSuggestion] Tracker result:', {
        toolsUsed: agentResult.toolsUsed,
        prsDetected: agentResult.prsDetected.length,
        lastLoggedSet: agentResult.lastLoggedSet,
        trackerResponse: agentResult.trackerResponse,
        error: agentResult.error
      });

      return {
        comment: agentResult.trackerResponse,
        workoutLogJson: JSON.stringify(agentResult.updatedWorkout),
        prsDetected: agentResult.prsDetected,
        lastLoggedSet: agentResult.lastLoggedSet
      };
    }

    // =====================================================================
    // DIET TRACKER: Use tracker agent for real-time diet data parsing
    // =====================================================================
    if (trackerType === 'diet') {
      console.log('[generateEventSuggestion] Using diet tracker agent');

      // Build previous messages for context (user messages + tracker responses)
      const previousChatMessages: { role: 'user' | 'assistant'; content: string }[] = [];
      for (const e of previousEvents.slice(-10)) {
        previousChatMessages.push({
          role: 'user' as const,
          content: e.content
        });
        if (e.llmComment) {
          previousChatMessages.push({
            role: 'assistant' as const,
            content: e.llmComment
          });
        }
      }

      // Execute the diet tracker agent (no coaching context needed)
      const agentResult = await executeDietTracker(
        currentDietLog,
        eventContent,
        previousChatMessages,
        lastLoggedFood,
        dayPlanContext,
      );

      console.log('[generateEventSuggestion] Diet tracker result:', {
        toolsUsed: agentResult.toolsUsed,
        lastLoggedFood: agentResult.lastLoggedFood,
        trackerResponse: agentResult.trackerResponse,
        error: agentResult.error
      });

      return {
        comment: agentResult.trackerResponse,
        dietLogJson: JSON.stringify(agentResult.updatedDietLog),
        lastLoggedFood: agentResult.lastLoggedFood
      };
    }

    // =====================================================================
    // ADDICTION & GENERAL TRACKERS: Use simple OpenAI response
    // =====================================================================
    const requestBody: Record<string, unknown> = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Event: ${eventContent}` },
      ],
      temperature: 0.7,
      max_tokens: hasMasterSummary(trackerType) ? 4000 : 300,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateEventSuggestion] OpenAI error:', error);
      return { error: 'Failed to generate suggestion' };
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content?.trim();
    const refusal = data.choices?.[0]?.message?.refusal;

    console.log('[generateEventSuggestion] Raw response length:', rawResponse?.length);
    console.log('[generateEventSuggestion] Tracker type:', trackerType);

    if (refusal) {
      console.error('[generateEventSuggestion] Model refused:', refusal);
      return { error: 'Model refused to respond' };
    }

    if (!rawResponse) {
      return { error: 'Empty response from AI' };
    }

    // Addiction/General: Use raw response as comment
    return { comment: rawResponse };
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

/**
 * Format menstrual cycle phase section for prompts
 */
function formatCyclePhaseSection(cyclePhase?: MenstrualCycleInfo): string {
  if (!cyclePhase || !cyclePhase.tracking || !cyclePhase.currentPhase) {
    return '';
  }

  const phaseDescriptions: Record<string, string> = {
    menstrual: 'Menstrual phase - energy typically lower, strength may be reduced 10-20%',
    follicular: 'Follicular phase - energy rising, good recovery, optimal for intensity',
    ovulation: 'Ovulation phase - peak performance window, best for PRs and max efforts',
    luteal: 'Luteal phase - higher RPE (weights feel heavier), metabolism +100-300cal, cravings normal',
  };

  const phaseNotes: Record<string, string[]> = {
    menstrual: [
      'Strength typically 10-20% lower - this is normal',
      'Focus on technique over intensity',
      'Iron-rich foods help with energy',
    ],
    follicular: [
      'Good time for progressive overload',
      'Body recovers well - can push intensity',
      'Carbs utilized efficiently',
    ],
    ovulation: [
      'Best window for max attempts and PRs',
      'Peak strength and coordination',
      'Slight metabolism increase',
    ],
    luteal: [
      'Same weights will feel 10-15% harder - hormonal, not weakness',
      'Recovery is slower - maintain, dont push',
      'Cravings are biological - +100-300cal needs',
      'Magnesium helps (dark chocolate, nuts)',
    ],
  };

  const lines = [
    `=== MENSTRUAL CYCLE PHASE ===`,
    `Current: ${cyclePhase.currentPhase.toUpperCase()} (Day ${cyclePhase.dayOfCycle})`,
    phaseDescriptions[cyclePhase.currentPhase] || '',
    '',
    'NOTES:',
    ...(phaseNotes[cyclePhase.currentPhase] || []).map(note => `- ${note}`),
    '',
  ];

  return lines.join('\n');
}
