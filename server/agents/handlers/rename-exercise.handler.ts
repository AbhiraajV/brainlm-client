/**
 * Handler for rename_exercise tool
 * Renames an exercise and optionally updates its properties
 */

import type { WorkoutLog, MuscleGroup, EquipmentType } from '@/lib/sessions/types';
import type { RenameExerciseArgs } from '../gym-coach-tools';

export interface RenameExerciseResult {
  workout: WorkoutLog;
  renamed: boolean;
  oldName: string;
  newName: string;
}

/**
 * Rename an exercise and optionally update its properties
 */
export function handleRenameExercise(
  workout: WorkoutLog,
  args: RenameExerciseArgs
): RenameExerciseResult {
  const exerciseIndex = workout.exercises.findIndex(e => e.id === args.exerciseId);
  if (exerciseIndex === -1) {
    throw new Error(`Exercise not found: ${args.exerciseId}`);
  }

  const exercise = workout.exercises[exerciseIndex];
  const oldName = exercise.exerciseName;

  // Update the exercise
  const updatedExercise = {
    ...exercise,
    exerciseName: args.newName,
    muscleGroup: (args.muscleGroup ?? exercise.muscleGroup) as MuscleGroup,
    secondaryMuscles: args.secondaryMuscles
      ? (args.secondaryMuscles as MuscleGroup[])
      : exercise.secondaryMuscles,
    equipmentType: (args.equipmentType ?? exercise.equipmentType) as EquipmentType
  };

  // Update workout
  const updatedExercises = [...workout.exercises];
  updatedExercises[exerciseIndex] = updatedExercise;

  // Recalculate muscle groups
  const muscleGroups = new Set<MuscleGroup>();
  for (const ex of updatedExercises) {
    muscleGroups.add(ex.muscleGroup);
    if (ex.secondaryMuscles) {
      ex.secondaryMuscles.forEach(mg => muscleGroups.add(mg));
    }
  }

  // Update any PRs with the new exercise name
  let prsThisSession = workout.computed?.prsThisSession ?? [];
  prsThisSession = prsThisSession.map(pr =>
    pr.exerciseName === oldName
      ? { ...pr, exerciseName: args.newName }
      : pr
  );

  const updatedWorkout: WorkoutLog = {
    ...workout,
    exercises: updatedExercises,
    muscleGroups: Array.from(muscleGroups),
    updatedAt: new Date().toISOString(),
    summary: {
      ...workout.summary,
      muscleGroupsWorked: Array.from(muscleGroups)
    },
    computed: workout.computed
      ? {
          ...workout.computed,
          prsThisSession
        }
      : undefined
  };

  return {
    workout: updatedWorkout,
    renamed: true,
    oldName,
    newName: args.newName
  };
}
