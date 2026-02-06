/**
 * Handler for update_meal tool
 * Updates meal type, time, or notes
 */

import type { DietLog } from '@/lib/sessions/types';
import type { UpdateMealArgs } from '../diet-coach-tools';
import { recalculateDietSummary, getMealOrder } from '@/lib/diet/macros';

export interface UpdateMealResult {
  dietLog: DietLog;
  updated: boolean;
}

/**
 * Update an existing meal's properties
 * Only updates fields that are provided in args
 */
export function handleUpdateMeal(
  dietLog: DietLog,
  args: UpdateMealArgs
): UpdateMealResult {
  // Find the meal
  const mealIndex = dietLog.meals.findIndex(m => m.id === args.mealId);

  if (mealIndex === -1) {
    console.warn(`[handleUpdateMeal] Meal not found: ${args.mealId}`);
    return { dietLog, updated: false };
  }

  const meal = dietLog.meals[mealIndex];

  // Create updated meal with only changed fields
  const updatedMeal = {
    ...meal,
    mealType: args.mealType ?? meal.mealType,
    time: args.time !== undefined ? args.time : meal.time,
    notes: args.notes !== undefined ? args.notes : meal.notes
  };

  // Update meals array
  let updatedMeals = [...dietLog.meals];
  updatedMeals[mealIndex] = updatedMeal;

  // If meal type changed, re-sort meals
  if (args.mealType && args.mealType !== meal.mealType) {
    updatedMeals = updatedMeals.sort(
      (a, b) => getMealOrder(a.mealType) - getMealOrder(b.mealType)
    );

    // Re-index after sorting
    updatedMeals = updatedMeals.map((m, index) => ({
      ...m,
      orderIndex: index
    }));
  }

  // Recalculate (though macros won't change for meal updates)
  const updatedDietLog = recalculateDietSummary({
    ...dietLog,
    meals: updatedMeals
  });

  return {
    dietLog: updatedDietLog,
    updated: true
  };
}
