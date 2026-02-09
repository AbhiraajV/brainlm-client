'use server';

import { requireUser } from '@/server/auth';
import type {
  DietGoalProfile,
  DietHistoryDay,
  DietDayPlan,
  DailyTargets,
} from '@/lib/sessions/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Generate today's recommended targets from this week's diet data.
 * Uses gpt-4.1-mini — fast, cheap (~$0.005), focused on one task.
 */
export async function generateDietDayPlan(
  profile: DietGoalProfile,
  recentDays: DietHistoryDay[]
): Promise<DietDayPlan> {
  await requireUser();

  if (!OPENAI_API_KEY || recentDays.length === 0) {
    return buildDefaultPlan(profile);
  }

  // Build compact history block — just this week's data + notes
  const historyLines = recentDays.slice(0, 7).map(d => {
    const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
    let line = `${dayName}: ${d.totalCalories} cal, ${d.totalProtein}g P, ${d.totalCarbs}g C, ${d.totalFat}g F`;
    if (d.notes) line += ` — "${d.notes.slice(0, 120)}"`;
    return line;
  });

  const prompt = `You are a diet coach. Give today's targets based on this week's data. Be brief.

## Profile
Goal: ${profile.dietGoal} | TDEE: ${profile.tdee} | Default: ${profile.targets.calories} cal, ${profile.targets.protein}g P, ${profile.targets.carbs}g C, ${profile.targets.fat}g F

## This Week
${historyLines.join('\n')}

## Rules
- If yesterday was over target, pull back slightly today
- If yesterday was under, can aim for normal or slightly above
- If protein has been consistently low, bump it
- Stay within ±200 of their default target unless there's a clear reason
- If on track, keep defaults with encouragement
- NEVER go below 1200 cal

Output ONLY JSON:
{"calories":<n>,"protein":<n>,"carbs":<n>,"fat":<n>,"reasoning":"<1 short sentence, reference specific days/numbers>"}`;

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
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      return buildDefaultPlan(profile);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    const jsonMatch = content?.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return buildDefaultPlan(profile);

    const parsed = JSON.parse(jsonMatch[0]);

    const targets: DailyTargets = {
      calories: Math.round(parsed.calories || profile.targets.calories),
      protein: Math.round(parsed.protein || profile.targets.protein),
      carbs: Math.round(parsed.carbs || profile.targets.carbs),
      fat: Math.round(parsed.fat || profile.targets.fat),
      fiber: profile.targets.fiber ?? 25,
    };

    return {
      targets,
      fiberTarget: profile.targets.fiber ?? 25,
      reasoning: parsed.reasoning || 'Using your default targets.',
      adjustments: [],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[generateDietDayPlan] Error:', err);
    return buildDefaultPlan(profile);
  }
}

function buildDefaultPlan(profile: DietGoalProfile): DietDayPlan {
  return {
    targets: { ...profile.targets, fiber: profile.targets.fiber ?? 25 },
    fiberTarget: profile.targets.fiber ?? 25,
    reasoning: 'Using your default targets.',
    adjustments: [],
    generatedAt: new Date().toISOString(),
  };
}
