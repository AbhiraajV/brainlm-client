/**
 * Diet history utility functions
 * Pure functions for computing summaries and formatting for LLM prompts
 */

import type {
  DietHistoryDay,
  DietHistorySummary,
  DailyTargets,
  DietDayPlan,
  DietGoalProfile,
  MealPlanEntry,
} from '@/lib/sessions/types';

/**
 * Compute a summary from raw history days + profile targets
 */
export function computeDietHistorySummary(
  days: DietHistoryDay[],
  profileTargets: DailyTargets
): DietHistorySummary {
  if (days.length === 0) {
    return {
      days: [],
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFat: 0,
      weeklyTrend: 'on_target',
      lastDayCalories: null,
      lastDayProtein: null,
    };
  }

  const count = days.length;
  const avgCalories = Math.round(days.reduce((s, d) => s + d.totalCalories, 0) / count);
  const avgProtein = Math.round(days.reduce((s, d) => s + d.totalProtein, 0) / count);
  const avgCarbs = Math.round(days.reduce((s, d) => s + d.totalCarbs, 0) / count);
  const avgFat = Math.round(days.reduce((s, d) => s + d.totalFat, 0) / count);

  // Determine weekly trend vs target
  const calDiff = avgCalories - profileTargets.calories;
  const threshold = profileTargets.calories * 0.05; // 5% tolerance
  let weeklyTrend: DietHistorySummary['weeklyTrend'] = 'on_target';
  if (calDiff > threshold) weeklyTrend = 'above_target';
  else if (calDiff < -threshold) weeklyTrend = 'below_target';

  // Last day stats (most recent)
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const lastDay = sorted[0];

  return {
    days,
    avgCalories,
    avgProtein,
    avgCarbs,
    avgFat,
    weeklyTrend,
    lastDayCalories: lastDay?.totalCalories ?? null,
    lastDayProtein: lastDay?.totalProtein ?? null,
  };
}

/**
 * Format diet history summary as text for the coach system prompt
 */
export function formatDietHistoryForPrompt(
  summary: DietHistorySummary,
  profileTargets: DailyTargets
): string {
  if (summary.days.length === 0) {
    return '(No diet history available)';
  }

  const lines: string[] = [
    `── DIET HISTORY (last ${summary.days.length} days) ──`,
    `Average daily: ${summary.avgCalories} cal, ${summary.avgProtein}g protein, ${summary.avgCarbs}g carbs, ${summary.avgFat}g fat`,
  ];

  // Weekly trend
  const trendLabel =
    summary.weeklyTrend === 'above_target' ? 'above target' :
    summary.weeklyTrend === 'below_target' ? 'below target' : 'on target';
  lines.push(`This period: ${summary.avgCalories} cal avg (${trendLabel} for ${profileTargets.calories} goal)`);

  // Last day details
  if (summary.lastDayCalories != null) {
    const calDiff = summary.lastDayCalories - profileTargets.calories;
    const calDiffStr = calDiff > 0 ? `above target by ${calDiff}cal` : calDiff < 0 ? `below target by ${Math.abs(calDiff)}cal` : 'on target';
    const proteinDiff = (summary.lastDayProtein ?? 0) - profileTargets.protein;
    const proteinDiffStr = proteinDiff < 0 ? `, protein below by ${Math.abs(proteinDiff)}g` : '';
    lines.push(`Yesterday: ${summary.lastDayCalories} cal, ${summary.lastDayProtein}g protein — ${calDiffStr}${proteinDiffStr}`);
  }

  // Protein consistency
  if (summary.days.length >= 3) {
    const proteins = summary.days.map(d => d.totalProtein);
    const min = Math.min(...proteins);
    const max = Math.max(...proteins);
    const range = max - min;
    const consistency = range < 30 ? 'consistent' : range < 60 ? 'somewhat inconsistent' : 'inconsistent';
    lines.push(`Protein consistency: ${consistency} (range ${min}-${max}g)`);
  }

  lines.push('────────────────────────────────');
  return lines.join('\n');
}

/**
 * Format today's day plan + profile targets as text for the coach system prompt
 */
export function formatDayPlanForPrompt(
  plan: DietDayPlan,
  profileTargets: DailyTargets
): string {
  const lines: string[] = [
    '── TODAY\'S PLAN ──',
    `Targets: ${plan.targets.calories} cal | ${plan.targets.protein}g protein | ${plan.targets.carbs}g carbs | ${plan.targets.fat}g fat | ${plan.fiberTarget}g fiber`,
  ];

  if (plan.reasoning) {
    lines.push(`Reasoning: ${plan.reasoning}`);
  }

  if (plan.adjustments.length > 0) {
    lines.push(`Adjustments: ${plan.adjustments.join('; ')}`);
  }

  lines.push('────────────────────────────────');
  return lines.join('\n');
}

/**
 * Format diet goal profile as text for the coach system prompt
 */
export function formatDietProfileForPrompt(
  profile: DietGoalProfile
): string {
  const lines: string[] = [
    '── DIET GOAL PROFILE ──',
    `Goal: ${formatGoalLabel(profile.dietGoal)}${profile.targetWeeklyChange ? ` (${Math.abs(profile.targetWeeklyChange)}kg/week)` : ''} | TDEE: ${profile.tdee} | Target: ${profile.targets.calories} cal/day`,
    `Protein: ${profile.proteinPerKg}g/kg (${profile.targets.protein}g) | Style: ${formatLabel(profile.dietStyle)}`,
  ];

  if (profile.allergies) {
    lines.push(`Allergies: ${profile.allergies}`);
  }

  lines.push('────────────────────────────────');
  return lines.join('\n');
}

/**
 * Format today's meal plan as text for the diet coach agent context
 */
export function formatMealPlanForPrompt(meals: MealPlanEntry[]): string {
  if (meals.length === 0) return '';

  const lines: string[] = ["── TODAY'S MEAL PLAN ──"];

  for (const meal of meals) {
    const foodList = meal.foods.map(f => `${f.name} (${f.portion})`).join(', ');
    lines.push(`${meal.name}: ${foodList} — ${Math.round(meal.totalMacros.calories)} cal, ${Math.round(meal.totalMacros.protein)}g P`);
  }

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.totalMacros.calories,
      protein: acc.protein + m.totalMacros.protein,
      carbs: acc.carbs + m.totalMacros.carbs,
      fat: acc.fat + m.totalMacros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  lines.push(`Plan total: ${Math.round(totals.calories)} cal | ${Math.round(totals.protein)}g P | ${Math.round(totals.carbs)}g C | ${Math.round(totals.fat)}g F`);
  lines.push('────────────────────────────────');

  return lines.join('\n');
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatGoalLabel(goal: string): string {
  const labels: Record<string, string> = {
    weight_loss: 'Lose fat',
    muscle_gain: 'Gain muscle',
    maintenance: 'Maintain',
    body_recomp: 'Body recomp',
    performance: 'Performance',
    health: 'Health',
  };
  return labels[goal] || formatLabel(goal);
}
