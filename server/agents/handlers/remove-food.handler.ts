/**
 * Handler for remove_food tool
 * Removes a food item from a meal
 */

import type { DietLog } from '@/lib/sessions/types';
import type { RemoveFoodArgs } from '../diet-coach-tools';
import { recalculateDietSummary } from '@/lib/diet/macros';

export interface RemoveFoodResult {
  dietLog: DietLog;
  removed: boolean;
  foodName?: string;
}

/**
 * Remove a food item from a meal
 */
export function handleRemoveFood(
  dietLog: DietLog,
  args: RemoveFoodArgs
): RemoveFoodResult {
  // Find the meal
  const mealIndex = dietLog.meals.findIndex(m => m.id === args.mealId);

  if (mealIndex === -1) {
    console.warn(`[handleRemoveFood] Meal not found: ${args.mealId}`);
    return { dietLog, removed: false };
  }

  const meal = dietLog.meals[mealIndex];

  // Find the food
  const foodIndex = meal.foods.findIndex(f => f.id === args.foodId);

  if (foodIndex === -1) {
    console.warn(`[handleRemoveFood] Food not found: ${args.foodId}`);
    return { dietLog, removed: false };
  }

  const removedFood = meal.foods[foodIndex];

  // Remove food from array
  const updatedFoods = meal.foods.filter(f => f.id !== args.foodId);

  // Update meal
  const updatedMeal = {
    ...meal,
    foods: updatedFoods
  };

  // Update meals array
  const updatedMeals = [...dietLog.meals];
  updatedMeals[mealIndex] = updatedMeal;

  // Recalculate all totals
  const updatedDietLog = recalculateDietSummary({
    ...dietLog,
    meals: updatedMeals
  });

  return {
    dietLog: updatedDietLog,
    removed: true,
    foodName: removedFood.name
  };
}
