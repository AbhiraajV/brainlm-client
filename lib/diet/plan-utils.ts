/**
 * Diet plan calculation utilities
 * TDEE estimation and macro target calculation
 */

import type { DietGoal, ActivityLevel, DietStyle, DailyTargets } from '@/lib/sessions/types';

/**
 * Calculate TDEE using Mifflin-St Jeor equation
 * @param weightKg Weight in kg
 * @param heightCm Height in cm
 * @param age Age in years
 * @param gender 'male' | 'female'
 * @param activityLevel Activity multiplier category
 */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | 'other',
  activityLevel: ActivityLevel
): number {
  // Mifflin-St Jeor BMR
  let bmr: number;
  if (gender === 'female') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    // male or other defaults to male equation
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }

  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };

  return Math.round(bmr * multipliers[activityLevel]);
}

/**
 * Calculate daily macro targets based on TDEE, goal, diet style, and body weight
 */
export function calculateMacroTargets(
  tdee: number,
  goal: DietGoal,
  dietStyle: DietStyle,
  weightKg: number
): DailyTargets {
  // Step 1: Calculate target calories based on goal
  let targetCalories: number;
  let proteinPerKg: number;

  switch (goal) {
    case 'weight_loss':
      targetCalories = tdee - 400; // moderate deficit
      proteinPerKg = 2.0;
      break;
    case 'muscle_gain':
      targetCalories = tdee + 250;
      proteinPerKg = 1.8;
      break;
    case 'maintenance':
      targetCalories = tdee;
      proteinPerKg = 1.6;
      break;
    case 'body_recomp':
      targetCalories = tdee - 150;
      proteinPerKg = 2.2;
      break;
    case 'performance':
      targetCalories = tdee + 100;
      proteinPerKg = 1.8;
      break;
    case 'health':
      targetCalories = tdee;
      proteinPerKg = 1.4;
      break;
    default:
      targetCalories = tdee;
      proteinPerKg = 1.6;
  }

  // Step 2: Calculate protein (fixed by body weight)
  const protein = Math.round(weightKg * proteinPerKg);
  const proteinCalories = protein * 4;

  // Step 3: Distribute remaining calories between carbs and fat based on diet style
  const remainingCalories = targetCalories - proteinCalories;

  let carbPercent: number;
  let fatPercent: number;

  switch (dietStyle) {
    case 'keto':
      carbPercent = 0.1;
      fatPercent = 0.9;
      break;
    case 'low_carb':
      carbPercent = 0.3;
      fatPercent = 0.7;
      break;
    case 'high_carb':
      carbPercent = 0.7;
      fatPercent = 0.3;
      break;
    case 'high_protein':
      // Already handled by proteinPerKg, balance the rest
      carbPercent = 0.55;
      fatPercent = 0.45;
      break;
    case 'balanced':
    case 'flexible':
    default:
      carbPercent = 0.55;
      fatPercent = 0.45;
      break;
  }

  const carbs = Math.round((remainingCalories * carbPercent) / 4);
  const fat = Math.round((remainingCalories * fatPercent) / 9);

  // Recalculate actual calories from macros for consistency
  const actualCalories = protein * 4 + carbs * 4 + fat * 9;

  return {
    calories: Math.round(actualCalories),
    protein,
    carbs,
    fat,
    fiber: 25,
  };
}

/**
 * Extract DailyTargets from a MealPlan for use in a diet session
 */
export function mealPlanToTargets(targets: DailyTargets): DailyTargets {
  return { ...targets };
}

/**
 * Convert weight to kg
 */
export function toKg(weight: number, unit: 'kg' | 'lbs'): number {
  return unit === 'lbs' ? weight * 0.453592 : weight;
}

/**
 * Convert height to cm
 */
export function toCm(height: number, unit: 'cm' | 'ft'): number {
  return unit === 'ft' ? height * 30.48 : height;
}
