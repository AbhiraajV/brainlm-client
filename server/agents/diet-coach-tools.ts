/**
 * Tool definitions for the Diet Coach AI Agent
 * These tools allow the AI to modify diet data during conversation
 */

// Tool definition type (compatible with OpenAI)
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

// Meal types enum values for tool definitions
export const MEAL_TYPES = [
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
  'dinner', 'evening_snack', 'pre_workout', 'post_workout', 'other'
] as const;

// Food source enum values
export const FOOD_SOURCES = [
  'homemade', 'restaurant', 'fast_food', 'packaged', 'meal_prep', 'other'
] as const;

// Serving unit enum values
export const SERVING_UNITS = [
  'g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'serving', 'scoop'
] as const;

/**
 * Tool definitions for OpenAI function calling
 */
export const DIET_COACH_TOOLS: FunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_meal',
      description: 'Create a new meal container (breakfast, lunch, dinner, etc.). Call this FIRST before adding foods to a meal that doesn\'t exist yet.',
      parameters: {
        type: 'object',
        properties: {
          mealType: {
            type: 'string',
            enum: MEAL_TYPES,
            description: 'Type of meal (breakfast, lunch, dinner, snack, etc.)'
          },
          time: {
            type: 'string',
            description: 'Time of the meal (e.g., "8:30", "12:00 PM", or ISO timestamp). Optional - will use current time if not provided.'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the meal'
          }
        },
        required: ['mealType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_food',
      description: 'Add a food item with macros to a meal. If the meal doesn\'t exist, it will be created automatically.',
      parameters: {
        type: 'object',
        properties: {
          mealId: {
            type: 'string',
            description: 'ID of the meal to add food to (optional if mealType is provided)'
          },
          mealType: {
            type: 'string',
            enum: MEAL_TYPES,
            description: 'Type of meal to add food to - use this if meal doesn\'t exist or mealId is unknown'
          },
          name: {
            type: 'string',
            description: 'Name of the food item (e.g., "Scrambled Eggs", "Greek Yogurt")'
          },
          brand: {
            type: 'string',
            description: 'Brand name if applicable (e.g., "Chobani", "Kirkland")'
          },
          source: {
            type: 'string',
            enum: FOOD_SOURCES,
            description: 'Source of the food (homemade, restaurant, packaged, etc.)'
          },
          servingSize: {
            type: 'number',
            description: 'Size of the serving (e.g., 150 for 150g)'
          },
          servingUnit: {
            type: 'string',
            enum: SERVING_UNITS,
            description: 'Unit of the serving (g, ml, oz, cup, piece, etc.)'
          },
          calories: {
            type: 'number',
            description: 'Calories in this serving'
          },
          protein: {
            type: 'number',
            description: 'Protein in grams'
          },
          carbs: {
            type: 'number',
            description: 'Carbohydrates in grams'
          },
          fat: {
            type: 'number',
            description: 'Fat in grams'
          },
          fiber: {
            type: 'number',
            description: 'Fiber in grams (optional)'
          },
          sugar: {
            type: 'number',
            description: 'Sugar in grams (optional)'
          },
          sodium: {
            type: 'number',
            description: 'Sodium in mg (optional)'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the food'
          }
        },
        required: ['name', 'servingSize', 'servingUnit', 'calories', 'protein', 'carbs', 'fat']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_food',
      description: 'Modify an existing food item (change servings, macros, etc.).',
      parameters: {
        type: 'object',
        properties: {
          mealId: {
            type: 'string',
            description: 'ID of the meal containing the food'
          },
          foodId: {
            type: 'string',
            description: 'ID of the food to update'
          },
          name: {
            type: 'string',
            description: 'New name for the food (optional)'
          },
          servingSize: {
            type: 'number',
            description: 'New serving size (optional)'
          },
          servingUnit: {
            type: 'string',
            enum: SERVING_UNITS,
            description: 'New serving unit (optional)'
          },
          calories: {
            type: 'number',
            description: 'New calorie value (optional)'
          },
          protein: {
            type: 'number',
            description: 'New protein value (optional)'
          },
          carbs: {
            type: 'number',
            description: 'New carbs value (optional)'
          },
          fat: {
            type: 'number',
            description: 'New fat value (optional)'
          },
          fiber: {
            type: 'number',
            description: 'New fiber value (optional)'
          },
          sugar: {
            type: 'number',
            description: 'New sugar value (optional)'
          },
          sodium: {
            type: 'number',
            description: 'New sodium value (optional)'
          },
          notes: {
            type: 'string',
            description: 'New notes (optional)'
          }
        },
        required: ['mealId', 'foodId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remove_food',
      description: 'Delete a food item from a meal.',
      parameters: {
        type: 'object',
        properties: {
          mealId: {
            type: 'string',
            description: 'ID of the meal containing the food'
          },
          foodId: {
            type: 'string',
            description: 'ID of the food to remove'
          }
        },
        required: ['mealId', 'foodId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remove_meal',
      description: 'Delete an entire meal and all its foods.',
      parameters: {
        type: 'object',
        properties: {
          mealId: {
            type: 'string',
            description: 'ID of the meal to remove'
          }
        },
        required: ['mealId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_meal',
      description: 'Change meal type, time, or notes.',
      parameters: {
        type: 'object',
        properties: {
          mealId: {
            type: 'string',
            description: 'ID of the meal to update'
          },
          mealType: {
            type: 'string',
            enum: MEAL_TYPES,
            description: 'New meal type (optional)'
          },
          time: {
            type: 'string',
            description: 'New time for the meal (optional)'
          },
          notes: {
            type: 'string',
            description: 'New notes (optional)'
          }
        },
        required: ['mealId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_food_history',
      description: 'Query historical nutrition data for a food or meal type. Use this to reference past eating patterns.',
      parameters: {
        type: 'object',
        properties: {
          foodName: {
            type: 'string',
            description: 'Name of the food to look up (optional)'
          },
          mealType: {
            type: 'string',
            enum: MEAL_TYPES,
            description: 'Type of meal to look up (optional)'
          },
          limit: {
            type: 'number',
            description: 'Number of past entries to retrieve (default: 10)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_daily_notes',
      description: 'Set daily notes and water intake tracking.',
      parameters: {
        type: 'object',
        properties: {
          notes: {
            type: 'string',
            description: 'General notes about the day\'s eating'
          },
          waterIntake: {
            type: 'number',
            description: 'Total water intake in ml'
          }
        }
      }
    }
  }
];

/**
 * Tool argument types for TypeScript
 */
export interface AddMealArgs {
  mealType: typeof MEAL_TYPES[number];
  time?: string;
  notes?: string;
}

export interface AddFoodArgs {
  mealId?: string;
  mealType?: typeof MEAL_TYPES[number];
  name: string;
  brand?: string;
  source?: typeof FOOD_SOURCES[number];
  servingSize: number;
  servingUnit: typeof SERVING_UNITS[number];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  notes?: string;
}

export interface UpdateFoodArgs {
  mealId: string;
  foodId: string;
  name?: string;
  servingSize?: number;
  servingUnit?: typeof SERVING_UNITS[number];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  notes?: string;
}

export interface RemoveFoodArgs {
  mealId: string;
  foodId: string;
}

export interface RemoveMealArgs {
  mealId: string;
}

export interface UpdateMealArgs {
  mealId: string;
  mealType?: typeof MEAL_TYPES[number];
  time?: string;
  notes?: string;
}

export interface GetFoodHistoryArgs {
  foodName?: string;
  mealType?: typeof MEAL_TYPES[number];
  limit?: number;
}

export interface UpdateDailyNotesArgs {
  notes?: string;
  waterIntake?: number;
}

export type DietCoachToolArgs =
  | { name: 'add_meal'; args: AddMealArgs }
  | { name: 'add_food'; args: AddFoodArgs }
  | { name: 'update_food'; args: UpdateFoodArgs }
  | { name: 'remove_food'; args: RemoveFoodArgs }
  | { name: 'remove_meal'; args: RemoveMealArgs }
  | { name: 'update_meal'; args: UpdateMealArgs }
  | { name: 'get_food_history'; args: GetFoodHistoryArgs }
  | { name: 'update_daily_notes'; args: UpdateDailyNotesArgs };
