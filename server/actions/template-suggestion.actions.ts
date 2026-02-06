'use server';

/**
 * Template Suggestion Server Actions
 *
 * Provides AI-powered conversation for template creation:
 * 1. chatWithTemplateCoach - Pure conversation (no tools) for gathering requirements
 * 2. generateTemplateFromChat - Tool-based generation when user is ready
 */

import { requireUser } from '@/server/auth';
import type { WorkoutTemplate, TemplateExercise, MuscleGroup } from '@/lib/sessions/types';
import { getExerciseHistory, getExerciseNames, getRecentWorkouts } from './gym-history.actions';
import {
  TEMPLATE_COACH_TOOLS,
  type GenerateWorkoutTemplateArgs,
  type GetExerciseSuggestionsArgs,
  type GeneratedExercise,
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

function buildGenerationPrompt(exerciseHistory: string, recentWorkouts: string, exerciseNames: string[]): string {
  return `You are generating a workout template based on the conversation. Use the generate_workout_template tool to create the template.

## USER'S EXERCISE HISTORY (reference this for smart targets)
${exerciseHistory || '(No history - use reasonable defaults)'}

## USER'S RECENT WORKOUTS
${recentWorkouts || '(No recent workouts)'}

## EXERCISES THE USER HAS DONE BEFORE
${exerciseNames.length > 0 ? exerciseNames.join(', ') : '(No prior exercises)'}

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
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: 500,
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

    // Convert generated exercises to template exercises
    const exercises: TemplateExercise[] = args.exercises.map((ex, index) => ({
      id: crypto.randomUUID(),
      exerciseName: ex.exerciseName,
      muscleGroup: ex.muscleGroup,
      secondaryMuscles: ex.secondaryMuscles,
      equipmentType: ex.equipmentType,
      targetSets: ex.targetSets,
      targetReps: ex.targetReps,
      targetWeight: ex.targetWeight,
      targetWeightUnit: ex.targetWeightUnit || 'kg',
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      orderIndex: index,
    }));

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
