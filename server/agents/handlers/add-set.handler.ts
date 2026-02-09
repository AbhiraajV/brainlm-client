/**
 * Handler for add_set tool
 * Adds a set to an exercise and computes PR detection
 */

import type {
  WorkoutLog,
  WorkoutSet,
  PRSummary,
  SetComputed,
  ExerciseComputed,
  WeightUnit
} from '@/lib/sessions/types';
import type { AddSetArgs } from '../gym-coach-tools';
import {
  calculateE1RM,
  calculateSetVolume,
  calculateTotalVolume,
  calculateTotalReps,
  findBestE1RM,
  calculateAverageRPE
} from '@/lib/gym/formulas';
import { convertWeight } from '@/lib/gym/units';

export interface ExercisePRData {
  bestE1RM: number;
  bestWeight: number;
  bestVolume: number;
  date: string;
}

export interface AddSetResult {
  workout: WorkoutLog;
  pr?: PRSummary;
  setNumber: number;
  wasDuplicate?: boolean;
}

/**
 * Recalculate computed fields for an exercise based on its sets
 */
function calculateExerciseComputed(
  sets: WorkoutSet[],
  historicalBest?: ExercisePRData
): ExerciseComputed {
  const totalVolume = calculateTotalVolume(sets);
  const totalReps = calculateTotalReps(sets);
  const bestE1RM = findBestE1RM(sets);

  const computed: ExerciseComputed = {
    totalVolume,
    totalReps,
    bestE1RM
  };

  if (historicalBest) {
    computed.exercisePR = {
      weight: historicalBest.bestWeight,
      reps: 0, // We don't track the reps that achieved the best weight separately
      e1rm: historicalBest.bestE1RM,
      date: historicalBest.date
    };
  }

  return computed;
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

    // Count PRs
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
      totalVolume,
      totalTonnage: totalVolume,
      avgRPE: calculateAverageRPE(workout.exercises.flatMap(e => e.sets)),
      prsThisSession: workout.computed?.prsThisSession ?? []
    }
  };
}

/**
 * Add a set to an exercise
 */
export function handleAddSet(
  workout: WorkoutLog,
  args: AddSetArgs,
  historicalBest?: ExercisePRData
): AddSetResult {
  // Find exercise by ID first, then fall back to name lookup
  let exerciseIndex = -1;

  if (args.exerciseId) {
    exerciseIndex = workout.exercises.findIndex(e => e.id === args.exerciseId);
  }

  // If not found by ID, try by name (strict case-insensitive match only)
  if (exerciseIndex === -1 && args.exerciseName) {
    const searchName = args.exerciseName.toLowerCase().trim();
    exerciseIndex = workout.exercises.findIndex(e =>
      e.exerciseName.toLowerCase().trim() === searchName
    );
  }

  if (exerciseIndex === -1) {
    throw new Error(`Exercise not found: ${args.exerciseId || args.exerciseName}`);
  }

  const exercise = workout.exercises[exerciseIndex];

  // Duplicate guard: reject if last set has same weight+reps and was added < 10 seconds ago
  const lastSet = exercise.sets[exercise.sets.length - 1];
  if (lastSet &&
      lastSet.weight === args.weight &&
      lastSet.actualReps === args.actualReps &&
      lastSet.completedAt) {
    const elapsed = Date.now() - new Date(lastSet.completedAt).getTime();
    if (elapsed < 10_000) { // 10 seconds — parallel tool calls execute in ms
      console.log(`[handleAddSet] Duplicate guard: skipping duplicate set for "${exercise.exerciseName}" (${args.weight}x${args.actualReps}, ${elapsed}ms ago)`);
      return { workout, setNumber: lastSet.setNumber, wasDuplicate: true };
    }
  }

  const setNumber = exercise.sets.length + 1;

  // Normalize to canonical unit (lbs)
  let finalWeight = args.weight;
  let finalUnit: WeightUnit = args.weightUnit as WeightUnit;
  if (finalUnit === 'kg') {
    finalWeight = convertWeight(args.weight, 'kg', 'lbs');
    finalUnit = 'lbs';
  }

  // Calculate computed fields for the new set
  const volume = calculateSetVolume(finalWeight, args.actualReps);
  const e1rm = calculateE1RM(finalWeight, args.actualReps);

  // Detect PRs
  let isPR = false;
  let prType: 'weight' | 'e1rm' | 'volume' | undefined;
  let pr: PRSummary | undefined;

  if (historicalBest) {
    if (e1rm > historicalBest.bestE1RM) {
      isPR = true;
      prType = 'e1rm';
      pr = {
        exerciseName: exercise.exerciseName,
        prType: 'e1rm',
        newValue: e1rm,
        previousValue: historicalBest.bestE1RM,
        improvement: ((e1rm - historicalBest.bestE1RM) / historicalBest.bestE1RM) * 100
      };
    } else if (finalWeight > historicalBest.bestWeight) {
      isPR = true;
      prType = 'weight';
      pr = {
        exerciseName: exercise.exerciseName,
        prType: 'weight',
        newValue: finalWeight,
        previousValue: historicalBest.bestWeight,
        improvement: ((finalWeight - historicalBest.bestWeight) / historicalBest.bestWeight) * 100
      };
    }
  } else {
    // No historical data - NOT a PR, just first recording
    // PRs require actual historical data to compare against
    isPR = false;
    prType = undefined;
    pr = undefined;
    console.log(`[handleAddSet] No historical data for "${exercise.exerciseName}" - not marking as PR`);
  }

  const setComputed: SetComputed = {
    volume,
    e1rm,
    isPR,
    prType,
    previousBest: historicalBest
      ? { value: historicalBest.bestE1RM, date: historicalBest.date }
      : undefined
  };

  // Create the new set (always stored in lbs)
  const newSet: WorkoutSet = {
    setNumber,
    setType: args.setType,
    actualReps: args.actualReps,
    weight: finalWeight,
    weightUnit: finalUnit,
    equipmentType: exercise.equipmentType,
    laterality: args.laterality ?? 'bilateral',
    rpe: args.rpe,
    rir: args.rir,
    notes: args.notes,
    completedAt: new Date().toISOString(),
    computed: setComputed
  };

  // Update exercise with new set
  const updatedSets = [...exercise.sets, newSet];
  const updatedExercise = {
    ...exercise,
    sets: updatedSets,
    computed: calculateExerciseComputed(updatedSets, historicalBest)
  };

  // Update workout
  const updatedExercises = [...workout.exercises];
  updatedExercises[exerciseIndex] = updatedExercise;

  let updatedWorkout: WorkoutLog = {
    ...workout,
    exercises: updatedExercises,
    updatedAt: new Date().toISOString()
  };

  // Track PR in session-level computed if it's a PR
  if (pr) {
    const existingPRs = updatedWorkout.computed?.prsThisSession ?? [];
    updatedWorkout = {
      ...updatedWorkout,
      computed: {
        ...updatedWorkout.computed,
        totalVolume: 0,
        totalTonnage: 0,
        prsThisSession: [...existingPRs, pr]
      }
    };
  }

  // Recalculate workout summary
  updatedWorkout = recalculateWorkoutSummary(updatedWorkout);

  return {
    workout: updatedWorkout,
    pr,
    setNumber
  };
}
