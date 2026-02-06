"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobType, JobStatus, TrackedType } from "@prisma/client";
import type { WorkoutLog, MuscleGroup } from "@/lib/sessions/types";

/**
 * Workout Session Actions
 * Save and load workout sessions with full rawJson storage
 */

/**
 * Format a workout log as human-readable text for the event content field
 * This is used for search and display purposes
 */
function formatWorkoutAsText(workout: WorkoutLog): string {
  const lines: string[] = [];

  // Header
  if (workout.workoutName) {
    lines.push(`# ${workout.workoutName}`);
  } else {
    lines.push(`# Workout - ${workout.date}`);
  }
  lines.push('');

  // Muscle groups
  if (workout.muscleGroups.length > 0) {
    lines.push(`**Muscle Groups:** ${workout.muscleGroups.join(', ')}`);
    lines.push('');
  }

  // Exercises
  for (const exercise of workout.exercises) {
    lines.push(`## ${exercise.exerciseName}`);
    lines.push(`*${exercise.muscleGroup}${exercise.secondaryMuscles?.length ? ` + ${exercise.secondaryMuscles.join(', ')}` : ''} | ${exercise.equipmentType}*`);
    lines.push('');

    for (const set of exercise.sets) {
      const setInfo = [
        `Set ${set.setNumber}:`,
        `${set.weight}${set.weightUnit}`,
        `× ${set.actualReps} reps`
      ];

      if (set.rpe) setInfo.push(`@ RPE ${set.rpe}`);
      if (set.rir !== undefined) setInfo.push(`(${set.rir} RIR)`);
      if (set.setType !== 'working') setInfo.push(`[${set.setType}]`);
      if (set.computed?.isPR) setInfo.push('🏆 PR!');

      lines.push(setInfo.join(' '));
    }
    lines.push('');
  }

  // Summary
  lines.push('---');
  lines.push('### Summary');
  lines.push(`- **Exercises:** ${workout.summary.totalExercises}`);
  lines.push(`- **Sets:** ${workout.summary.totalSets}`);
  lines.push(`- **Total Volume:** ${workout.summary.totalVolume.toLocaleString()} ${workout.summary.totalVolumeUnit}`);
  if (workout.summary.prCount > 0) {
    lines.push(`- **PRs:** ${workout.summary.prCount} 🏆`);
  }

  // Notes
  if (workout.notes) {
    lines.push('');
    lines.push('### Notes');
    lines.push(workout.notes);
  }

  // Rating
  if (workout.workoutRating) {
    lines.push('');
    lines.push(`**Rating:** ${'⭐'.repeat(workout.workoutRating)}`);
  }

  return lines.join('\n');
}

export interface SaveWorkoutResult {
  eventId: string;
  jobId: string;
}

/**
 * Save a completed workout session to the database
 * Creates an Event with rawJson and enqueues for interpretation
 *
 * Note: After running Prisma migration, rawJson and trackedType fields will be available.
 * Until then, we store the full workout in the content field as formatted text.
 */
export async function saveWorkoutSession(
  workout: WorkoutLog
): Promise<SaveWorkoutResult> {
  const user = await requireUser();

  // Create Event and WorkerJob atomically
  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId: user.id,
        content: formatWorkoutAsText(workout),
        occurredAt: new Date(workout.date),
        rawJson: workout as object,
        trackedType: TrackedType.GYM,
      },
    });

    // Enqueue interpretation job
    const job = await tx.workerJob.create({
      data: {
        type: JobType.INTERPRET_EVENT,
        payload: { eventId: event.id, userId: user.id },
        status: JobStatus.PENDING,
        userId: user.id,
        idempotencyKey: `interpret:${event.id}`
      }
    });

    return { eventId: event.id, jobId: job.id };
  });

  return result;
}

/**
 * Load a workout session from a saved event
 */
export async function loadWorkoutSession(
  eventId: string
): Promise<WorkoutLog | null> {
  const user = await requireUser();

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      userId: user.id
      // trackedType filter available after migration
    }
  });

  if (!event) return null;

  // rawJson field available after migration
  const rawJson = (event as { rawJson?: unknown }).rawJson;
  if (!rawJson) return null;

  return rawJson as WorkoutLog;
}

/**
 * Get the most recent workout for a user
 * Note: After migration, this will filter by trackedType = GYM
 */
export async function getLatestWorkout(): Promise<WorkoutLog | null> {
  const user = await requireUser();

  // Use raw query to get event with rawJson after migration
  // For now, we just get the most recent event
  const event = await prisma.event.findFirst({
    where: {
      userId: user.id
      // trackedType: TrackedType.GYM - available after migration
    },
    orderBy: {
      occurredAt: 'desc'
    }
  });

  if (!event) return null;

  // rawJson field available after migration
  const rawJson = (event as { rawJson?: unknown }).rawJson;
  if (!rawJson) return null;

  return rawJson as WorkoutLog;
}

/**
 * Get the last workout for a specific muscle group
 */
export async function getLastWorkoutForMuscle(
  muscleGroup: MuscleGroup
): Promise<WorkoutLog | null> {
  const user = await requireUser();

  // Use raw query for JSONB containment check
  const results = await prisma.$queryRaw<Array<{
    id: string;
    rawJson: WorkoutLog;
  }>>`
    SELECT e."id", e."rawJson"
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

  if (results.length === 0) return null;

  return results[0].rawJson;
}

/**
 * Update an existing workout session
 * Used when editing a past workout
 */
export async function updateWorkoutSession(
  eventId: string,
  workout: WorkoutLog
): Promise<{ success: boolean }> {
  const user = await requireUser();

  const updateData: {
    content: string;
    occurredAt: Date;
    rawJson?: object;
  } = {
    content: formatWorkoutAsText(workout),
    occurredAt: new Date(workout.date)
  };

  // rawJson field available after migration
  updateData.rawJson = workout as object;

  await prisma.event.update({
    where: {
      id: eventId,
      userId: user.id
    },
    data: updateData as Parameters<typeof prisma.event.update>[0]['data']
  });

  return { success: true };
}

/**
 * Create a new empty workout log for the current session
 */
export function createEmptyWorkoutLog(
  workoutName?: string,
  preferredUnit: 'kg' | 'lbs' = 'kg'
): WorkoutLog {
  const now = new Date().toISOString();

  return {
    id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    date: now.split('T')[0],
    workoutName,
    muscleGroups: [],
    exercises: [],
    summary: {
      totalExercises: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalVolumeUnit: preferredUnit,
      muscleGroupsWorked: [],
      prCount: 0
    },
    preferredUnit,
    createdAt: now,
    updatedAt: now
  };
}
