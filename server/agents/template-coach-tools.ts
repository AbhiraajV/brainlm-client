/**
 * Tool definitions for the Template Coach AI Agent
 * These tools allow the AI to generate workout templates based on conversation
 */

import type { MuscleGroup, EquipmentType, WeightUnit } from '@/lib/sessions/types';

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

// Muscle groups enum values for tool definitions
export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats', 'full_body'
] as const;

// Equipment types enum values
export const EQUIPMENT_TYPES = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'resistance_band', 'smith_machine', 'ez_bar', 'trap_bar', 'other'
] as const;

/**
 * Tool definitions for template generation
 */
export const TEMPLATE_COACH_TOOLS: FunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'generate_workout_template',
      description: 'Generate a complete workout template based on the conversation. Call this when you have gathered enough information about the user\'s goals, time, equipment, and preferences.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Template name (e.g., "Push Day - Strength", "Upper Body Hypertrophy")'
          },
          description: {
            type: 'string',
            description: 'Brief description of the workout focus and goals'
          },
          exercises: {
            type: 'array',
            description: 'List of exercises in order (compound movements first, isolation last)',
            items: {
              type: 'object',
              properties: {
                exerciseName: {
                  type: 'string',
                  description: 'Normalized exercise name with equipment prefix (e.g., "Barbell Bench Press")'
                },
                muscleGroup: {
                  type: 'string',
                  enum: MUSCLE_GROUPS,
                  description: 'Primary muscle group targeted'
                },
                secondaryMuscles: {
                  type: 'array',
                  items: { type: 'string', enum: MUSCLE_GROUPS },
                  description: 'Secondary muscles worked (optional)'
                },
                equipmentType: {
                  type: 'string',
                  enum: EQUIPMENT_TYPES,
                  description: 'Type of equipment used'
                },
                targetSets: {
                  type: 'number',
                  description: 'Number of sets (typically 3-4)'
                },
                targetReps: {
                  type: 'number',
                  description: 'Target reps per set'
                },
                targetWeight: {
                  type: 'number',
                  description: 'Target weight based on user history (optional, omit if unknown)'
                },
                targetWeightUnit: {
                  type: 'string',
                  enum: ['kg', 'lbs'],
                  description: 'Weight unit (default: kg)'
                },
                restSeconds: {
                  type: 'number',
                  description: 'Rest between sets in seconds (optional)'
                },
                notes: {
                  type: 'string',
                  description: 'Form cues or notes (optional)'
                }
              },
              required: ['exerciseName', 'muscleGroup', 'equipmentType', 'targetSets', 'targetReps']
            }
          }
        },
        required: ['name', 'exercises']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_exercise_suggestions',
      description: 'Get exercise suggestions for a specific muscle group or workout type, based on user\'s history',
      parameters: {
        type: 'object',
        properties: {
          muscleGroups: {
            type: 'array',
            items: { type: 'string', enum: MUSCLE_GROUPS },
            description: 'Muscle groups to get suggestions for'
          },
          workoutType: {
            type: 'string',
            enum: ['strength', 'hypertrophy', 'endurance', 'power'],
            description: 'Type of workout goal'
          },
          equipmentAvailable: {
            type: 'array',
            items: { type: 'string', enum: EQUIPMENT_TYPES },
            description: 'Equipment available (optional, defaults to all)'
          },
          limit: {
            type: 'number',
            description: 'Max number of suggestions per muscle group (default: 5)'
          }
        },
        required: ['muscleGroups']
      }
    }
  }
];

/**
 * Generated template exercise type
 */
export interface GeneratedExercise {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipmentType: EquipmentType;
  targetSets: number;
  targetReps: number;
  targetWeight?: number;
  targetWeightUnit?: WeightUnit;
  restSeconds?: number;
  notes?: string;
}

/**
 * Tool argument types
 */
export interface GenerateWorkoutTemplateArgs {
  name: string;
  description?: string;
  exercises: GeneratedExercise[];
}

export interface GetExerciseSuggestionsArgs {
  muscleGroups: MuscleGroup[];
  workoutType?: 'strength' | 'hypertrophy' | 'endurance' | 'power';
  equipmentAvailable?: EquipmentType[];
  limit?: number;
}

export type TemplateCoachToolArgs =
  | { name: 'generate_workout_template'; args: GenerateWorkoutTemplateArgs }
  | { name: 'get_exercise_suggestions'; args: GetExerciseSuggestionsArgs };
