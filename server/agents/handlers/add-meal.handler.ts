/**
 * Handler for add_meal tool
 * Creates a new meal container in the diet log
 */

import type { DietLog, MealEntry, MealType } from '@/lib/sessions/types';
import type { AddMealArgs } from '../diet-coach-tools';
import { generateId, recalculateDietSummary, getMealOrder, inferMealType } from '@/lib/diet/macros';

export interface AddMealResult {
  dietLog: DietLog;
  mealId: string;
  alreadyExists: boolean;
}

/**
 * Add a new meal to the diet log
 * If a meal with the same type already exists, returns the existing one
 */
export function handleAddMeal(
  dietLog: DietLog,
  args: AddMealArgs
): AddMealResult {
  // Check if meal of this type already exists
  const existingMeal = dietLog.meals.find(
    m => m.mealType === args.mealType
  );

  if (existingMeal) {
    console.log(`[handleAddMeal] Meal "${args.mealType}" already exists, returning ID: ${existingMeal.id}`);
    return {
      dietLog,
      mealId: existingMeal.id,
      alreadyExists: true
    };
  }

  const mealId = generateId('meal');

  const newMeal: MealEntry = {
    id: mealId,
    mealType: args.mealType,
    time: args.time,
    foods: [],
    totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    notes: args.notes,
    orderIndex: dietLog.meals.length
  };

  // Add meal and sort by type order
  const updatedMeals = [...dietLog.meals, newMeal].sort(
    (a, b) => getMealOrder(a.mealType) - getMealOrder(b.mealType)
  );

  // Update order indices after sorting
  const reindexedMeals = updatedMeals.map((meal, index) => ({
    ...meal,
    orderIndex: index
  }));

  const updatedDietLog = recalculateDietSummary({
    ...dietLog,
    meals: reindexedMeals
  });

  return {
    dietLog: updatedDietLog,
    mealId,
    alreadyExists: false
  };
}

/**
 * Get or create a meal by type
 * Used by add_food when mealType is provided instead of mealId
 */
export function getOrCreateMeal(
  dietLog: DietLog,
  mealType: MealType
): { dietLog: DietLog; mealId: string } {
  const result = handleAddMeal(dietLog, { mealType });
  return {
    dietLog: result.dietLog,
    mealId: result.mealId
  };
}
