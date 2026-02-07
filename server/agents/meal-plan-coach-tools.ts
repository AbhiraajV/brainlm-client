/**
 * Tool definitions for the Meal Plan Coach AI Agent
 * Single tool: generate_meal_plan for creating personalized diet plans
 */

import type { MealType } from '@/lib/sessions/types';

interface FunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

const MEAL_TYPES = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
  'dinner', 'evening_snack', 'pre_workout', 'post_workout', 'other',
] as const;

const DIET_GOALS = [
  'weight_loss', 'muscle_gain', 'maintenance', 'body_recomp', 'performance', 'health',
] as const;

export const MEAL_PLAN_TOOL: FunctionTool = {
  type: 'function',
  function: {
    name: 'generate_meal_plan',
    description: 'Generate a complete daily meal plan with macro targets and meal-by-meal breakdown. Call this when you have gathered enough information about the user\'s goals, body stats, and preferences.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Plan name (e.g., "Cutting Plan - 1800cal", "Lean Bulk 2800")',
        },
        description: {
          type: 'string',
          description: 'Brief overview of the plan',
        },
        dietGoal: {
          type: 'string',
          enum: DIET_GOALS,
          description: 'The primary diet goal',
        },
        tdee: {
          type: 'number',
          description: 'Calculated TDEE in calories',
        },
        targetCalories: {
          type: 'number',
          description: 'Daily target calories after adjustment (TDEE +/- for goal)',
        },
        proteinPerKg: {
          type: 'number',
          description: 'Protein ratio used (g per kg bodyweight)',
        },
        rationale: {
          type: 'string',
          description: 'Detailed explanation of why these numbers were chosen. Reference the user\'s stats, goal, activity level, and training data.',
        },
        targets: {
          type: 'object',
          properties: {
            calories: { type: 'number' },
            protein: { type: 'number' },
            carbs: { type: 'number' },
            fat: { type: 'number' },
            fiber: { type: 'number' },
          },
          required: ['calories', 'protein', 'carbs', 'fat'],
        },
        meals: {
          type: 'array',
          description: 'List of meals in chronological order',
          items: {
            type: 'object',
            properties: {
              mealType: {
                type: 'string',
                enum: MEAL_TYPES,
                description: 'Type of meal',
              },
              name: {
                type: 'string',
                description: 'Descriptive meal name (e.g., "Pre-Workout: Oats & Banana")',
              },
              time: {
                type: 'string',
                description: 'Suggested time (e.g., "7:00 AM")',
              },
              foods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Food item name' },
                    portion: { type: 'string', description: 'Portion size (e.g., "150g", "2 eggs", "1 cup")' },
                    calories: { type: 'number' },
                    protein: { type: 'number' },
                    carbs: { type: 'number' },
                    fat: { type: 'number' },
                  },
                  required: ['name', 'portion', 'calories', 'protein', 'carbs', 'fat'],
                },
              },
              notes: {
                type: 'string',
                description: 'Tips or alternatives (e.g., "Swap banana for berries if cutting harder")',
              },
            },
            required: ['mealType', 'name', 'foods'],
          },
        },
        bodyStats: {
          type: 'object',
          description: 'Echo back the inferred/provided body stats used for calculation',
          properties: {
            weight: { type: 'number' },
            weightUnit: { type: 'string', enum: ['kg', 'lbs'] },
            height: { type: 'number' },
            heightUnit: { type: 'string', enum: ['cm', 'ft'] },
            age: { type: 'number' },
            gender: { type: 'string', enum: ['male', 'female', 'other'] },
          },
        },
      },
      required: ['name', 'dietGoal', 'tdee', 'targetCalories', 'rationale', 'targets', 'meals'],
    },
  },
};

export const MEAL_PLAN_COACH_TOOLS: FunctionTool[] = [MEAL_PLAN_TOOL];

export interface GenerateMealPlanArgs {
  name: string;
  description?: string;
  dietGoal: string;
  tdee: number;
  targetCalories: number;
  proteinPerKg?: number;
  rationale: string;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  meals: {
    mealType: MealType;
    name: string;
    time?: string;
    foods: {
      name: string;
      portion: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }[];
    notes?: string;
  }[];
  bodyStats?: {
    weight: number;
    weightUnit: string;
    height?: number;
    heightUnit?: string;
    age?: number;
    gender?: string;
  };
}
