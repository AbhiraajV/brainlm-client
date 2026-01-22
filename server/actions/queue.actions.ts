"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobStatus, JobType } from "@prisma/client";

/**
 * Queue Actions
 * Job status checking for processing visibility.
 */

export interface JobStatusResult {
    status: JobStatus;
    attempts: number;
    lastError: string | null;
    completedAt: Date | null;
}

/**
 * Check the status of a background job.
 * Useful for showing processing status in UI.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResult | null> {
    await requireUser();
    return prisma.workerJob.findUnique({
        where: { id: jobId },
        select: { status: true, attempts: true, lastError: true, completedAt: true }
    });
}

/**
 * Check if an event's interpretation is complete.
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
    await requireUser();
    const job = await prisma.workerJob.findFirst({
        where: {
            type: JobType.INTERPRET_EVENT,
            idempotencyKey: `interpret:${eventId}`,
            status: JobStatus.COMPLETED
        },
        select: { id: true }
    });
    return job !== null;
}
