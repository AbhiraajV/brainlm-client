'use server';

import { requireUser } from '@/server/auth';
import type { DietGoal, DietStyle, DailyTargets, ActivityLevel } from '@/lib/sessions/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ============================================================================
// GENERATE DIET GOALS — AI creates targets from stats + free-form goal
// ============================================================================

export interface GenerateDietGoalsInput {
  weight: number;
  weightUnit: 'kg' | 'lbs';
  height: number;
  heightUnit: 'cm' | 'ft';
  age: number;
  gender: 'male' | 'female' | 'other';
  bodyFatPercent?: number;
  activityLevel: ActivityLevel;
  trainingDaysPerWeek: number;
  tdee: number;
  weightKg: number;
}

export interface GenerateDietGoalsResult {
  dietGoal: DietGoal;
  dietStyle: DietStyle;
  targetWeeklyChange: number;
  targets: DailyTargets;
  proteinPerKg: number;
  reasoning: string;
  suggestions: string[];
}

/**
 * AI generates complete diet targets from body stats + free-form goal description.
 * TDEE is computed client-side (Mifflin-St Jeor) and passed in as a reference.
 */
export async function generateDietGoals(
  stats: GenerateDietGoalsInput,
  goalDescription: string,
): Promise<GenerateDietGoalsResult> {
  await requireUser();

  if (!OPENAI_API_KEY) {
    return fallbackGenerate(stats, goalDescription);
  }

  const prompt = `You are an expert registered dietitian creating personalized daily nutrition targets.

## CLIENT STATS
- Weight: ${stats.weight}${stats.weightUnit} (${Math.round(stats.weightKg)}kg)
- Height: ${stats.height}${stats.heightUnit}
- Age: ${stats.age} | Gender: ${stats.gender}
- Body fat: ${stats.bodyFatPercent ? `${stats.bodyFatPercent}%` : 'unknown'}
- Activity level: ${stats.activityLevel} | Training: ${stats.trainingDaysPerWeek}x/week
- Estimated TDEE (Mifflin-St Jeor): ${stats.tdee} cal/day

## CLIENT'S GOAL
"${goalDescription}"

## YOUR TASK
Generate optimal daily nutrition targets based on the client's stats and stated goals.

Guidelines:
- Use TDEE as starting point. Adjust for goal: typically 300-600 cal deficit for fat loss, 200-400 surplus for muscle gain
- Protein: 1.6-2.4g/kg for active individuals. Higher (2.0-2.4) for fat loss or recomp
- Fat: minimum 0.7g/kg for hormonal health. Typically 25-35% of calories
- Remaining calories from carbs
- Fiber: ~14g per 1000 calories (min 25g)
- Be practical and sustainable — aggressive deficits (>750 cal) are rarely sustainable
- For body recomp: slight deficit (100-300) with high protein (2.0-2.4g/kg)
- Consider the client's specific situation and preferences from their goal description

Classify the goal into a category and choose an appropriate diet style.

For targetWeeklyChange: use a positive number for kg/week of weight change (0.5 = losing 0.5kg/week or gaining 0.5kg/week depending on goal). Use 0 for maintenance/recomp.

Respond with ONLY valid JSON:
{
  "dietGoal": "<weight_loss | muscle_gain | maintenance | body_recomp | performance | health>",
  "dietStyle": "<flexible | high_protein | low_carb | keto | balanced | high_carb>",
  "targetWeeklyChange": <number, kg/week>,
  "targets": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> },
  "proteinPerKg": <number with 1 decimal>,
  "reasoning": "<2-4 sentences explaining your rationale — reference TDEE, deficit/surplus, and why these macros suit their goal>",
  "suggestions": ["<0-3 practical tips for success>"]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('[generateDietGoals] OpenAI error:', response.status);
      return fallbackGenerate(stats, goalDescription);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const jsonMatch = content?.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return fallbackGenerate(stats, goalDescription);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const validGoals: DietGoal[] = ['weight_loss', 'muscle_gain', 'maintenance', 'body_recomp', 'performance', 'health'];
    const validStyles: DietStyle[] = ['flexible', 'high_protein', 'low_carb', 'keto', 'balanced', 'high_carb'];

    const dietGoal = validGoals.includes(parsed.dietGoal) ? parsed.dietGoal : 'maintenance';
    const dietStyle = validStyles.includes(parsed.dietStyle) ? parsed.dietStyle : 'flexible';

    const protein = Math.round(parsed.targets?.protein || Math.round(stats.weightKg * 1.8));
    const carbs = Math.round(parsed.targets?.carbs || 200);
    const fat = Math.round(parsed.targets?.fat || Math.round(stats.weightKg * 0.8));
    const fiber = Math.round(parsed.targets?.fiber || 25);
    const calories = protein * 4 + carbs * 4 + fat * 9; // always derive from macros

    return {
      dietGoal,
      dietStyle,
      targetWeeklyChange: typeof parsed.targetWeeklyChange === 'number' ? parsed.targetWeeklyChange : 0,
      targets: { calories, protein, carbs, fat, fiber },
      proteinPerKg: parsed.proteinPerKg || Math.round((protein / stats.weightKg) * 10) / 10,
      reasoning: parsed.reasoning || 'Targets generated based on your stats and goals.',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch (err) {
    console.error('[generateDietGoals] Error:', err);
    return fallbackGenerate(stats, goalDescription);
  }
}

/** Deterministic fallback when AI is unavailable */
function fallbackGenerate(stats: GenerateDietGoalsInput, goalDescription: string): GenerateDietGoalsResult {
  const lower = goalDescription.toLowerCase();
  let dietGoal: DietGoal = 'maintenance';
  let targetWeeklyChange = 0;

  if (lower.includes('lose') || lower.includes('cut') || lower.includes('deficit') || lower.includes('lean') || lower.includes('shred')) {
    dietGoal = 'weight_loss';
    targetWeeklyChange = 0.5;
  } else if (lower.includes('gain') || lower.includes('bulk') || lower.includes('surplus') || lower.includes('grow') || lower.includes('mass')) {
    dietGoal = 'muscle_gain';
    targetWeeklyChange = 0.25;
  } else if (lower.includes('recomp') || lower.includes('same weight') || lower.includes('body comp') || lower.includes('maintain') && lower.includes('muscle')) {
    dietGoal = 'body_recomp';
  }

  const proteinPerKg = dietGoal === 'body_recomp' ? 2.2 : dietGoal === 'weight_loss' ? 2.0 : 1.8;
  const protein = Math.round(stats.weightKg * proteinPerKg);
  const proteinCal = protein * 4;

  let targetCal = stats.tdee;
  if (dietGoal === 'weight_loss') targetCal = stats.tdee - 500;
  else if (dietGoal === 'muscle_gain') targetCal = stats.tdee + 250;
  else if (dietGoal === 'body_recomp') targetCal = stats.tdee - 150;

  const remaining = targetCal - proteinCal;
  const carbs = Math.round(remaining * 0.55 / 4);
  const fat = Math.round(remaining * 0.45 / 9);
  const actualCal = protein * 4 + carbs * 4 + fat * 9;

  return {
    dietGoal,
    dietStyle: 'flexible',
    targetWeeklyChange,
    targets: {
      calories: actualCal,
      protein,
      carbs,
      fat,
      fiber: Math.max(25, Math.round(actualCal / 1000 * 14)),
    },
    proteinPerKg: Math.round((protein / stats.weightKg) * 10) / 10,
    reasoning: 'Targets computed using standard formulas. AI was unavailable for personalized analysis.',
    suggestions: [],
  };
}

// ============================================================================
// NEGOTIATION — user adjusts targets via text chat
// ============================================================================

export interface NegotiationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DietGoalNegotiationResult {
  response: string;
  updatedTargets: DailyTargets;
  proteinPerKg: number;
}

export async function negotiateDietGoals(
  profile: {
    weight: number;
    weightUnit: 'kg' | 'lbs';
    gender: 'male' | 'female' | 'other';
    dietGoal: DietGoal;
    dietStyle: DietStyle;
    tdee: number;
  },
  currentTargets: DailyTargets,
  userMessage: string,
  chatHistory: NegotiationMessage[]
): Promise<DietGoalNegotiationResult> {
  await requireUser();

  const weightKg = profile.weightUnit === 'lbs' ? profile.weight * 0.453592 : profile.weight;
  const currentProteinPerKg = Math.round((currentTargets.protein / weightKg) * 10) / 10;

  if (!OPENAI_API_KEY) {
    return {
      response: "Can't adjust targets right now — API unavailable. Edit them directly by tapping the numbers.",
      updatedTargets: currentTargets,
      proteinPerKg: currentProteinPerKg,
    };
  }

  const systemPrompt = `You are a registered dietitian helping a client fine-tune their daily nutrition targets.

## CLIENT
- Weight: ${profile.weight}${profile.weightUnit} (${Math.round(weightKg)}kg)
- Gender: ${profile.gender}
- Goal: ${profile.dietGoal} | TDEE: ${profile.tdee} cal | Style: ${profile.dietStyle}

## CURRENT TARGETS
- Calories: ${currentTargets.calories}
- Protein: ${currentTargets.protein}g (${currentProteinPerKg}g/kg)
- Carbs: ${currentTargets.carbs}g
- Fat: ${currentTargets.fat}g
${currentTargets.fiber ? `- Fiber: ${currentTargets.fiber}g` : ''}

## RULES
- If user asks for more protein, increase it and redistribute carbs/fat to keep calories similar
- If user requests specific calorie amount, adjust and rebalance macros proportionally
- Protein min: 1.2g/kg, max: 3.0g/kg
- Fat min: 0.7g/kg for hormonal health
- Calories should not go below 1200 for women or 1500 for men
- Always explain WHY you made the change
- Keep fiber target if mentioned

Respond with ONLY valid JSON:
{
  "response": "<1-3 sentences explaining the adjustment>",
  "updatedTargets": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number or null> }
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...chatHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages,
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return {
        response: 'Something went wrong. Your targets remain unchanged.',
        updatedTargets: currentTargets,
        proteinPerKg: currentProteinPerKg,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const jsonMatch = content?.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        response: content || "I couldn't process that. Try again?",
        updatedTargets: currentTargets,
        proteinPerKg: currentProteinPerKg,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const t = parsed.updatedTargets;
    const newTargets: DailyTargets = t ? {
      calories: Math.round(t.calories || currentTargets.calories),
      protein: Math.round(t.protein || currentTargets.protein),
      carbs: Math.round(t.carbs || currentTargets.carbs),
      fat: Math.round(t.fat || currentTargets.fat),
      fiber: t.fiber ? Math.round(t.fiber) : currentTargets.fiber,
    } : currentTargets;

    return {
      response: parsed.response || 'Targets updated.',
      updatedTargets: newTargets,
      proteinPerKg: Math.round((newTargets.protein / weightKg) * 10) / 10,
    };
  } catch (err) {
    console.error('[negotiateDietGoals] Error:', err);
    return {
      response: 'Something went wrong. Your targets remain unchanged.',
      updatedTargets: currentTargets,
      proteinPerKg: currentProteinPerKg,
    };
  }
}
