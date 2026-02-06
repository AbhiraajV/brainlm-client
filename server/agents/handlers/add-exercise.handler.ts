/**
 * Handler for add_exercise tool
 * Adds a new exercise to the workout with AI-provided targets and history
 */

import type { WorkoutLog, ExerciseEntry, MuscleGroup, EquipmentType, ExerciseTargets, ExerciseComputed } from '@/lib/sessions/types';
import type { AddExerciseArgs } from '../gym-coach-tools';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../gym-coach-tools';

export interface AddExerciseResult {
  workout: WorkoutLog;
  exerciseId: string;
  alreadyExists: boolean;
}

/**
 * Generate a unique ID for exercises
 */
function generateExerciseId(): string {
  return `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize muscle group - map common aliases to valid enum values
 */
const MUSCLE_GROUP_ALIASES: Record<string, MuscleGroup> = {
  'core': 'abs',
  'abdominals': 'abs',
  'abdominal': 'abs',
  'stomach': 'abs',
  'quads': 'quadriceps',
  'quad': 'quadriceps',
  'hams': 'hamstrings',
  'hamstring': 'hamstrings',
  'glute': 'glutes',
  'butt': 'glutes',
  'calf': 'calves',
  'trap': 'traps',
  'trapezius': 'traps',
  'lat': 'lats',
  'latissimus': 'lats',
  'bicep': 'biceps',
  'tricep': 'triceps',
  'forearm': 'forearms',
  'shoulder': 'shoulders',
  'delts': 'shoulders',
  'deltoids': 'shoulders',
  'pecs': 'chest',
  'pectoral': 'chest',
  'lower back': 'lower_back',
  'lowerback': 'lower_back',
  'erectors': 'lower_back',
  'oblique': 'obliques',
};

function normalizeMuscleGroup(mg: string | undefined): MuscleGroup {
  if (!mg) return 'full_body';
  const lower = mg.toLowerCase().trim();

  // Check if it's already a valid value
  if (MUSCLE_GROUPS.includes(lower as typeof MUSCLE_GROUPS[number])) {
    return lower as MuscleGroup;
  }

  // Check aliases
  if (MUSCLE_GROUP_ALIASES[lower]) {
    return MUSCLE_GROUP_ALIASES[lower];
  }

  // No match - return the original value (will display title-cased)
  // This preserves what the AI actually sent rather than showing "Other"
  return mg as MuscleGroup;
}

/**
 * Normalize equipment type - map common aliases to valid enum values
 */
const EQUIPMENT_ALIASES: Record<string, EquipmentType> = {
  'body weight': 'bodyweight',
  'body': 'bodyweight',
  'bw': 'bodyweight',
  'db': 'dumbbell',
  'dumbbells': 'dumbbell',
  'bb': 'barbell',
  'bar': 'barbell',
  'cables': 'cable',
  'pulley': 'cable',
  'kb': 'kettlebell',
  'kettlebells': 'kettlebell',
  'band': 'resistance_band',
  'bands': 'resistance_band',
  'smith': 'smith_machine',
  'ez': 'ez_bar',
  'ez bar': 'ez_bar',
  'trap': 'trap_bar',
  'hex bar': 'trap_bar',
  'hex': 'trap_bar',
};

function normalizeEquipmentType(et: string | undefined): EquipmentType {
  if (!et) return 'other';
  const lower = et.toLowerCase().trim();

  // Check if it's already a valid value
  if (EQUIPMENT_TYPES.includes(lower as typeof EQUIPMENT_TYPES[number])) {
    return lower as EquipmentType;
  }

  // Check aliases
  if (EQUIPMENT_ALIASES[lower]) {
    return EQUIPMENT_ALIASES[lower];
  }

  // No match - return the original value (will display title-cased)
  // This preserves what the AI actually sent rather than showing "Other"
  return et as EquipmentType;
}

/**
 * Add a new exercise to the workout
 * If an exercise with the same name already exists (case-insensitive), returns the existing one
 * Now accepts AI-provided targets and lastSessionData for template generation
 */
export function handleAddExercise(
  workout: WorkoutLog,
  args: AddExerciseArgs
): AddExerciseResult {
  // Check if exercise already exists (case-insensitive match)
  const existingExercise = workout.exercises.find(
    e => e.exerciseName.toLowerCase() === args.exerciseName.toLowerCase()
  );

  if (existingExercise) {
    // Return existing exercise - don't create duplicate
    console.log(`[handleAddExercise] Exercise "${args.exerciseName}" already exists, returning ID: ${existingExercise.id}`);
    return {
      workout,
      exerciseId: existingExercise.id,
      alreadyExists: true
    };
  }

  const exerciseId = generateExerciseId();

  // Build targets from AI-provided data (AI has history context)
  const targets: ExerciseTargets | undefined = args.targets ? {
    weight: args.targets.weight,
    weightUnit: args.targets.weightUnit || workout.preferredUnit,
    reps: args.targets.reps,
    sets: args.targets.sets,
    rationale: args.targets.rationale,
    confidence: args.targets.confidence || 'medium',
    source: args.targets.source || 'history'
  } : undefined;

  // Build computed with lastSession from AI-provided data
  const computed: ExerciseComputed | undefined = args.lastSessionData ? {
    totalVolume: 0,
    totalReps: 0,
    bestE1RM: 0,
    lastSession: {
      date: args.lastSessionData.date,
      topSet: {
        weight: args.lastSessionData.topSet.weight,
        reps: args.lastSessionData.topSet.reps
      }
    }
  } : undefined;

  // Normalize muscle group and equipment type to handle AI passing aliases
  const normalizedMuscleGroup = normalizeMuscleGroup(args.muscleGroup);
  const normalizedEquipment = normalizeEquipmentType(args.equipmentType);
  const normalizedSecondaryMuscles = args.secondaryMuscles?.map(mg => normalizeMuscleGroup(mg));

  const newExercise: ExerciseEntry = {
    id: exerciseId,
    exerciseName: args.exerciseName,
    muscleGroup: normalizedMuscleGroup,
    secondaryMuscles: normalizedSecondaryMuscles,
    equipmentType: normalizedEquipment,
    sets: [],
    notes: args.notes,
    orderIndex: workout.exercises.length,
    targets,
    computed
  };

  // Add exercise to workout
  const updatedExercises = [...workout.exercises, newExercise];

  // Update muscle groups if not already included
  const muscleGroups = new Set(workout.muscleGroups);
  muscleGroups.add(normalizedMuscleGroup);
  if (normalizedSecondaryMuscles) {
    normalizedSecondaryMuscles.forEach(mg => muscleGroups.add(mg));
  }

  const updatedWorkout: WorkoutLog = {
    ...workout,
    exercises: updatedExercises,
    muscleGroups: Array.from(muscleGroups),
    updatedAt: new Date().toISOString()
  };

  return {
    workout: updatedWorkout,
    exerciseId,
    alreadyExists: false
  };
}
