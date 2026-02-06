"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobType, JobStatus, TrackedType } from "@prisma/client";
import type { HabitLog } from "@/lib/sessions/types";
import { formatHabitLogAsText } from "@/lib/habit/utils";

export interface SaveHabitResult {
  eventId: string;
  jobId: string;
}

/**
 * Save a completed habit session to the database
 * Creates an Event with rawJson and enqueues for interpretation
 */
export async function saveHabitSession(
  habitLog: HabitLog
): Promise<SaveHabitResult> {
  const user = await requireUser();

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId: user.id,
        content: formatHabitLogAsText(habitLog),
        occurredAt: new Date(habitLog.date),
        rawJson: habitLog as object,
        trackedType: TrackedType.HABIT,
      },
    });

    const job = await tx.workerJob.create({
      data: {
        type: JobType.INTERPRET_EVENT,
        payload: { eventId: event.id, userId: user.id },
        status: JobStatus.PENDING,
        userId: user.id,
        idempotencyKey: `interpret:${event.id}`,
      },
    });

    return { eventId: event.id, jobId: job.id };
  });

  return result;
}
