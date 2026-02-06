/**
 * Handler for update_food tool
 * Updates an existing food item's properties
 */

import type { DietLog, FoodItem } from '@/lib/sessions/types';
import type { UpdateFoodArgs } from '../diet-coach-tools';
import { recalculateDietSummary } from '@/lib/diet/macros';

export interface UpdateFoodResult {
  dietLog: DietLog;
  updated: boolean;
}

/**
 * Update an existing food item
 * Only updates fields that are provided in args
 */
export function handleUpdateFood(
  dietLog: DietLog,
  args: UpdateFoodArgs
): UpdateFoodResult {
  // Find the meal
  const mealIndex = dietLog.meals.findIndex(m => m.id === args.mealId);

  if (mealIndex === -1) {
    console.warn(`[handleUpdateFood] Meal not found: ${args.mealId}`);
    return { dietLog, updated: false };
  }

  const meal = dietLog.meals[mealIndex];

  // Find the food
  const foodIndex = meal.foods.findIndex(f => f.id === args.foodId);

  if (foodIndex === -1) {
    console.warn(`[handleUpdateFood] Food not found: ${args.foodId}`);
    return { dietLog, updated: false };
  }

  const food = meal.foods[foodIndex];

  // Create updated food with only changed fields
  const updatedFood: FoodItem = {
    ...food,
    name: args.name ?? food.name,
    servingSize: args.servingSize ?? food.servingSize,
    servingUnit: args.servingUnit ?? food.servingUnit,
    macros: {
      calories: args.calories ?? food.macros.calories,
      protein: args.protein ?? food.macros.protein,
      carbs: args.carbs ?? food.macros.carbs,
      fat: args.fat ?? food.macros.fat
    },
    fiber: args.fiber !== undefined ? args.fiber : food.fiber,
    sugar: args.sugar !== undefined ? args.sugar : food.sugar,
    sodium: args.sodium !== undefined ? args.sodium : food.sodium,
    notes: args.notes !== undefined ? args.notes : food.notes
  };

  // Update foods array
  const updatedFoods = [...meal.foods];
  updatedFoods[foodIndex] = updatedFood;

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
    updated: true
  };
}
