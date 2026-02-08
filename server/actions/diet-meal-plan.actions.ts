'use server';

/**
 * Today's Meal Plan Generation
 *
 * After user accepts daily targets, generates a personalized meal plan
 * based on past diet history, patterns, and user preferences.
 * Uses gpt-4o-mini for fast, cheap generation via tool calling.
 */

import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';
import type { MealPlanEntry, MealPlanFood, Macros, DailyTargets, MealType, DietGoalProfile } from '@/lib/sessions/types';
import { MEAL_PLAN_TOOL, type GenerateMealPlanArgs } from '@/server/agents/meal-plan-coach-tools';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// TYPES
// ============================================================================

export interface SOSContext {
  consumedMeals: { mealType: string; foods: string[]; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number }[];
  totalConsumed: { calories: number; protein: number; carbs: number; fat: number };
  remaining: { calories: number; protein: number; carbs: number; fat: number };
  percentages: { calories: number; protein: number; carbs: number; fat: number };
  currentTimeOfDay: string;
  currentHour: number;
  userExplanation?: string;
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
// PROMPT BUILDER
// ============================================================================

function buildTodaysMealPlanPrompt(
  targets: DailyTargets,
  profile: { allergies?: string; foodPreferences?: string; mealsPerDay?: number; dietGoal?: string; dietStyle?: string },
  recentHistory: string,
  preferences?: string
): string {
  return `You are a nutrition coach generating TODAY's personalized meal plan.

## HARD CONSTRAINTS — the plan MUST hit these targets within ±5%
- Calories: ${targets.calories}
- Protein: ${targets.protein}g
- Carbs: ${targets.carbs}g
- Fat: ${targets.fat}g
${targets.fiber ? `- Fiber: ${targets.fiber}g` : ''}

## USER PROFILE
- Goal: ${profile.dietGoal || 'Not specified'}
- Diet style: ${profile.dietStyle || 'Flexible'}
- Meals per day: ${profile.mealsPerDay || 4}
${profile.allergies ? `- Allergies/restrictions: ${profile.allergies}` : ''}
${profile.foodPreferences ? `- Food preferences: ${profile.foodPreferences}` : ''}

## RECENT DIET HISTORY (analyze for patterns, mishaps, what worked)
${recentHistory || '(No history available — create a balanced plan)'}

## USER'S REQUEST FOR TODAY
${preferences || '(No specific preferences — use history to guide choices)'}

## YOUR TASK
1. **Analyze** the recent history: identify binges, missed meals, low-protein days, what foods the user actually eats
2. In the rationale, explain WHY you chose this plan — reference specific days/patterns from history
3. Design ${profile.mealsPerDay || 4} meals that:
   - Hit the macro targets (this is mandatory)
   - Include foods the user already eats (from history)
   - Address any patterns you noticed (e.g., if they binge at night, front-load calories)
   - Respect the user's preferences/restrictions
4. Use realistic portions with specific weights/amounts

Call the generate_meal_plan tool now.`;
}

// ============================================================================
// SOS PROMPT BUILDER
// ============================================================================

function estimateRemainingMeals(currentHour: number, mealsPerDay: number): number {
  // Rough meal windows: breakfast ~7-9, lunch ~12-14, dinner ~18-20, snacks in between
  if (currentHour < 10) return Math.max(mealsPerDay - 1, 1); // missed at most breakfast
  if (currentHour < 14) return Math.max(mealsPerDay - 2, 1); // missed breakfast + maybe lunch
  if (currentHour < 18) return Math.max(Math.ceil(mealsPerDay / 2), 1); // afternoon
  if (currentHour < 21) return Math.max(Math.floor(mealsPerDay / 3), 1); // evening
  return 1; // late night — just one meal left
}

function buildSOSMealPlanPrompt(
  targets: DailyTargets,
  profile: { allergies?: string; foodPreferences?: string; mealsPerDay?: number; dietGoal?: string; dietStyle?: string },
  recentHistory: string,
  sosContext: SOSContext
): string {
  const remainingMeals = estimateRemainingMeals(sosContext.currentHour, profile.mealsPerDay || 4);
  const isOverBudget = sosContext.remaining.calories <= 0;

  const consumedSummary = sosContext.consumedMeals.map(m =>
    `- ${m.mealType}: ${m.foods.join(', ')} (${m.totalCalories} cal, ${m.totalProtein}g P, ${m.totalCarbs}g C, ${m.totalFat}g F)`
  ).join('\n');

  const remCal = Math.round(sosContext.remaining.calories);
  const remP = Math.round(sosContext.remaining.protein);
  const remC = Math.round(sosContext.remaining.carbs);
  const remF = Math.round(sosContext.remaining.fat);

  return `You are a nutrition coach generating a RESCUE meal plan for the rest of today. Be empathetic, not judgmental.

## WHAT THEY'VE ALREADY EATEN TODAY
${consumedSummary}

Totals consumed so far: ${Math.round(sosContext.totalConsumed.calories)} cal, ${Math.round(sosContext.totalConsumed.protein)}g P, ${Math.round(sosContext.totalConsumed.carbs)}g C, ${Math.round(sosContext.totalConsumed.fat)}g F
Day targets: ${targets.calories} cal, ${targets.protein}g P, ${targets.carbs}g C, ${targets.fat}g F
Progress: ${Math.round(sosContext.percentages.calories)}% cal, ${Math.round(sosContext.percentages.protein)}% P, ${Math.round(sosContext.percentages.carbs)}% C, ${Math.round(sosContext.percentages.fat)}% F

${isOverBudget
    ? `They are OVER budget. Design a minimal-damage plan:
## HARD CONSTRAINTS
- Keep total remaining food under 400 cal
- Maximize protein (aim for ${Math.max(remP, 30)}g+)
- Focus on lean protein + vegetables only
- Prioritize satiety to prevent further overeating`
    : `## HARD CONSTRAINTS — the ${remainingMeals} remaining meal${remainingMeals > 1 ? 's' : ''} MUST add up to these totals within ±5%
- Calories: ${remCal}
- Protein: ${remP}g
- Carbs: ${remC}g
- Fat: ${remF}g
${sosContext.percentages.protein < sosContext.percentages.calories ? '\nProtein is behind relative to calories — prioritize lean protein sources.' : ''}`
}

## CURRENT TIME: ${sosContext.currentTimeOfDay} (~${remainingMeals} meal${remainingMeals > 1 ? 's' : ''} left today)

${sosContext.userExplanation ? `## WHAT HAPPENED\n${sosContext.userExplanation}\n` : ''}## USER PROFILE
- Goal: ${profile.dietGoal || 'Not specified'}
- Diet style: ${profile.dietStyle || 'Flexible'}
${profile.allergies ? `- Allergies/restrictions: ${profile.allergies}` : ''}
${profile.foodPreferences ? `- Food preferences: ${profile.foodPreferences}` : ''}

## RECENT HISTORY
${recentHistory || '(No history available)'}

## YOUR TASK
Generate exactly ${remainingMeals} meal${remainingMeals > 1 ? 's' : ''} for the rest of today. Do NOT include meals they already ate.
The combined macros of your ${remainingMeals} meal${remainingMeals > 1 ? 's' : ''} must match the HARD CONSTRAINTS above.
Use realistic portions with specific weights/amounts.

In your rationale:
${sosContext.userExplanation ? '- Acknowledge what happened without judgment' : ''}
- State where they are: "${Math.round(sosContext.percentages.calories)}% through calories, ${Math.round(sosContext.percentages.protein)}% through protein"
- Explain the rescue strategy
- End with something motivating — one off-plan meal doesn't ruin a week

Call the generate_meal_plan tool now.`;
}

// ============================================================================
// HISTORY HELPER
// ============================================================================

async function getRecentDietHistoryForPlan(userId: string): Promise<string> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const dietEvents = await prisma.$queryRaw<Array<{
      occurredAt: Date;
      rawJson: Record<string, unknown>;
      content: string | null;
    }>>`
      SELECT e."occurredAt", e."rawJson", e."content"
      FROM "Event" e
      WHERE e."userId" = ${userId}
        AND e."trackedType" = 'DIET'
        AND e."rawJson" IS NOT NULL
        AND e."occurredAt" >= ${cutoff}
      ORDER BY e."occurredAt" DESC
      LIMIT 7
    `;

    if (dietEvents.length === 0) return '';

    const lines: string[] = [];
    for (const ev of dietEvents) {
      const date = new Date(ev.occurredAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const json = ev.rawJson as Record<string, unknown>;
      const summary = json.summary as Record<string, unknown> | undefined;
      const totalMacros = summary?.totalMacros as Record<string, number> | undefined;
      const meals = json.meals as Array<Record<string, unknown>> | undefined;

      if (!totalMacros) continue;

      const dayLine = `${date}: ${Math.round(totalMacros.calories || 0)} cal, ${Math.round(totalMacros.protein || 0)}g P, ${Math.round(totalMacros.carbs || 0)}g C, ${Math.round(totalMacros.fat || 0)}g F`;

      // Extract meal details
      const mealDetails: string[] = [];
      if (meals) {
        for (const meal of meals) {
          const foods = meal.foods as Array<Record<string, unknown>> | undefined;
          if (foods && foods.length > 0) {
            const foodNames = foods.map(f => f.name as string).join(', ');
            mealDetails.push(`  ${meal.mealType}: ${foodNames}`);
          }
        }
      }

      // Include session notes if available
      const notes = ev.content ? `  Notes: ${ev.content}` : '';

      lines.push(dayLine);
      if (mealDetails.length > 0) lines.push(...mealDetails);
      if (notes) lines.push(notes);
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function generateTodaysMealPlan(
  profile: {
    allergies?: string;
    foodPreferences?: string;
    mealsPerDay?: number;
    dietGoal?: string;
    dietStyle?: string;
  },
  targets: DailyTargets,
  preferences?: string,
  sosContext?: SOSContext
): Promise<{
  meals: MealPlanEntry[];
  analysis: string;
  error?: string;
}> {
  const user = await requireUser();

  if (!OPENAI_API_KEY) {
    return { meals: [], analysis: '', error: 'API configuration error' };
  }

  try {
    // Fetch history
    const recentHistory = await getRecentDietHistoryForPlan(user.id);

    // Build prompt — SOS mode if food has been logged
    const systemPrompt = sosContext
      ? buildSOSMealPlanPrompt(targets, profile, recentHistory, sosContext)
      : buildTodaysMealPlanPrompt(targets, profile, recentHistory, preferences);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate my meal plan for today.' },
        ],
        tools: [MEAL_PLAN_TOOL],
        tool_choice: { type: 'function', function: { name: 'generate_meal_plan' } },
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[generateTodaysMealPlan] OpenAI error:', error);
      return { meals: [], analysis: '', error: 'Failed to generate meal plan' };
    }

    const data: OpenAIResponse = await response.json();
    const assistantMessage = data.choices?.[0]?.message;

    if (!assistantMessage?.tool_calls?.length) {
      return { meals: [], analysis: '', error: 'No plan generated' };
    }

    const toolCall = assistantMessage.tool_calls[0];
    if (toolCall.function.name !== 'generate_meal_plan') {
      return { meals: [], analysis: '', error: 'Unexpected tool call' };
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

    return {
      meals,
      analysis: args.rationale,
    };
  } catch (error) {
    console.error('[generateTodaysMealPlan] Error:', error);
    return {
      meals: [],
      analysis: '',
      error: error instanceof Error ? error.message : 'Failed to generate meal plan',
    };
  }
}
