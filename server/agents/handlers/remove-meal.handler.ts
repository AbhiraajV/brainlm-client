/**
 * Handler for remove_meal tool
 * Removes an entire meal and all its foods
 */

import type { DietLog } from '@/lib/sessions/types';
import type { RemoveMealArgs } from '../diet-coach-tools';
import { recalculateDietSummary } from '@/lib/diet/macros';

export interface RemoveMealResult {
  dietLog: DietLog;
  removed: boolean;
  mealType?: string;
  foodCount?: number;
}

/**
 * Remove an entire meal and all its foods
 */
export function handleRemoveMeal(
  dietLog: DietLog,
  args: RemoveMealArgs
): RemoveMealResult {
  // Find the meal
  const mealIndex = dietLog.meals.findIndex(m => m.id === args.mealId);

  if (mealIndex === -1) {
    console.warn(`[handleRemoveMeal] Meal not found: ${args.mealId}`);
    return { dietLog, removed: false };
  }

  const removedMeal = dietLog.meals[mealIndex];

  // Remove meal from array
  const updatedMeals = dietLog.meals.filter(m => m.id !== args.mealId);

  // Re-index remaining meals
  const reindexedMeals = updatedMeals.map((meal, index) => ({
    ...meal,
    orderIndex: index
  }));

  // Recalculate all totals
  const updatedDietLog = recalculateDietSummary({
    ...dietLog,
    meals: reindexedMeals
  });

  return {
    dietLog: updatedDietLog,
    removed: true,
    mealType: removedMeal.mealType,
    foodCount: removedMeal.foods.length
  };
}
