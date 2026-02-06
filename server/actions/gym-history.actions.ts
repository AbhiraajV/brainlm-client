"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { calculateE1RM } from "@/lib/gym/formulas";
import type { WorkoutLog, MuscleGroup } from "@/lib/sessions/types";
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
}

/**
 * Query the best historical PR for an exercise
 * Uses direct database queries on Event.rawJson
 */
export async function queryExercisePR(
  exerciseName: string
): Promise<ExercisePRData | null> {
  const user = await requireUser();

  // Query all past gym events with this exercise using JSONB
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
        WHERE lower(ex->>'exerciseName') = ${exerciseName.toLowerCase()}
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
      if (exercise.exerciseName.toLowerCase() !== exerciseName.toLowerCase()) continue;

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
 */
export async function getExerciseHistory(
  exerciseName: string,
  limit: number = 10
): Promise<ExerciseHistoryEntry[]> {
  const user = await requireUser();

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
        WHERE lower(ex->>'exerciseName') = ${exerciseName.toLowerCase()}
      )
    ORDER BY e."occurredAt" DESC
    LIMIT ${limit}
  `;

  const history: ExerciseHistoryEntry[] = [];

  for (const session of results) {
    const workout = session.rawJson;
    if (!workout?.exercises) continue;

    for (const exercise of workout.exercises) {
      if (exercise.exerciseName.toLowerCase() !== exerciseName.toLowerCase()) continue;

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
      prCount: workout?.summary?.prCount ?? 0
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
