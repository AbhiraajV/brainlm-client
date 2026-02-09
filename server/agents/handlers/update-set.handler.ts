/**
 * Handler for update_set tool
 * Updates an existing set in an exercise
 */

import type { WorkoutLog, WeightUnit } from '@/lib/sessions/types';
import type { UpdateSetArgs } from '../gym-coach-tools';
import {
  calculateE1RM,
  calculateSetVolume,
  calculateTotalVolume,
  calculateTotalReps,
  findBestE1RM,
  calculateAverageRPE
} from '@/lib/gym/formulas';
import { convertWeight } from '@/lib/gym/units';
import type { ExercisePRData } from './add-set.handler';

export interface UpdateSetResult {
  workout: WorkoutLog;
  updated: boolean;
}

/**
 * Recalculate workout summary based on all exercises
 */
function recalculateWorkoutSummary(workout: WorkoutLog): WorkoutLog {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let prCount = 0;
  const muscleGroupsWorked = new Set(workout.muscleGroups);

  for (const exercise of workout.exercises) {
    totalSets += exercise.sets.length;
    totalReps += calculateTotalReps(exercise.sets);
    totalVolume += calculateTotalVolume(exercise.sets);

    for (const set of exercise.sets) {
      if (set.computed?.isPR) {
        prCount++;
      }
    }

    muscleGroupsWorked.add(exercise.muscleGroup);
    if (exercise.secondaryMuscles) {
      exercise.secondaryMuscles.forEach(mg => muscleGroupsWorked.add(mg));
    }
  }

  return {
    ...workout,
    muscleGroups: Array.from(muscleGroupsWorked),
    summary: {
      totalExercises: workout.exercises.length,
      totalSets,
      totalReps,
      totalVolume,
      totalVolumeUnit: workout.preferredUnit,
      muscleGroupsWorked: Array.from(muscleGroupsWorked),
      prCount
    },
    computed: {
      ...workout.computed,
      totalVolume,
      totalTonnage: totalVolume,
      avgRPE: calculateAverageRPE(workout.exercises.flatMap(e => e.sets)),
      prsThisSession: workout.computed?.prsThisSession ?? []
    }
  };
}

/**
 * Update an existing set in an exercise
 */
export function handleUpdateSet(
  workout: WorkoutLog,
  args: UpdateSetArgs,
  historicalBest?: ExercisePRData
): UpdateSetResult {
  const exerciseIndex = workout.exercises.findIndex(e => e.id === args.exerciseId);
  if (exerciseIndex === -1) {
    throw new Error(`Exercise not found: ${args.exerciseId}`);
  }

  const exercise = workout.exercises[exerciseIndex];
  const setIndex = args.setNumber - 1; // Convert to 0-indexed

  if (setIndex < 0 || setIndex >= exercise.sets.length) {
    throw new Error(`Set number ${args.setNumber} not found in exercise`);
  }

  const existingSet = exercise.sets[setIndex];

  // Normalize incoming weight to canonical unit (lbs) if needed
  let incomingWeight = args.weight ?? existingSet.weight;
  let incomingUnit = (args.weightUnit ?? existingSet.weightUnit) as WeightUnit;
  if (args.weight != null && incomingUnit === 'kg') {
    incomingWeight = convertWeight(incomingWeight, 'kg', 'lbs');
    incomingUnit = 'lbs';
  }

  // Apply updates
  const updatedSet = {
    ...existingSet,
    weight: incomingWeight,
    weightUnit: incomingUnit,
    actualReps: args.actualReps ?? existingSet.actualReps,
    setType: args.setType ?? existingSet.setType,
    rpe: args.rpe ?? existingSet.rpe,
    rir: args.rir ?? existingSet.rir,
    notes: args.notes ?? existingSet.notes
  };

  // Recalculate computed fields
  const volume = calculateSetVolume(updatedSet.weight, updatedSet.actualReps);
  const e1rm = calculateE1RM(updatedSet.weight, updatedSet.actualReps);

  // Check for PR (only if we have historical data and this wasn't already marked)
  let isPR = false;
  let prType: 'weight' | 'e1rm' | 'volume' | undefined;

  if (historicalBest && e1rm > historicalBest.bestE1RM) {
    isPR = true;
    prType = 'e1rm';
  }

  updatedSet.computed = {
    volume,
    e1rm,
    isPR,
    prType,
    previousBest: historicalBest
      ? { value: historicalBest.bestE1RM, date: historicalBest.date }
      : undefined
  };

  // Update the sets array
  const updatedSets = [...exercise.sets];
  updatedSets[setIndex] = updatedSet;

  // Recalculate exercise computed fields
  const updatedExercise = {
    ...exercise,
    sets: updatedSets,
    computed: {
      totalVolume: calculateTotalVolume(updatedSets),
      totalReps: calculateTotalReps(updatedSets),
      bestE1RM: findBestE1RM(updatedSets),
      exercisePR: historicalBest
        ? {
            weight: historicalBest.bestWeight,
            reps: 0,
            e1rm: historicalBest.bestE1RM,
            date: historicalBest.date
          }
        : undefined
    }
  };

  // Update workout
  const updatedExercises = [...workout.exercises];
  updatedExercises[exerciseIndex] = updatedExercise;

  let updatedWorkout: WorkoutLog = {
    ...workout,
    exercises: updatedExercises,
    updatedAt: new Date().toISOString()
  };

  // Recalculate workout summary
  updatedWorkout = recalculateWorkoutSummary(updatedWorkout);

  return {
    workout: updatedWorkout,
    updated: true
  };
}
