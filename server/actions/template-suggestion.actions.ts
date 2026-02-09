'use server';

/**
 * Template Suggestion Server Actions
 *
 * Provides AI-powered conversation for template creation:
 * 1. chatWithTemplateCoach - Pure conversation (no tools) for gathering requirements
 * 2. generateTemplateFromChat - Tool-based generation when user is ready
 */

import { requireUser } from '@/server/auth';
import type { WorkoutTemplate, TemplateExercise, MuscleGroup, WorkoutPreferences, PlanDay, SplitType, EquipmentAccess } from '@/lib/sessions/types';
import { getExerciseHistory, getExerciseNames, getRecentWorkouts } from './gym-history.actions';
import { findExerciseById, searchExercises } from '@/lib/gym/exercise-database';
import type { GlobalExercise } from '@/lib/gym/exercise-database';
import {
  TEMPLATE_COACH_TOOLS,
  WORKOUT_PLAN_TOOL,
  type GenerateWorkoutTemplateArgs,
  type GetExerciseSuggestionsArgs,
  type GeneratedExercise,
  type GenerateWorkoutPlanArgs,
} from '@/server/agents/template-coach-tools';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface OpenAIChatMessage {
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
    };
    finish_reason: string;
  }[];
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

function buildConversationPrompt(exerciseHistory: string, recentWorkouts: string): string {
  return `You are a workout template designer helping the user create the perfect workout template.

## YOUR ROLE
You're having a conversation to understand what the user wants. Do NOT generate a template yet - just gather information through friendly conversation.

## WHAT TO ASK ABOUT (one question at a time)
1. **Workout Goal**: Strength, hypertrophy, endurance, or general fitness?
2. **Muscle Groups**: Which muscle groups? (Push, Pull, Legs, Upper, Full Body, specific muscles)
3. **Time Available**: How long do they have? (30 min, 45 min, 60 min, 90 min)
4. **Equipment Access**: Full gym, home gym, minimal equipment, bodyweight only?
5. **Experience Level**: Beginner, intermediate, advanced?
6. **Preferences**: Any exercises they love or want to avoid?

## USER'S EXERCISE HISTORY (use this to personalize suggestions)
${exerciseHistory || '(No exercise history available - this is a new user)'}

## USER'S RECENT WORKOUTS
${recentWorkouts || '(No recent workouts)'}

## COMMUNICATION STYLE
- Be direct and efficient, not overly enthusiastic
- Ask ONE question at a time
- When you have enough info, tell the user they can click "Generate Workout" when ready
- Reference their history when relevant ("I see you've been doing barbell bench - want to include that?")
- If they say something vague like "push day", ask follow-up questions

## IMPORTANT
- Do NOT generate a full exercise list yet
- Do NOT use tools - this is just conversation
- Keep responses short (2-3 sentences max)
- Sound like a real trainer, not an AI assistant`;
}

function buildGenerationPrompt(exerciseHistory: string, recentWorkouts: string, exerciseNames: string[], exerciseCatalog?: string): string {
  return `You are generating a workout template based on the conversation. Use the generate_workout_template tool to create the template.

## USER'S EXERCISE HISTORY (reference this for smart targets)
${exerciseHistory || '(No history - use reasonable defaults)'}

## USER'S RECENT WORKOUTS
${recentWorkouts || '(No recent workouts)'}

## EXERCISES THE USER HAS DONE BEFORE
${exerciseNames.length > 0 ? exerciseNames.join(', ') : '(No prior exercises)'}
${exerciseCatalog ? `
## EXERCISE CATALOG (pick exercises by ID from this list)
${exerciseCatalog}

IMPORTANT: When creating exercises, use the exact name and globalExerciseId from this catalog.
If you need an exercise not in this list, provide the name without a globalExerciseId.
` : ''}
## TEMPLATE DESIGN PRINCIPLES
1. **Exercise Order**: Compound movements first, isolation last
2. **Volume**:
   - Strength: 3-5 sets × 3-6 reps
   - Hypertrophy: 3-4 sets × 8-12 reps
   - Endurance: 2-3 sets × 15-20 reps
3. **Exercise Count**:
   - 30 min: 3-4 exercises
   - 45 min: 4-5 exercises
   - 60 min: 5-6 exercises
   - 90 min: 6-8 exercises
4. **Target Weights**:
   - If user has history, suggest ~90-95% of their last session for progressive overload
   - If no history, omit targetWeight (let them figure it out)

## EXERCISE NAMING
- Always include equipment prefix: "Barbell Bench Press", "Dumbbell Curl", "Cable Fly"
- Use proper capitalization
- Be specific: "Incline Dumbbell Press" not just "incline press"

## RESPONSE FORMAT
1. Call generate_workout_template with the full template
2. After the tool result, give a brief summary of what you created and why`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getExerciseContext(): Promise<{
  exerciseHistory: string;
  recentWorkouts: string;
  exerciseNames: string[];
}> {
  try {
    // Get recent workouts
    const workouts = await getRecentWorkouts(undefined, 5);
    const recentWorkouts = workouts.length > 0
      ? workouts.map(w => {
          const date = new Date(w.date).toLocaleDateString();
          return `${date}: ${w.workoutName || 'Workout'} - ${w.exerciseCount} exercises, ${w.totalSets} sets`;
        }).join('\n')
      : '';

    // Get exercise names for reference
    const exerciseNames = await getExerciseNames();

    // Get history for the most common exercises
    const topExercises = exerciseNames.slice(0, 10);
    const historyParts: string[] = [];

    for (const exerciseName of topExercises) {
      const history = await getExerciseHistory(exerciseName, 3);
      if (history.length > 0) {
        const lastSession = history[0];
        const setsStr = lastSession.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ');
        historyParts.push(`${exerciseName}: ${setsStr} (${new Date(lastSession.date).toLocaleDateString()})`);
      }
    }

    const exerciseHistory = historyParts.join('\n');

    return { exerciseHistory, recentWorkouts, exerciseNames };
  } catch (error) {
    console.error('[TemplateSuggestion] Error fetching exercise context:', error);
    return { exerciseHistory: '', recentWorkouts: '', exerciseNames: [] };
  }
}

async function callOpenAI(
  messages: OpenAIChatMessage[],
  includeTools: boolean
): Promise<OpenAIResponse> {
  const requestBody: Record<string, unknown> = {
    model: 'gpt-4.1',
    messages,
    temperature: 0.7,
    max_tokens: includeTools ? 2500 : 500,
  };

  if (includeTools) {
    requestBody.tools = TEMPLATE_COACH_TOOLS;
    requestBody.tool_choice = { type: 'function', function: { name: 'generate_workout_template' } };
  }

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
    console.error('[TemplateSuggestion] OpenAI error:', error);
    throw new Error('OpenAI API error');
  }

  return response.json();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Chat with the template coach (no tools - pure conversation)
 * Used during the conversation phase to gather requirements
 */
export async function chatWithTemplateCoach(
  userMessage: string,
  previousMessages: ChatMessage[]
): Promise<{ response: string }> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { response: 'API configuration error. Please try again later.' };
  }

  try {
    const { exerciseHistory, recentWorkouts } = await getExerciseContext();
    const systemPrompt = buildConversationPrompt(exerciseHistory, recentWorkouts);

    // Build message history
    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await callOpenAI(messages, false);
    const content = response.choices?.[0]?.message?.content || "Let's talk about your workout goals.";

    return { response: content };
  } catch (error) {
    console.error('[TemplateSuggestion] Chat error:', error);
    return { response: 'Something went wrong. Please try again.' };
  }
}

/**
 * Generate a template from the conversation
 * Called when user clicks "Generate Workout" button
 */
export async function generateTemplateFromChat(
  previousMessages: ChatMessage[]
): Promise<{
  template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> | null;
  summary: string;
  error?: string;
}> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { template: null, summary: '', error: 'API configuration error' };
  }

  try {
    const { exerciseHistory, recentWorkouts, exerciseNames } = await getExerciseContext();
    const systemPrompt = buildGenerationPrompt(exerciseHistory, recentWorkouts, exerciseNames);

    // Build message history with generation instruction
    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      {
        role: 'user',
        content: 'Generate the workout template now based on our conversation. Use the generate_workout_template tool.',
      },
    ];

    const response = await callOpenAI(messages, true);
    const assistantMessage = response.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls?.length) {
      return {
        template: null,
        summary: assistantMessage?.content || 'Failed to generate template',
        error: 'No template generated',
      };
    }

    // Process the tool call
    const toolCall = assistantMessage.tool_calls[0];
    if (toolCall.function.name !== 'generate_workout_template') {
      return { template: null, summary: '', error: 'Unexpected tool call' };
    }

    const args: GenerateWorkoutTemplateArgs = JSON.parse(toolCall.function.arguments);

    // Convert generated exercises to template exercises, resolving against global DB
    const exercises: TemplateExercise[] = args.exercises.map((ex, index) => {
      // Prefer globalExerciseId if LLM provided one
      let resolvedName = ex.exerciseName;
      let resolvedMuscle = ex.muscleGroup;
      let resolvedEquip = ex.equipmentType;
      let resolvedGlobalId = ex.globalExerciseId;
      let registryId: string | undefined;

      if (ex.globalExerciseId) {
        const globalMatch = findExerciseById(ex.globalExerciseId);
        if (globalMatch) {
          resolvedName = globalMatch.name;
          resolvedMuscle = globalMatch.muscleGroup;
          resolvedEquip = globalMatch.equipmentType;
          resolvedGlobalId = globalMatch.id;
          registryId = String(globalMatch.id);
        }
      }

      return {
        id: crypto.randomUUID(),
        exerciseName: resolvedName,
        globalExerciseId: resolvedGlobalId,
        muscleGroup: resolvedMuscle,
        secondaryMuscles: ex.secondaryMuscles,
        equipmentType: resolvedEquip,
        exerciseRegistryId: registryId,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        targetWeightUnit: ex.targetWeightUnit || 'kg',
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        orderIndex: index,
      };
    });

    // Compute muscle groups from exercises
    const muscleGroups = Array.from(
      new Set(exercises.flatMap(e => [e.muscleGroup, ...(e.secondaryMuscles || [])]))
    ) as MuscleGroup[];

    const template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
      name: args.name,
      description: args.description,
      muscleGroups,
      exercises,
    };

    // Get follow-up response from AI
    const toolResult = JSON.stringify({ success: true, exerciseCount: exercises.length });
    const followUpMessages: OpenAIChatMessage[] = [
      ...messages,
      {
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      },
      {
        role: 'tool',
        content: toolResult,
        tool_call_id: toolCall.id,
      },
    ];

    const followUpResponse = await callOpenAI(followUpMessages, false);
    const summary = followUpResponse.choices?.[0]?.message?.content ||
      `Created "${args.name}" with ${exercises.length} exercises.`;

    return { template, summary };
  } catch (error) {
    console.error('[TemplateSuggestion] Generation error:', error);
    return {
      template: null,
      summary: '',
      error: error instanceof Error ? error.message : 'Failed to generate template',
    };
  }
}

/**
 * Get an initial greeting message from the coach
 */
export async function getTemplateCoachGreeting(): Promise<{ greeting: string }> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { greeting: "What type of workout are you planning?" };
  }

  try {
    const { exerciseHistory, recentWorkouts } = await getExerciseContext();

    // If user has history, personalize the greeting
    if (recentWorkouts) {
      const workouts = await getRecentWorkouts(undefined, 1);
      const lastWorkout = workouts[0];
      if (lastWorkout) {
        return {
          greeting: `What type of workout are you planning? Your last session was ${lastWorkout.workoutName || 'a workout'} - looking to build on that or try something different?`,
        };
      }
    }

    return { greeting: "What type of workout are you planning? Tell me about your goals, available time, and any preferences." };
  } catch {
    return { greeting: "What type of workout are you planning?" };
  }
}

// ============================================================================
// WORKOUT PLAN GENERATION
// ============================================================================

function asArray<T>(v: T | T[]): T[] { return Array.isArray(v) ? v : [v]; }

function formatPreferences(prefs: WorkoutPreferences): string {
  const custom = prefs.customDescriptions || {};

  const goalLabels: Record<string, string> = {
    weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain', strength: 'Strength',
    general_fitness: 'General Fitness', endurance: 'Endurance', body_recomp: 'Body Recomposition',
    other: 'Other',
  };
  const expLabels: Record<string, string> = {
    beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
    other: 'Other',
  };
  const equipLabels: Record<string, string> = {
    full_gym: 'Full Gym', home_gym: 'Home Gym', dumbbells_only: 'Dumbbells Only',
    bodyweight: 'Bodyweight', minimal: 'Minimal Equipment', other: 'Other',
  };
  const splitLabels: Record<string, string> = {
    ppl: 'Push/Pull/Legs', upper_lower: 'Upper/Lower', full_body: 'Full Body',
    bro_split: 'Bro Split', push_pull: 'Push/Pull', custom: 'Custom',
  };
  const cardioLabels: Record<string, string> = {
    none: 'None', light: 'Light (warmup only)', moderate: 'Moderate (end of session)',
    heavy: 'Heavy (dedicated days)', other: 'Other',
  };

  // Helper: append custom description when value is 'other' or 'custom'
  const withCustom = (label: string, value: string, customText?: string) => {
    if ((value === 'other' || value === 'custom') && customText) {
      return `${label} — ${customText}`;
    }
    return label;
  };

  const goalArr = asArray(prefs.trainingGoal);
  const goalText = goalArr.map(g => withCustom(goalLabels[g] || g, g, custom.trainingGoal)).join(' + ');
  const equipArr = asArray(prefs.equipmentAccess);
  const equipText = equipArr.map(e => withCustom(equipLabels[e] || e, e, custom.equipmentAccess)).join(' + ');

  const lines = [
    `Goal: ${goalText}`,
    `Experience: ${withCustom(expLabels[prefs.experienceLevel] || prefs.experienceLevel, prefs.experienceLevel, custom.experienceLevel)}`,
    `Equipment: ${equipText}`,
    `Training Days/Week: ${prefs.daysPerWeek}`,
    `Session Duration: ${prefs.sessionDuration} minutes`,
    `Split Type: ${withCustom(splitLabels[prefs.splitType] || prefs.splitType, prefs.splitType, custom.splitType)}`,
    `Cardio: ${withCustom(cardioLabels[prefs.cardioLevel] || prefs.cardioLevel, prefs.cardioLevel, custom.cardioLevel)}`,
  ];

  if (prefs.focusAreas.length > 0) {
    lines.push(`Focus Areas: ${prefs.focusAreas.join(', ')}`);
  }
  if (prefs.deprioritizeAreas.length > 0) {
    lines.push(`Deprioritize: ${prefs.deprioritizeAreas.join(', ')}`);
  }
  if (prefs.injuries) {
    lines.push(`Injuries/Limitations: ${prefs.injuries}`);
  }
  if (prefs.additionalNotes) {
    lines.push(`Additional Notes: ${prefs.additionalNotes}`);
  }

  return lines.join('\n');
}

function buildPlanGenerationPrompt(
  preferences: string,
  exerciseHistory: string,
  recentWorkouts: string
): string {
  return `You are designing a 7-day workout plan rotation. Use the generate_workout_plan tool.

## USER PREFERENCES
${preferences}

## USER'S EXERCISE HISTORY
${exerciseHistory || '(No history available)'}

## USER'S RECENT WORKOUTS
${recentWorkouts || '(No recent workouts)'}

## PLAN DESIGN RULES
1. Generate exactly 7 days (training days + rest days = 7)
2. Place rest days strategically (never 3+ training days in a row for beginners)
3. Respect the user's daysPerWeek for training days, fill the rest with rest/recovery
4. Match the split type to the chosen one
5. If cardio is "heavy", 1-2 days can be cardio-focused
6. If cardio is "moderate", add cardio notes to training days
7. Each training day should target specific muscle groups based on the split
8. Estimate realistic durations based on session time preference
9. Give each day a descriptive name (e.g., "Push - Chest & Shoulders", not just "Day 1")
10. For rest days, suggest active recovery when appropriate
11. Consider focus areas and deprioritize areas in muscle group allocation

Call the generate_workout_plan tool now.`;
}

function buildDayExercisePrompt(
  preferences: string,
  planContext: string,
  dayContext: string,
  exerciseHistory: string,
  exerciseNames: string[],
  exerciseCatalog?: string,
  userInstruction?: string
): string {
  return `You are generating exercises for a specific day in a workout plan. Use the generate_workout_template tool.

## USER PREFERENCES
${preferences}

## FULL PLAN CONTEXT (to avoid exercise overlap between days)
${planContext}

## TODAY'S TARGET
${dayContext}

## USER'S EXERCISE HISTORY
${exerciseHistory || '(No history - use reasonable defaults)'}

## EXERCISES THE USER HAS DONE BEFORE
${exerciseNames.length > 0 ? exerciseNames.join(', ') : '(No prior exercises)'}
${exerciseCatalog ? `
## EXERCISE CATALOG (pick exercises by ID from this list)
${exerciseCatalog}

IMPORTANT: When creating exercises, use the exact name and globalExerciseId from this catalog.
If you need an exercise not in this list, provide the name without a globalExerciseId.
` : ''}${userInstruction ? `
## USER INSTRUCTION (HIGHEST PRIORITY — overrides all other rules)
${userInstruction}

You MUST follow these instructions exactly. If the user specifies particular exercises, generate ONLY those exercises (plus minor variations only if the user says "and similar" or "etc"). If the user says "only X and Y", output exactly X and Y — do NOT add extra exercises to fill time. The exercise count rules below are defaults that the user's instruction overrides.
` : ''}
## EXERCISE DESIGN RULES (defaults — overridden by user instruction above)
1. Compound movements first, isolation last
2. Default exercise count by session duration (SKIP this rule if user specified exact exercises):
   - 30 min: 3-4 exercises
   - 45 min: 4-5 exercises
   - 60 min: 5-6 exercises
   - 90 min: 6-8 exercises
3. Equipment must match available equipment
4. If user has history for an exercise, target ~90-95% of last session
5. If no history, omit targetWeight
6. Include form cues in notes for key exercises
7. Use proper names with equipment prefix ("Barbell Bench Press", not "bench press")
8. Don't repeat exercises that appear on other days in the plan

Call the generate_workout_template tool now.`;
}

/**
 * Generate a workout plan structure from preferences (no exercises yet)
 */
export async function generateWorkoutPlan(
  preferences: WorkoutPreferences
): Promise<{
  plan: {
    name: string;
    description: string;
    splitType: SplitType;
    days: Omit<PlanDay, 'id' | 'exercises' | 'orderIndex'>[];
  } | null;
  error?: string;
}> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { plan: null, error: 'API configuration error' };
  }

  try {
    const { exerciseHistory, recentWorkouts } = await getExerciseContext();
    const prefsText = formatPreferences(preferences);
    const systemPrompt = buildPlanGenerationPrompt(prefsText, exerciseHistory, recentWorkouts);

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the workout plan now.' },
    ];

    const requestBody: Record<string, unknown> = {
      model: 'gpt-4.1',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
      tools: [WORKOUT_PLAN_TOOL],
      tool_choice: { type: 'function', function: { name: 'generate_workout_plan' } },
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
      throw new Error('OpenAI API error');
    }

    const data: OpenAIResponse = await response.json();
    const assistantMessage = data.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls?.length) {
      return { plan: null, error: 'No plan generated' };
    }

    const toolCall = assistantMessage.tool_calls[0];
    if (toolCall.function.name !== 'generate_workout_plan') {
      return { plan: null, error: 'Unexpected tool call' };
    }

    const args: GenerateWorkoutPlanArgs = JSON.parse(toolCall.function.arguments);

    return {
      plan: {
        name: args.name,
        description: args.description,
        splitType: args.splitType as SplitType,
        days: args.days.map((d, i) => ({
          dayNumber: i + 1,
          dayLabel: d.dayLabel,
          name: d.name,
          description: d.description,
          targetMuscles: (d.targetMuscles || []) as MuscleGroup[],
          estimatedDuration: d.estimatedDuration || 0,
          isRestDay: d.isRestDay,
          isCardioDay: d.isCardioDay,
          cardioNotes: d.cardioNotes,
        })),
      },
    };
  } catch (error) {
    console.error('[WorkoutPlan] Generation error:', error);
    return { plan: null, error: error instanceof Error ? error.message : 'Failed to generate plan' };
  }
}

/**
 * Generate exercises for a specific day in a plan
 */
export async function generateDayExercises(
  preferences: WorkoutPreferences,
  allDays: { name: string; targetMuscles: MuscleGroup[]; exercises: { exerciseName: string }[] }[],
  targetDay: { name: string; targetMuscles: MuscleGroup[]; estimatedDuration: number },
  userInstruction?: string
): Promise<{
  exercises: GeneratedExercise[] | null;
  error?: string;
}> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { exercises: null, error: 'API configuration error' };
  }

  try {
    const { exerciseHistory, recentWorkouts, exerciseNames } = await getExerciseContext();
    const prefsText = formatPreferences(preferences);

    const planContext = allDays
      .map((d) => {
        const exStr = d.exercises.length > 0
          ? d.exercises.map((e) => e.exerciseName).join(', ')
          : '(no exercises yet)';
        return `- ${d.name} [${d.targetMuscles.join(', ')}]: ${exStr}`;
      })
      .join('\n');

    const dayContext = `Day: ${targetDay.name}\nTarget Muscles: ${targetDay.targetMuscles.join(', ')}\nDuration: ${targetDay.estimatedDuration} min`;

    // Pre-filter exercises from global DB by target muscle groups
    const catalogExercises: GlobalExercise[] = [];
    const seenIds = new Set<number>();
    for (const mg of targetDay.targetMuscles) {
      const results = searchExercises('', { muscleGroup: mg, limit: 30 });
      for (const ex of results) {
        if (!seenIds.has(ex.id)) {
          seenIds.add(ex.id);
          catalogExercises.push(ex);
        }
      }
    }
    const exerciseCatalog = catalogExercises.length > 0
      ? catalogExercises.map(ex => `${ex.id}: ${ex.name} (${ex.muscleGroup}, ${ex.equipmentType})`).join('\n')
      : undefined;

    const systemPrompt = buildDayExercisePrompt(prefsText, planContext, dayContext, exerciseHistory, exerciseNames, exerciseCatalog, userInstruction);

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate exercises for ${targetDay.name}. Use the generate_workout_template tool.` },
    ];

    const response = await callOpenAI(messages, true);
    const assistantMessage = response.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls?.length) {
      return { exercises: null, error: 'No exercises generated' };
    }

    const toolCall = assistantMessage.tool_calls[0];
    if (toolCall.function.name !== 'generate_workout_template') {
      return { exercises: null, error: 'Unexpected tool call' };
    }

    const args: GenerateWorkoutTemplateArgs = JSON.parse(toolCall.function.arguments);

    // Resolve each exercise — prefer globalExerciseId from LLM, fallback to name search
    const resolvedExercises = args.exercises.map((ex) => {
      if (ex.globalExerciseId) {
        const globalMatch = findExerciseById(ex.globalExerciseId);
        if (globalMatch) {
          return {
            ...ex,
            exerciseName: globalMatch.name,
            muscleGroup: globalMatch.muscleGroup,
            equipmentType: globalMatch.equipmentType,
            globalExerciseId: globalMatch.id,
            exerciseRegistryId: String(globalMatch.id),
          };
        }
      }
      return ex;
    });

    return { exercises: resolvedExercises };
  } catch (error) {
    console.error('[DayExercises] Generation error:', error);
    return { exercises: null, error: error instanceof Error ? error.message : 'Failed to generate exercises' };
  }
}

// ============================================================================
// GENERATE ALL DAY EXERCISES
// ============================================================================

/**
 * Generate exercises for all empty training days in a plan, sequentially.
 * Each day's result is fed into the context for subsequent days to avoid overlap.
 */
export async function generateAllDayExercises(
  preferences: WorkoutPreferences,
  plan: { days: PlanDay[] },
  userInstruction?: string,
  forceAll?: boolean
): Promise<{ dayId: string; exercises: GeneratedExercise[] }[]> {
  await requireUser();

  // Filter to non-rest days — optionally include days that already have exercises
  const targetDays = plan.days
    .filter((d) => !d.isRestDay && (forceAll || d.exercises.length === 0))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (targetDays.length === 0) return [];

  // Build a mutable copy of allDays context that we'll accumulate into
  const allDaysContext = plan.days.map((d) => ({
    name: d.name,
    targetMuscles: d.targetMuscles,
    exercises: d.exercises.map((e) => ({ exerciseName: e.exerciseName })),
  }));

  const results: { dayId: string; exercises: GeneratedExercise[] }[] = [];

  for (const day of targetDays) {
    const { exercises, error } = await generateDayExercises(
      preferences,
      allDaysContext,
      {
        name: day.name,
        targetMuscles: day.targetMuscles,
        estimatedDuration: day.estimatedDuration,
      },
      userInstruction
    );

    if (error || !exercises) {
      console.error(`[GenerateAll] Failed for day "${day.name}":`, error);
      continue;
    }

    results.push({ dayId: day.id, exercises });

    // Merge generated exercises into context for next iteration
    const dayIndex = allDaysContext.findIndex((d) => d.name === day.name);
    if (dayIndex !== -1) {
      allDaysContext[dayIndex].exercises = exercises.map((e) => ({ exerciseName: e.exerciseName }));
    }
  }

  return results;
}

// ============================================================================
// EDIT WORKOUT PLAN WITH AI
// ============================================================================

function buildPlanEditPrompt(
  currentPlanText: string,
  preferences: string,
  exerciseHistory: string,
  editInstruction: string
): string {
  return `You are modifying an existing workout plan based on user instructions. Use the generate_workout_plan tool to output the MODIFIED plan.

## CURRENT PLAN
${currentPlanText}

## USER PREFERENCES
${preferences}

## USER'S EXERCISE HISTORY
${exerciseHistory || '(No history available)'}

## EDIT INSTRUCTION
"${editInstruction}"

## RULES
1. Apply the user's edit instruction to the current plan
2. Keep unchanged days as similar as possible (same names, muscles, durations)
3. Always output exactly 7 days (training + rest = 7)
4. If the user asks to add/remove training days, adjust rest days accordingly
5. If the user asks to change the split, restructure all training days
6. Maintain sensible rest day placement (avoid 3+ consecutive training days)
7. Give each day a descriptive name matching its purpose
8. Preserve the plan name unless the change warrants renaming it

Call the generate_workout_plan tool now with the modified plan.`;
}

function formatCurrentPlanForEdit(plan: {
  name: string;
  description?: string;
  splitType: SplitType;
  days: { dayLabel: string; name: string; description?: string; targetMuscles: MuscleGroup[]; estimatedDuration: number; isRestDay: boolean; isCardioDay?: boolean; cardioNotes?: string; exercises?: { exerciseName: string }[] }[];
}): string {
  const lines: string[] = [];
  lines.push(`Plan: "${plan.name}"`);
  if (plan.description) lines.push(`Description: ${plan.description}`);
  lines.push(`Split: ${plan.splitType}`);
  lines.push('');

  for (const day of plan.days) {
    if (day.isRestDay) {
      lines.push(`- ${day.dayLabel}: REST "${day.name}"${day.cardioNotes ? ` (${day.cardioNotes})` : ''}`);
    } else {
      const muscles = day.targetMuscles.join(', ');
      const exStr = day.exercises && day.exercises.length > 0
        ? ` | Exercises: ${day.exercises.map(e => e.exerciseName).join(', ')}`
        : '';
      lines.push(`- ${day.dayLabel}: "${day.name}" [${muscles}] ~${day.estimatedDuration}min${exStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Edit an existing workout plan using natural language instructions.
 * Returns a modified plan structure (days without exercises — those are generated separately).
 */
export async function editWorkoutPlan(
  currentPlan: {
    name: string;
    description?: string;
    splitType: SplitType;
    days: { dayLabel: string; name: string; description?: string; targetMuscles: MuscleGroup[]; estimatedDuration: number; isRestDay: boolean; isCardioDay?: boolean; cardioNotes?: string; exercises?: { exerciseName: string }[] }[];
  },
  preferences: WorkoutPreferences,
  editInstruction: string
): Promise<{
  plan: {
    name: string;
    description: string;
    splitType: SplitType;
    days: Omit<PlanDay, 'id' | 'exercises' | 'orderIndex'>[];
  } | null;
  error?: string;
}> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { plan: null, error: 'API configuration error' };
  }

  try {
    const { exerciseHistory } = await getExerciseContext();
    const prefsText = formatPreferences(preferences);
    const planText = formatCurrentPlanForEdit(currentPlan);
    const systemPrompt = buildPlanEditPrompt(planText, prefsText, exerciseHistory, editInstruction);

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Apply this edit: "${editInstruction}". Use the generate_workout_plan tool.` },
    ];

    const requestBody: Record<string, unknown> = {
      model: 'gpt-4.1',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
      tools: [WORKOUT_PLAN_TOOL],
      tool_choice: { type: 'function', function: { name: 'generate_workout_plan' } },
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
      throw new Error('OpenAI API error');
    }

    const data: OpenAIResponse = await response.json();
    const assistantMessage = data.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls?.length) {
      return { plan: null, error: 'No plan generated' };
    }

    const toolCall = assistantMessage.tool_calls[0];
    if (toolCall.function.name !== 'generate_workout_plan') {
      return { plan: null, error: 'Unexpected tool call' };
    }

    const args: GenerateWorkoutPlanArgs = JSON.parse(toolCall.function.arguments);

    return {
      plan: {
        name: args.name,
        description: args.description,
        splitType: args.splitType as SplitType,
        days: args.days.map((d, i) => ({
          dayNumber: i + 1,
          dayLabel: d.dayLabel,
          name: d.name,
          description: d.description,
          targetMuscles: (d.targetMuscles || []) as MuscleGroup[],
          estimatedDuration: d.estimatedDuration || 0,
          isRestDay: d.isRestDay,
          isCardioDay: d.isCardioDay,
          cardioNotes: d.cardioNotes,
        })),
      },
    };
  } catch (error) {
    console.error('[EditWorkoutPlan] Error:', error);
    return { plan: null, error: error instanceof Error ? error.message : 'Failed to edit plan' };
  }
}

// ============================================================================
// QUICK AI WORKOUT (for gym start modal)
// ============================================================================

/**
 * Generate a quick workout from muscle groups + duration.
 * Reuses the existing generateDayExercises pipeline (global DB pre-filter,
 * forced tool calling, exercise resolution) — zero new LLM plumbing.
 */
export async function generateQuickWorkout(
  targetMuscles: MuscleGroup[],
  durationMinutes: number,
  equipmentAccess?: EquipmentAccess,
  userInstruction?: string,
): Promise<{
  exercises: GeneratedExercise[] | null;
  workoutName: string;
  error?: string;
}> {
  await requireUser();

  // Build a workout name from muscles
  const muscleLabels: Record<string, string> = {
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
    biceps: 'Arms', triceps: 'Arms', forearms: 'Arms',
    quadriceps: 'Legs', hamstrings: 'Legs', glutes: 'Glutes',
    calves: 'Legs', abs: 'Core', obliques: 'Core',
    lower_back: 'Core', traps: 'Back', lats: 'Back', full_body: 'Full Body',
  };
  const uniqueLabels = [...new Set(targetMuscles.map((m) => muscleLabels[m] || m))];
  const workoutName = uniqueLabels.slice(0, 3).join(' & ') + ' Session';

  // Build minimal preferences with sensible defaults
  const preferences: WorkoutPreferences = {
    trainingGoal: 'general_fitness',
    experienceLevel: 'intermediate',
    equipmentAccess: equipmentAccess || 'full_gym',
    daysPerWeek: 4,
    sessionDuration: durationMinutes,
    focusAreas: [],
    deprioritizeAreas: [],
    splitType: 'custom',
    cardioLevel: 'none',
  };

  // Build virtual PlanDay
  const virtualDay = {
    name: workoutName,
    targetMuscles,
    estimatedDuration: durationMinutes,
  };

  const { exercises, error } = await generateDayExercises(
    preferences,
    [],  // empty allDays — no overlap avoidance needed
    virtualDay,
    userInstruction,
  );

  return { exercises: exercises ?? null, workoutName, error };
}
