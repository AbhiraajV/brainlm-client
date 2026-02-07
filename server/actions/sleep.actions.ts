"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobType, JobStatus, TrackedType } from "@prisma/client";

export interface SaveSleepEventResult {
  eventId: string;
  jobId: string;
}

/**
 * Save a sleep event (morning check-in or bedtime log) to the database.
 * Creates an Event with trackedType SLEEP and enqueues for interpretation.
 */
export async function saveSleepEvent(params: {
  content: string;
  eventType: "morning" | "bedtime";
  occurredAt: Date;
}): Promise<SaveSleepEventResult> {
  const user = await requireUser();

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId: user.id,
        content: params.content,
        occurredAt: params.occurredAt,
        trackedType: TrackedType.SLEEP,
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
