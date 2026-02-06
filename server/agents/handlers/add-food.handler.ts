/**
 * Handler for add_food tool
 * Adds a food item to a meal, creating the meal if needed
 */

import type { DietLog, FoodItem, MealType } from '@/lib/sessions/types';
import type { AddFoodArgs } from '../diet-coach-tools';
import { generateId, recalculateDietSummary, inferMealType } from '@/lib/diet/macros';
import { getOrCreateMeal } from './add-meal.handler';

export interface AddFoodResult {
  dietLog: DietLog;
  foodId: string;
  mealId: string;
}

/**
 * Add a food item to a meal
 * If mealId is not provided but mealType is, creates the meal if it doesn't exist
 * If neither is provided, infers meal type from current time
 */
export function handleAddFood(
  dietLog: DietLog,
  args: AddFoodArgs
): AddFoodResult {
  let workingDietLog = dietLog;
  let mealId = args.mealId;

  // If no mealId provided, use mealType to find or create meal
  if (!mealId) {
    const mealType: MealType = args.mealType || inferMealType();
    const result = getOrCreateMeal(workingDietLog, mealType);
    workingDietLog = result.dietLog;
    mealId = result.mealId;
  }

  // Find the meal
  const mealIndex = workingDietLog.meals.findIndex(m => m.id === mealId);

  if (mealIndex === -1) {
    throw new Error(`Meal not found: ${mealId}`);
  }

  const meal = workingDietLog.meals[mealIndex];
  const foodId = generateId('food');

  // Create the new food item
  const newFood: FoodItem = {
    id: foodId,
    name: args.name,
    brand: args.brand,
    source: args.source || 'other',
    servingSize: args.servingSize,
    servingUnit: args.servingUnit,
    macros: {
      calories: args.calories,
      protein: args.protein,
      carbs: args.carbs,
      fat: args.fat
    },
    fiber: args.fiber,
    sugar: args.sugar,
    sodium: args.sodium,
    notes: args.notes,
    loggedAt: new Date().toISOString()
  };

  // Add food to meal
  const updatedMeal = {
    ...meal,
    foods: [...meal.foods, newFood]
  };

  // Update meals array
  const updatedMeals = [...workingDietLog.meals];
  updatedMeals[mealIndex] = updatedMeal;

  // Recalculate all totals
  const updatedDietLog = recalculateDietSummary({
    ...workingDietLog,
    meals: updatedMeals
  });

  return {
    dietLog: updatedDietLog,
    foodId,
    mealId
  };
}
