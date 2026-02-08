/**
 * Gym Coach Tool Handlers
 * Export all handlers for use in the gym coach agent
 */

export { handleAddExercise } from './add-exercise.handler';
export type { AddExerciseResult } from './add-exercise.handler';

export { handleAddSet } from './add-set.handler';
export type { AddSetResult, ExercisePRData } from './add-set.handler';

export { handleUpdateSet } from './update-set.handler';
export type { UpdateSetResult } from './update-set.handler';

export { handleRemoveSet } from './remove-set.handler';
export type { RemoveSetResult } from './remove-set.handler';

export { handleRemoveExercise } from './remove-exercise.handler';
export type { RemoveExerciseResult } from './remove-exercise.handler';

export { handleRenameExercise } from './rename-exercise.handler';
export type { RenameExerciseResult } from './rename-exercise.handler';

export { handleUpdateWorkout } from './update-workout.handler';
export type { UpdateWorkoutResult } from './update-workout.handler';

export { handleUpdateExerciseNotes } from './update-exercise-notes.handler';
export type { UpdateExerciseNotesResult } from './update-exercise-notes.handler';

/**
 * Diet Coach Tool Handlers
 * Export all handlers for use in the diet coach agent
 */

export { handleAddMeal, getOrCreateMeal } from './add-meal.handler';
export type { AddMealResult } from './add-meal.handler';

export { handleAddFood } from './add-food.handler';
export type { AddFoodResult } from './add-food.handler';

export { handleUpdateFood } from './update-food.handler';
export type { UpdateFoodResult } from './update-food.handler';

export { handleRemoveFood } from './remove-food.handler';
export type { RemoveFoodResult } from './remove-food.handler';

export { handleRemoveMeal } from './remove-meal.handler';
export type { RemoveMealResult } from './remove-meal.handler';

export { handleUpdateMeal } from './update-meal.handler';
export type { UpdateMealResult } from './update-meal.handler';

export { handleUpdateDaily } from './update-daily.handler';
export type { UpdateDailyResult } from './update-daily.handler';
