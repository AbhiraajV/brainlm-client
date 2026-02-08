"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { calculateE1RM } from "@/lib/gym/formulas";
import type { WorkoutLog, MuscleGroup, WeightUnit } from "@/lib/sessions/types";
import type { ExercisePRData } from "@/server/agents/handlers";

/**
 * Gym History Actions
 * Query historical workout data from rawJson field for PR detection and progress tracking
 *
 * NOTE: Server-side GymDataCache has been removed. PR queries now always use
 * direct database queries. Client-side caching is handled via Zustand/localStorage.
 *
 * IMPORTANT: These queries require the database migration to be run first.
 * The migration adds:
 * - rawJson (Json?) field to Event table
 * - trackedType (TrackedType?) enum field to Event table
 * - Indexes for trackedType queries
 *
 * Run: npx prisma migrate dev
 */

// ============================================================================
// PUBLIC API
// ============================================================================

export interface ExerciseHistoryEntry {
  date: string;
  exerciseName: string;
  sets: {
    weight: number;
    reps: number;
    e1rm: number;
  }[];
  bestE1RM: number;
  bestWeight: number;
  totalVolume: number;
}

export interface WorkoutSummary {
  id: string;
  date: string;
  workoutName?: string;
  muscleGroups: MuscleGroup[];
  exerciseCount: number;
  totalSets: number;
  totalVolume: number;
  prCount: number;
  templateId?: string;
  templateDayId?: string;
}

/**
 * Query the best historical PR for an exercise
 * Uses direct database queries on Event.rawJson
 * Supports dual-lookup: exerciseRegistryId (preferred) + name fallback
 */
export async function queryExercisePR(
  exerciseName: string,
  exerciseRegistryId?: string
): Promise<ExercisePRData | null> {
  const user = await requireUser();
  const nameLower = exerciseName.toLowerCase();

  // Query all past gym events with this exercise using JSONB (dual-lookup)
  const results = await prisma.$queryRaw<Array<{
    occurredAt: Date;
    rawJson: WorkoutLog;
  }>>`
    SELECT
      e."occurredAt",
      e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(e."rawJson"->'exercises') as ex
        WHERE (
          (${exerciseRegistryId ?? ''}::text != '' AND ex->>'exerciseRegistryId' = ${exerciseRegistryId ?? ''})
          OR lower(ex->>'exerciseName') = ${nameLower}
        )
      )
    ORDER BY e."occurredAt" DESC
    LIMIT 50
  `;

  if (results.length === 0) return null;

  // Find best E1RM across all historical sets
  let bestE1RM = 0;
  let bestWeight = 0;
  let bestVolume = 0;
  let bestDate = '';

  for (const session of results) {
    const workout = session.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      const matchesId = exerciseRegistryId && exercise.exerciseRegistryId === exerciseRegistryId;
      const matchesName = exercise.exerciseName.toLowerCase() === nameLower;
      if (!matchesId && !matchesName) continue;

      for (const set of exercise.sets) {
        const e1rm = calculateE1RM(set.weight, set.actualReps);
        const volume = set.weight * set.actualReps;

        if (e1rm > bestE1RM) {
          bestE1RM = e1rm;
          bestDate = session.occurredAt.toISOString();
        }
        if (set.weight > bestWeight) {
          bestWeight = set.weight;
        }
        if (volume > bestVolume) {
          bestVolume = volume;
        }
      }
    }
  }

  if (bestE1RM === 0) return null;

  return {
    bestE1RM,
    bestWeight,
    bestVolume,
    date: bestDate
  };
}

/**
 * Get exercise history for progress tracking
 * Returns the last N sessions where this exercise was performed
 * Supports dual-lookup: exerciseRegistryId (preferred) + name fallback
 */
export async function getExerciseHistory(
  exerciseName: string,
  limit: number = 10,
  exerciseRegistryId?: string
): Promise<ExerciseHistoryEntry[]> {
  const user = await requireUser();
  const nameLower = exerciseName.toLowerCase();

  const results = await prisma.$queryRaw<Array<{
    occurredAt: Date;
    rawJson: WorkoutLog;
  }>>`
    SELECT
      e."occurredAt",
      e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(e."rawJson"->'exercises') as ex
        WHERE (
          (${exerciseRegistryId ?? ''}::text != '' AND ex->>'exerciseRegistryId' = ${exerciseRegistryId ?? ''})
          OR lower(ex->>'exerciseName') = ${nameLower}
        )
      )
    ORDER BY e."occurredAt" DESC
    LIMIT ${limit}
  `;

  const history: ExerciseHistoryEntry[] = [];

  for (const session of results) {
    const workout = session.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      const matchesId = exerciseRegistryId && exercise.exerciseRegistryId === exerciseRegistryId;
      const matchesName = exercise.exerciseName.toLowerCase() === nameLower;
      if (!matchesId && !matchesName) continue;

      const sets = exercise.sets.map(set => ({
        weight: set.weight,
        reps: set.actualReps,
        e1rm: calculateE1RM(set.weight, set.actualReps)
      }));

      const bestE1RM = Math.max(...sets.map(s => s.e1rm), 0);
      const bestWeight = Math.max(...sets.map(s => s.weight), 0);
      const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

      history.push({
        date: session.occurredAt.toISOString(),
        exerciseName: exercise.exerciseName,
        sets,
        bestE1RM,
        bestWeight,
        totalVolume
      });
    }
  }

  return history;
}

/**
 * Get recent workouts for a user
 * Optionally filtered by muscle group
 */
export async function getRecentWorkouts(
  muscleGroup?: MuscleGroup,
  limit: number = 10
): Promise<WorkoutSummary[]> {
  const user = await requireUser();

  let results: Array<{
    id: string;
    occurredAt: Date;
    rawJson: WorkoutLog;
  }>;

  if (muscleGroup) {
    results = await prisma.$queryRaw`
      SELECT
        e."id",
        e."occurredAt",
        e."rawJson"
      FROM "Event" e
      WHERE e."userId" = ${user.id}
        AND e."trackedType" = 'GYM'
        AND e."rawJson" IS NOT NULL
        AND (
          e."rawJson"->'muscleGroups' ? ${muscleGroup}
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(e."rawJson"->'exercises') as ex
            WHERE ex->>'muscleGroup' = ${muscleGroup}
          )
        )
      ORDER BY e."occurredAt" DESC
      LIMIT ${limit}
    `;
  } else {
    results = await prisma.$queryRaw`
      SELECT
        e."id",
        e."occurredAt",
        e."rawJson"
      FROM "Event" e
      WHERE e."userId" = ${user.id}
        AND e."trackedType" = 'GYM'
        AND e."rawJson" IS NOT NULL
      ORDER BY e."occurredAt" DESC
      LIMIT ${limit}
    `;
  }

  return results.map(session => {
    const workout = session.rawJson;
    return {
      id: session.id,
      date: session.occurredAt.toISOString(),
      workoutName: workout?.workoutName,
      muscleGroups: workout?.muscleGroups ?? [],
      exerciseCount: workout?.exercises?.length ?? 0,
      totalSets: workout?.summary?.totalSets ?? 0,
      totalVolume: workout?.summary?.totalVolume ?? 0,
      prCount: workout?.summary?.prCount ?? 0,
      templateId: workout?.templateId,
      templateDayId: workout?.templateDayId,
    };
  });
}

/**
 * Get all unique exercise names the user has logged
 * Useful for autocomplete in the UI
 */
export async function getExerciseNames(): Promise<string[]> {
  const user = await requireUser();

  const results = await prisma.$queryRaw<Array<{ exerciseName: string }>>`
    SELECT DISTINCT ex->>'exerciseName' as "exerciseName"
    FROM "Event" e,
    jsonb_array_elements(e."rawJson"->'exercises') as ex
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
    ORDER BY "exerciseName"
  `;

  return results.map(r => r.exerciseName).filter(Boolean);
}

/**
 * Get days since a muscle group was last trained
 * Used for recovery recommendations
 */
export async function getDaysSinceMuscleGroup(
  muscleGroup: MuscleGroup
): Promise<number | null> {
  const user = await requireUser();

  const result = await prisma.$queryRaw<Array<{ occurredAt: Date }>>`
    SELECT e."occurredAt"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
      AND (
        e."rawJson"->'muscleGroups' ? ${muscleGroup}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(e."rawJson"->'exercises') as ex
          WHERE ex->>'muscleGroup' = ${muscleGroup}
        )
      )
    ORDER BY e."occurredAt" DESC
    LIMIT 1
  `;

  if (result.length === 0) return null;

  const lastWorkout = result[0].occurredAt;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastWorkout.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get weekly volume for a muscle group
 * Used for volume tracking and overtraining prevention
 */
export async function getWeeklyVolumeByMuscle(): Promise<Partial<Record<MuscleGroup, number>>> {
  const user = await requireUser();

  // Get workouts from the last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const results = await prisma.$queryRaw<Array<{
    rawJson: WorkoutLog;
  }>>`
    SELECT e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
      AND e."occurredAt" >= ${oneWeekAgo}
  `;

  const volumeByMuscle: Partial<Record<MuscleGroup, number>> = {};

  for (const session of results) {
    const workout = session.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      const volume = exercise.sets.reduce(
        (sum, set) => sum + set.weight * set.actualReps,
        0
      );

      // Add to primary muscle group
      volumeByMuscle[exercise.muscleGroup] =
        (volumeByMuscle[exercise.muscleGroup] ?? 0) + volume;

      // Add partial volume to secondary muscles (50%)
      if (exercise.secondaryMuscles) {
        for (const secondary of exercise.secondaryMuscles) {
          volumeByMuscle[secondary] =
            (volumeByMuscle[secondary] ?? 0) + volume * 0.5;
        }
      }
    }
  }

  return volumeByMuscle;
}

// ============================================================================
// SESSION INSIGHTS (past coaching notes from rawJson.notes)
// ============================================================================

export interface SessionInsightEntry {
  date: string;
  workoutName?: string;
  insight: string;
  exerciseNames: string[];
}

/**
 * Get recent session insights (coaching notes) from past gym sessions.
 * Returns insights with exercise names so they can be grouped by exercise in the prompt.
 */
export async function getRecentSessionInsights(
  limit: number = 10
): Promise<SessionInsightEntry[]> {
  const user = await requireUser();

  const results = await prisma.$queryRaw<Array<{
    occurredAt: Date;
    rawJson: WorkoutLog;
  }>>`
    SELECT e."occurredAt", e."rawJson"
    FROM "Event" e
    WHERE e."userId" = ${user.id}
      AND e."trackedType" = 'GYM'
      AND e."rawJson" IS NOT NULL
      AND e."rawJson"->>'notes' IS NOT NULL
      AND e."rawJson"->>'notes' != ''
    ORDER BY e."occurredAt" DESC
    LIMIT ${limit}
  `;

  return results.map(r => ({
    date: r.occurredAt.toISOString().split('T')[0],
    workoutName: r.rawJson?.workoutName,
    insight: r.rawJson?.notes || '',
    exerciseNames: (r.rawJson?.exercises || []).map(ex => ex.exerciseName),
  }));
}

// ============================================================================
// EXERCISE TARGETS FOR WORKOUT PICKER
// ============================================================================

export interface ExerciseTargetResult {
  exerciseName: string;
  lastSession: {
    date: string;
    sets: { weight: number; reps: number }[];
  } | null;
  suggestedTargets: {
    weight: number;
    weightUnit: WeightUnit;
    reps: number;
    sets: number;
    rationale: string;
    confidence: 'high' | 'medium' | 'low';
    source: string;
  } | null;
}

/**
 * Get history-based targets for a list of exercises.
 * Used by WorkoutPicker to pre-populate targets when starting from a plan day.
 * Uses dual-lookup (registryId + name) and progressive overload logic.
 */
export async function getExerciseTargetsForDay(
  exercises: Array<{ name: string; registryId?: string }>
): Promise<ExerciseTargetResult[]> {
  await requireUser();

  const results: ExerciseTargetResult[] = [];

  for (const ex of exercises) {
    const history = await getExerciseHistory(ex.name, 5, ex.registryId);

    if (history.length === 0) {
      results.push({
        exerciseName: ex.name,
        lastSession: null,
        suggestedTargets: null,
      });
      continue;
    }

    const lastSession = history[0];
    const lastSets = lastSession.sets;

    // Determine confidence based on session count
    const confidence: 'high' | 'medium' | 'low' =
      history.length >= 3 ? 'high' : history.length >= 1 ? 'medium' : 'low';

    // Progressive overload logic
    const topSet = lastSets.reduce(
      (best, s) => (s.weight > best.weight ? s : best),
      lastSets[0]
    );

    // Check if all reps were hit (using average reps vs target)
    const avgReps = lastSets.reduce((sum, s) => sum + s.reps, 0) / lastSets.length;
    const allRepsHit = avgReps >= topSet.reps;

    let suggestedWeight = topSet.weight;
    let suggestedReps = topSet.reps;
    let rationale: string;

    if (allRepsHit) {
      // Progress: small weight increase
      suggestedWeight = Math.round((topSet.weight + 2.5) * 2) / 2; // Round to 0.5
      rationale = `Hit ${topSet.reps} reps at ${topSet.weight}kg — try +2.5kg`;
    } else {
      // Repeat same weight, aim for more reps
      suggestedWeight = topSet.weight;
      suggestedReps = topSet.reps;
      rationale = `Missed reps at ${topSet.weight}kg — repeat and aim for all reps`;
    }

    results.push({
      exerciseName: ex.name,
      lastSession: {
        date: lastSession.date,
        sets: lastSession.sets.map((s) => ({ weight: s.weight, reps: s.reps })),
      },
      suggestedTargets: {
        weight: suggestedWeight,
        weightUnit: 'kg' as WeightUnit,
        reps: suggestedReps,
        sets: lastSets.length || 3,
        rationale,
        confidence,
        source: 'history',
      },
    });
  }

  return results;
}
