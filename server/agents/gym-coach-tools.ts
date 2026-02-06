/**
 * Tool definitions for the Gym Coach AI Agent
 * These tools allow the AI to modify workout data during conversation
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

// Set types enum values
export const SET_TYPES = [
  'warmup', 'working', 'top', 'backoff', 'dropset', 'superset',
  'rest_pause', 'to_failure', 'forced_reps', 'myo_reps', 'cluster', 'amrap'
] as const;

// Laterality enum values
export const LATERALITY_TYPES = [
  'bilateral', 'unilateral_left', 'unilateral_right', 'alternating'
] as const;

/**
 * Tool definitions for OpenAI function calling
 */
export const GYM_COACH_TOOLS: FunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_exercise',
      description: 'Add a new exercise to the workout with targets based on user history (which you have in your context). When user says "chest day" or similar, create multiple exercises with targets.',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: {
            type: 'string',
            description: 'Normalized exercise name using proper capitalization and equipment prefix (e.g., "Barbell Bench Press", "Dumbbell Curl", "Cable Fly")'
          },
          muscleGroup: {
            type: 'string',
            enum: MUSCLE_GROUPS,
            description: 'Primary muscle group targeted by this exercise'
          },
          secondaryMuscles: {
            type: 'array',
            items: { type: 'string', enum: MUSCLE_GROUPS },
            description: 'Secondary muscles worked by this exercise (optional)'
          },
          equipmentType: {
            type: 'string',
            enum: EQUIPMENT_TYPES,
            description: 'Type of equipment used for this exercise'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the exercise setup or form cues'
          },
          targets: {
            type: 'object',
            description: 'Targets calculated from user history in your context. ALWAYS provide when creating exercise templates.',
            properties: {
              weight: { type: 'number', description: 'Target weight for today based on progressive overload' },
              weightUnit: { type: 'string', enum: ['kg', 'lbs'], description: 'Unit matching user preference' },
              reps: { type: 'number', description: 'Target reps per set' },
              sets: { type: 'number', description: 'Target number of sets (usually 3-4)' },
              rationale: { type: 'string', description: 'Why these targets - reference specific history (e.g., "+2.5kg from last session 80kg x 8,8,7")' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high = 3+ sessions, medium = 1-2 sessions, low = first time' },
              source: { type: 'string', enum: ['history', 'correlation', 'estimation'], description: 'history = exact exercise, correlation = similar exercise, estimation = first time' }
            }
          },
          lastSessionData: {
            type: 'object',
            description: 'Last session data extracted from your context for this exercise',
            properties: {
              date: { type: 'string', description: 'Date of last session (e.g., "Jan 23" or "2024-01-23")' },
              topSet: {
                type: 'object',
                description: 'Best set from last session',
                properties: {
                  weight: { type: 'number' },
                  reps: { type: 'number' }
                }
              }
            }
          }
        },
        required: ['exerciseName', 'muscleGroup', 'equipmentType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_set',
      description: 'Add a set to an existing exercise. Use when user logs weight and reps for an exercise. You can identify the exercise by EITHER exerciseId OR exerciseName.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: {
            type: 'string',
            description: 'ID of the exercise to add the set to (preferred if known)'
          },
          exerciseName: {
            type: 'string',
            description: 'Name of the exercise to add the set to (use this when calling add_exercise + add_set together, or when exerciseId is unknown)'
          },
          weight: {
            type: 'number',
            description: 'Weight used for the set'
          },
          weightUnit: {
            type: 'string',
            enum: ['kg', 'lbs'],
            description: 'Unit of the weight (kg or lbs)'
          },
          actualReps: {
            type: 'number',
            description: 'Number of repetitions completed'
          },
          setType: {
            type: 'string',
            enum: SET_TYPES,
            description: 'Type of set (working, warmup, to_failure, etc.)'
          },
          rpe: {
            type: 'number',
            description: 'Rate of perceived exertion on a scale of 1-10 (optional)'
          },
          rir: {
            type: 'number',
            description: 'Reps in reserve - how many more reps could have been done (optional)'
          },
          laterality: {
            type: 'string',
            enum: LATERALITY_TYPES,
            description: 'Whether the exercise was done bilaterally or unilaterally'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the set (form, fatigue, etc.)'
          }
        },
        required: ['weight', 'weightUnit', 'actualReps', 'setType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_set',
      description: 'Update an existing set. Use when user wants to correct or modify a previously logged set.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: {
            type: 'string',
            description: 'ID of the exercise containing the set'
          },
          setNumber: {
            type: 'number',
            description: 'The set number to update (1-indexed)'
          },
          weight: {
            type: 'number',
            description: 'New weight value (optional, only include if changing)'
          },
          weightUnit: {
            type: 'string',
            enum: ['kg', 'lbs'],
            description: 'Unit of the weight (optional)'
          },
          actualReps: {
            type: 'number',
            description: 'New rep count (optional, only include if changing)'
          },
          setType: {
            type: 'string',
            enum: SET_TYPES,
            description: 'New set type (optional)'
          },
          rpe: {
            type: 'number',
            description: 'New RPE value (optional)'
          },
          rir: {
            type: 'number',
            description: 'New RIR value (optional)'
          },
          notes: {
            type: 'string',
            description: 'New notes (optional)'
          }
        },
        required: ['exerciseId', 'setNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remove_set',
      description: 'Remove a set from an exercise. Use when user wants to delete a logged set.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: {
            type: 'string',
            description: 'ID of the exercise containing the set'
          },
          setNumber: {
            type: 'number',
            description: 'The set number to remove (1-indexed)'
          }
        },
        required: ['exerciseId', 'setNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remove_exercise',
      description: 'Remove an entire exercise from the workout. Use when user wants to delete an exercise they logged by mistake.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: {
            type: 'string',
            description: 'ID of the exercise to remove'
          }
        },
        required: ['exerciseId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename_exercise',
      description: 'Rename an exercise to the correct normalized name. Use when user wants to fix the exercise name or you detect a naming inconsistency.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: {
            type: 'string',
            description: 'ID of the exercise to rename'
          },
          newName: {
            type: 'string',
            description: 'Corrected normalized exercise name'
          },
          muscleGroup: {
            type: 'string',
            enum: MUSCLE_GROUPS,
            description: 'Updated primary muscle group (optional)'
          },
          secondaryMuscles: {
            type: 'array',
            items: { type: 'string', enum: MUSCLE_GROUPS },
            description: 'Updated secondary muscles (optional)'
          },
          equipmentType: {
            type: 'string',
            enum: EQUIPMENT_TYPES,
            description: 'Updated equipment type (optional)'
          }
        },
        required: ['exerciseId', 'newName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_exercise_history',
      description: 'Get historical performance data for an exercise to compare PRs and show progress. Use when you need to reference past performance.',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: {
            type: 'string',
            description: 'Name of the exercise to look up'
          },
          limit: {
            type: 'number',
            description: 'Number of past sessions to retrieve (default: 10)'
          }
        },
        required: ['exerciseName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_workout_notes',
      description: 'Update the overall workout notes or name. Use when user provides general workout context.',
      parameters: {
        type: 'object',
        properties: {
          workoutName: {
            type: 'string',
            description: 'Name for the workout (e.g., "Push Day", "Upper Body")'
          },
          notes: {
            type: 'string',
            description: 'General notes about the workout'
          },
          workoutRating: {
            type: 'number',
            description: 'Overall workout rating from 1-5'
          }
        }
      }
    }
  }
];

/**
 * Tool argument types for TypeScript
 */
export interface AddExerciseArgs {
  exerciseName: string;
  muscleGroup: typeof MUSCLE_GROUPS[number];
  secondaryMuscles?: typeof MUSCLE_GROUPS[number][];
  equipmentType: typeof EQUIPMENT_TYPES[number];
  notes?: string;
  targets?: {
    weight: number;
    weightUnit: 'kg' | 'lbs';
    reps: number;
    sets: number;
    rationale: string;
    confidence?: 'high' | 'medium' | 'low';
    source?: 'history' | 'correlation' | 'estimation';
  };
  lastSessionData?: {
    date: string;
    topSet: {
      weight: number;
      reps: number;
    };
  };
}

export interface AddSetArgs {
  exerciseId?: string;
  exerciseName?: string;
  weight: number;
  weightUnit: 'kg' | 'lbs';
  actualReps: number;
  setType: typeof SET_TYPES[number];
  rpe?: number;
  rir?: number;
  laterality?: typeof LATERALITY_TYPES[number];
  notes?: string;
}

export interface UpdateSetArgs {
  exerciseId: string;
  setNumber: number;
  weight?: number;
  weightUnit?: 'kg' | 'lbs';
  actualReps?: number;
  setType?: typeof SET_TYPES[number];
  rpe?: number;
  rir?: number;
  notes?: string;
}

export interface RemoveSetArgs {
  exerciseId: string;
  setNumber: number;
}

export interface RemoveExerciseArgs {
  exerciseId: string;
}

export interface RenameExerciseArgs {
  exerciseId: string;
  newName: string;
  muscleGroup?: typeof MUSCLE_GROUPS[number];
  secondaryMuscles?: typeof MUSCLE_GROUPS[number][];
  equipmentType?: typeof EQUIPMENT_TYPES[number];
}

export interface GetExerciseHistoryArgs {
  exerciseName: string;
  limit?: number;
}

export interface UpdateWorkoutNotesArgs {
  workoutName?: string;
  notes?: string;
  workoutRating?: number;
}

export type GymCoachToolArgs =
  | { name: 'add_exercise'; args: AddExerciseArgs }
  | { name: 'add_set'; args: AddSetArgs }
  | { name: 'update_set'; args: UpdateSetArgs }
  | { name: 'remove_set'; args: RemoveSetArgs }
  | { name: 'remove_exercise'; args: RemoveExerciseArgs }
  | { name: 'rename_exercise'; args: RenameExerciseArgs }
  | { name: 'get_exercise_history'; args: GetExerciseHistoryArgs }
  | { name: 'update_workout_notes'; args: UpdateWorkoutNotesArgs };
