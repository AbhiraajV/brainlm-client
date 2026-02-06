/**
 * Diet calculation utilities for macro tracking
 */

import type {
  DietLog,
  MealEntry,
  FoodItem,
  Macros,
  DailyTargets,
  DailyProgress,
  DietDaySummary,
  MealType,
  ExtendedMacros,
} from '@/lib/sessions/types';

/**
 * Calculate total macros for a list of foods
 */
export function calculateMealTotals(foods: FoodItem[]): Macros {
  return foods.reduce(
    (totals, food) => ({
      calories: totals.calories + food.macros.calories,
      protein: totals.protein + food.macros.protein,
      carbs: totals.carbs + food.macros.carbs,
      fat: totals.fat + food.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Calculate total macros for all meals in a day
 */
export function calculateDailyTotals(meals: MealEntry[]): ExtendedMacros {
  const totals = meals.reduce(
    (daily, meal) => ({
      calories: daily.calories + meal.totalMacros.calories,
      protein: daily.protein + meal.totalMacros.protein,
      carbs: daily.carbs + meal.totalMacros.carbs,
      fat: daily.fat + meal.totalMacros.fat,
      fiber: (daily.fiber || 0) + (meal.foods.reduce((sum, f) => sum + (f.fiber || 0), 0)),
      sugar: (daily.sugar || 0) + (meal.foods.reduce((sum, f) => sum + (f.sugar || 0), 0)),
      sodium: (daily.sodium || 0) + (meal.foods.reduce((sum, f) => sum + (f.sodium || 0), 0)),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
  );

  return totals;
}

/**
 * Calculate progress towards daily targets
 */
export function calculateProgress(consumed: ExtendedMacros, targets: DailyTargets): DailyProgress {
  const remaining: Macros = {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
  };

  const percentages = {
    calories: targets.calories > 0 ? (consumed.calories / targets.calories) * 100 : 0,
    protein: targets.protein > 0 ? (consumed.protein / targets.protein) * 100 : 0,
    carbs: targets.carbs > 0 ? (consumed.carbs / targets.carbs) * 100 : 0,
    fat: targets.fat > 0 ? (consumed.fat / targets.fat) * 100 : 0,
  };

  return {
    consumed,
    remaining,
    percentages,
  };
}

/**
 * Recalculate all computed fields in a DietLog
 * Call this after any modification to meals/foods
 */
export function recalculateDietSummary(dietLog: DietLog): DietLog {
  // Recalculate meal totals
  const updatedMeals = dietLog.meals.map((meal) => ({
    ...meal,
    totalMacros: calculateMealTotals(meal.foods),
  }));

  // Calculate daily totals
  const consumed = calculateDailyTotals(updatedMeals);

  // Calculate progress
  const progress = calculateProgress(consumed, dietLog.targets);

  // Build summary
  const summary: DietDaySummary = {
    totalMeals: updatedMeals.length,
    totalFoods: updatedMeals.reduce((sum, meal) => sum + meal.foods.length, 0),
    totalMacros: {
      calories: consumed.calories,
      protein: consumed.protein,
      carbs: consumed.carbs,
      fat: consumed.fat,
    },
    totalFiber: consumed.fiber,
    totalSugar: consumed.sugar,
    totalSodium: consumed.sodium,
    targets: dietLog.targets,
    progress,
  };

  return {
    ...dietLog,
    meals: updatedMeals,
    summary,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Infer meal type from time string
 */
export function inferMealType(time?: string): MealType {
  if (!time) {
    const now = new Date();
    const hour = now.getHours();
    return inferMealTypeFromHour(hour);
  }

  // Parse time string (supports "HH:MM", "H:MM AM/PM", ISO timestamp)
  let hour: number;

  if (time.includes('T')) {
    // ISO timestamp
    hour = new Date(time).getHours();
  } else if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
    // 12-hour format
    const match = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (match) {
      hour = parseInt(match[1], 10);
      const isPM = match[3].toLowerCase() === 'pm';
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
    } else {
      hour = new Date().getHours();
    }
  } else {
    // 24-hour format "HH:MM"
    const parts = time.split(':');
    hour = parseInt(parts[0], 10) || new Date().getHours();
  }

  return inferMealTypeFromHour(hour);
}

function inferMealTypeFromHour(hour: number): MealType {
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 12) return 'morning_snack';
  if (hour >= 12 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'afternoon_snack';
  if (hour >= 17 && hour < 20) return 'dinner';
  if (hour >= 20 || hour < 5) return 'evening_snack';
  return 'other';
}

/**
 * Generate a unique ID for meals/foods
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an empty diet log with default targets
 */
export function createEmptyDietLog(targets?: Partial<DailyTargets>): DietLog {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const defaultTargets: DailyTargets = {
    calories: targets?.calories ?? 2000,
    protein: targets?.protein ?? 150,
    carbs: targets?.carbs ?? 200,
    fat: targets?.fat ?? 65,
    fiber: targets?.fiber ?? 25,
    sugar: targets?.sugar ?? 50,
    sodium: targets?.sodium ?? 2300,
  };

  const emptyProgress: DailyProgress = {
    consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    remaining: { ...defaultTargets },
    percentages: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };

  return {
    id: generateId('diet'),
    date: today,
    meals: [],
    targets: defaultTargets,
    summary: {
      totalMeals: 0,
      totalFoods: 0,
      totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      totalFiber: 0,
      totalSugar: 0,
      totalSodium: 0,
      targets: defaultTargets,
      progress: emptyProgress,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get meal order for sorting
 */
export function getMealOrder(mealType: MealType): number {
  const order: Record<MealType, number> = {
    breakfast: 1,
    morning_snack: 2,
    pre_workout: 3,
    lunch: 4,
    afternoon_snack: 5,
    post_workout: 6,
    dinner: 7,
    evening_snack: 8,
    other: 9,
  };
  return order[mealType] ?? 9;
}

/**
 * Sort meals by type order
 */
export function sortMealsByType(meals: MealEntry[]): MealEntry[] {
  return [...meals].sort((a, b) => getMealOrder(a.mealType) - getMealOrder(b.mealType));
}
