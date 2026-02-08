'use server';

/**
 * Meal Plan Suggestion Server Actions
 *
 * Provides AI-powered conversation for diet plan creation:
 * 1. getMealPlanCoachGreeting - Personalized greeting with auto-detected context
 * 2. chatWithMealPlanCoach - Conversation to gather diet requirements
 * 3. generateMealPlanFromChat - Tool-based meal plan generation
 */

import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';
import type { MealPlanEntry, MealPlanFood, Macros, DietGoal, MealType, DietLog } from '@/lib/sessions/types';
import { MEAL_PLAN_COACH_TOOLS, type GenerateMealPlanArgs } from '@/server/agents/meal-plan-coach-tools';

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
// CONTEXT HELPERS
// ============================================================================

interface DietContext {
  baseline: string;
  gymSummary: string;
  dietHistory: string;
  workoutPlanNames: string;
}

async function getDietContext(userId: string): Promise<DietContext> {
  try {
    // Fetch user baseline
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { baseline: true },
    });
    const baseline = user?.baseline || '';

    // Fetch recent gym events for training context
    let gymSummary = '';
    try {
      const gymEvents = await prisma.$queryRaw<Array<{
        occurredAt: Date;
        rawJson: Record<string, unknown>;
      }>>`
        SELECT e."occurredAt", e."rawJson"
        FROM "Event" e
        WHERE e."userId" = ${userId}
          AND e."trackedType" = 'GYM'
          AND e."rawJson" IS NOT NULL
        ORDER BY e."occurredAt" DESC
        LIMIT 5
      `;

      if (gymEvents.length > 0) {
        const summaries = gymEvents.map(ev => {
          const json = ev.rawJson as Record<string, unknown>;
          const name = json.workoutName || 'Workout';
          const exercises = (json.exercises as Array<Record<string, unknown>>)?.length || 0;
          const date = new Date(ev.occurredAt).toLocaleDateString();
          return `${date}: ${name} (${exercises} exercises)`;
        });
        gymSummary = summaries.join('\n');
      }
    } catch {
      // trackedType column may not exist yet
    }

    // Fetch recent diet events for food preferences
    let dietHistory = '';
    try {
      const dietEvents = await prisma.$queryRaw<Array<{
        occurredAt: Date;
        rawJson: Record<string, unknown>;
      }>>`
        SELECT e."occurredAt", e."rawJson"
        FROM "Event" e
        WHERE e."userId" = ${userId}
          AND e."trackedType" = 'DIET'
          AND e."rawJson" IS NOT NULL
        ORDER BY e."occurredAt" DESC
        LIMIT 10
      `;

      if (dietEvents.length > 0) {
        const foods: string[] = [];
        let totalCals = 0;
        let totalProtein = 0;
        let count = 0;

        for (const ev of dietEvents) {
          const json = ev.rawJson as unknown as DietLog;
          if (json.meals) {
            for (const meal of json.meals) {
              for (const food of meal.foods) {
                if (!foods.includes(food.name)) foods.push(food.name);
              }
            }
          }
          if (json.summary?.totalMacros) {
            totalCals += json.summary.totalMacros.calories;
            totalProtein += json.summary.totalMacros.protein;
            count++;
          }
        }

        const parts: string[] = [];
        if (count > 0) {
          parts.push(`Average daily intake: ~${Math.round(totalCals / count)} cal, ~${Math.round(totalProtein / count)}g protein`);
        }
        if (foods.length > 0) {
          parts.push(`Common foods: ${foods.slice(0, 20).join(', ')}`);
        }
        dietHistory = parts.join('\n');
      }
    } catch {
      // trackedType column may not exist yet
    }

    // Get workout plan names from local context (not stored server-side, pass empty)
    const workoutPlanNames = '';

    return { baseline, gymSummary, dietHistory, workoutPlanNames };
  } catch (error) {
    console.error('[MealPlanSuggestion] Error fetching context:', error);
    return { baseline: '', gymSummary: '', dietHistory: '', workoutPlanNames: '' };
  }
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

function buildConversationPrompt(ctx: DietContext): string {
  return `You are a nutrition coach helping the user create a personalized daily meal plan.

## YOUR ROLE
You're having a conversation to understand the user's diet needs. Do NOT generate a plan yet - gather information through friendly conversation.

## WHAT TO GATHER (one question at a time, skip what you can infer)
1. **Goal** - Weight loss, muscle gain, maintenance, body recomp, performance, health?
2. **Body stats** - Weight, height, age, gender (SKIP if already in baseline below)
3. **Activity level** - Daily activity + training frequency (pre-fill from gym data if available)
4. **Diet style** - Flexible, high protein, low carb, keto, balanced, high carb?
5. **Meals per day** - How many meals fit their schedule? (2-6)
6. **Restrictions** - Allergies, foods to avoid, vegetarian/vegan?
7. **Food preferences** - Foods they love (reference their diet history below)

## USER BASELINE (auto-parsed for weight/height/age/gender - skip these questions if available)
${ctx.baseline || '(No baseline available)'}

## GYM / TRAINING DATA (use to estimate activity level)
${ctx.gymSummary || '(No gym data available)'}

## DIET HISTORY (common foods and average intake)
${ctx.dietHistory || '(No diet history available)'}

## COMMUNICATION STYLE
- Be direct and efficient, not overly enthusiastic
- Ask ONE question at a time
- If baseline has their stats, DON'T ask again - confirm what you see
- Reference their training data: "I see you train 4x/week - that puts you at moderately to very active"
- Reference their food history: "I notice you eat a lot of chicken and rice - want to include those?"
- When you have enough info, tell the user they can click "Generate Plan" when ready
- Keep responses short (2-3 sentences max)
- Sound like a real dietician, not an AI assistant

## IMPORTANT
- Do NOT generate a meal plan yet
- Do NOT use tools - this is just conversation
- Do NOT calculate macros yet - wait for generation phase`;
}

function buildGenerationPrompt(ctx: DietContext): string {
  return `You are generating a personalized daily meal plan based on the conversation. Use the generate_meal_plan tool.

## USER BASELINE
${ctx.baseline || '(No baseline)'}

## GYM / TRAINING DATA
${ctx.gymSummary || '(No gym data)'}

## DIET HISTORY (prefer these foods in the plan)
${ctx.dietHistory || '(No diet history)'}

## NUTRITION SCIENCE RULES
1. **TDEE**: Use Mifflin-St Jeor equation with activity multiplier
   - Sedentary: BMR × 1.2
   - Lightly Active: BMR × 1.375
   - Moderately Active: BMR × 1.55
   - Very Active: BMR × 1.725
   - Extremely Active: BMR × 1.9

2. **Calorie targets by goal**:
   - Weight Loss: TDEE - 300 to 500 cal
   - Muscle Gain: TDEE + 200 to 300 cal
   - Maintenance: TDEE
   - Body Recomp: TDEE - 100 to 200 cal
   - Performance: TDEE + 100 cal

3. **Protein targets** (g per kg bodyweight):
   - Weight Loss: 1.8-2.2 g/kg (preserve muscle)
   - Muscle Gain: 1.6-2.0 g/kg
   - Maintenance: 1.4-1.8 g/kg
   - Body Recomp: 2.0-2.4 g/kg

4. **Macro splits** (of remaining calories after protein):
   - Flexible/Balanced: 55% carbs, 45% fat
   - High Protein: 55% carbs, 45% fat (higher protein)
   - Low Carb: 30% carbs, 70% fat
   - Keto: 10% carbs, 90% fat
   - High Carb: 70% carbs, 30% fat

5. **Meal design**:
   - Include actual food names and realistic portions
   - Prefer foods from the user's diet history when available
   - Each meal should have a descriptive name
   - Include prep tips or alternatives in notes
   - Ensure meals add up to daily targets (±5%)

6. **Rationale**: Explain your calculations clearly. Show TDEE, adjustment, protein reasoning.

Call the generate_meal_plan tool now.`;
}

// ============================================================================
// OPENAI HELPER
// ============================================================================

async function callOpenAI(
  messages: OpenAIChatMessage[],
  includeTools: boolean,
  maxTokens: number = 500
): Promise<OpenAIResponse> {
  const requestBody: Record<string, unknown> = {
    model: 'gpt-4o',
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  if (includeTools) {
    requestBody.tools = MEAL_PLAN_COACH_TOOLS;
    requestBody.tool_choice = { type: 'function', function: { name: 'generate_meal_plan' } };
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
    console.error('[MealPlanSuggestion] OpenAI error:', error);
    throw new Error('OpenAI API error');
  }

  return response.json();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get an initial greeting from the meal plan coach
 */
export async function getMealPlanCoachGreeting(): Promise<{ greeting: string }> {
  const user = await requireUser();

  if (!OPENAI_API_KEY) {
    return { greeting: "What are your diet goals? Let's build a plan." };
  }

  try {
    const ctx = await getDietContext(user.id);

    // Build personalized greeting based on available data
    const parts: string[] = [];

    if (ctx.gymSummary) {
      const lines = ctx.gymSummary.split('\n');
      const frequency = lines.length;
      parts.push(`I see you've been training ${frequency}x recently`);
    }

    if (ctx.dietHistory) {
      const calMatch = ctx.dietHistory.match(/~(\d+) cal/);
      if (calMatch) {
        parts.push(`averaging about ${calMatch[1]} cal/day`);
      }
    }

    if (parts.length > 0) {
      return {
        greeting: `${parts.join(', ')}. What's your goal with this diet plan — cutting, bulking, or maintaining?`,
      };
    }

    if (ctx.baseline) {
      return {
        greeting: "I've got your profile loaded. What are you looking to achieve with this diet plan — lose fat, build muscle, or maintain?",
      };
    }

    return { greeting: "What are your diet goals? Tell me about what you want to achieve and I'll design a meal plan for you." };
  } catch {
    return { greeting: "What are your diet goals? Let's build a plan." };
  }
}

/**
 * Chat with the meal plan coach (no tools - pure conversation)
 */
export async function chatWithMealPlanCoach(
  userMessage: string,
  previousMessages: ChatMessage[]
): Promise<{ response: string }> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { response: 'API configuration error. Please try again later.' };
  }

  try {
    const user = await requireUser();
    const ctx = await getDietContext(user.id);
    const systemPrompt = buildConversationPrompt(ctx);

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await callOpenAI(messages, false);
    const content = response.choices?.[0]?.message?.content || "Tell me about your diet goals.";

    return { response: content };
  } catch (error) {
    console.error('[MealPlanSuggestion] Chat error:', error);
    return { response: 'Something went wrong. Please try again.' };
  }
}

/**
 * Generate a meal plan from the conversation
 */
export async function generateMealPlanFromChat(
  previousMessages: ChatMessage[]
): Promise<{
  mealPlan: {
    name: string;
    description?: string;
    dietGoal: DietGoal;
    tdee: number;
    targetCalories: number;
    proteinPerKg?: number;
    rationale: string;
    targets: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
    };
    meals: MealPlanEntry[];
    bodyStats?: {
      weight: number;
      weightUnit: string;
      height?: number;
      heightUnit?: string;
      age?: number;
      gender?: string;
    };
  } | null;
  summary: string;
  error?: string;
}> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return { mealPlan: null, summary: '', error: 'API configuration error' };
  }

  try {
    const user = await requireUser();
    const ctx = await getDietContext(user.id);
    const systemPrompt = buildGenerationPrompt(ctx);

    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      {
        role: 'user',
        content: 'Generate my personalized meal plan now based on our conversation. Use the generate_meal_plan tool.',
      },
    ];

    const response = await callOpenAI(messages, true, 3000);
    const assistantMessage = response.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls?.length) {
      return {
        mealPlan: null,
        summary: assistantMessage?.content || 'Failed to generate plan',
        error: 'No plan generated',
      };
    }

    const toolCall = assistantMessage.tool_calls[0];
    if (toolCall.function.name !== 'generate_meal_plan') {
      return { mealPlan: null, summary: '', error: 'Unexpected tool call' };
    }

    const args: GenerateMealPlanArgs = JSON.parse(toolCall.function.arguments);

    // Convert to MealPlanEntry[]
    const meals: MealPlanEntry[] = args.meals.map((m, i) => {
      const foods: MealPlanFood[] = m.foods.map(f => ({
        name: f.name,
        portion: f.portion,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
      }));

      const totalMacros: Macros = foods.reduce(
        (acc, f) => ({
          calories: acc.calories + f.calories,
          protein: acc.protein + f.protein,
          carbs: acc.carbs + f.carbs,
          fat: acc.fat + f.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      return {
        id: `meal_${Date.now()}_${i}`,
        mealType: m.mealType as MealType,
        name: m.name,
        foods,
        totalMacros,
        time: m.time,
        notes: m.notes,
      };
    });

    // Get follow-up response
    const toolResult = JSON.stringify({ success: true, mealCount: meals.length });
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
      `Created "${args.name}" with ${meals.length} meals.`;

    return {
      mealPlan: {
        name: args.name,
        description: args.description,
        dietGoal: args.dietGoal as DietGoal,
        tdee: args.tdee,
        targetCalories: args.targetCalories,
        proteinPerKg: args.proteinPerKg,
        rationale: args.rationale,
        targets: args.targets,
        meals,
        bodyStats: args.bodyStats,
      },
      summary,
    };
  } catch (error) {
    console.error('[MealPlanSuggestion] Generation error:', error);
    return {
      mealPlan: null,
      summary: '',
      error: error instanceof Error ? error.message : 'Failed to generate meal plan',
    };
  }
}
