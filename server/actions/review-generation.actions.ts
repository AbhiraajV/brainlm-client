"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobType, JobStatus, Prisma } from "@prisma/client";

/**
 * Review Generation Actions
 * Manual triggering of review generation (normally cron-triggered at midnight).
 */

/**
 * Manually enqueue a review generation job.
 * Uses idempotency key to prevent duplicate jobs.
 *
 * @param type - Review type (DAILY, WEEKLY, MONTHLY)
 * @param periodKey - Period identifier (e.g., "2024-01-15", "2024-W03", "2024-01")
 * @returns Job ID
 */
export async function enqueueReviewGeneration(
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    periodKey: string
): Promise<string> {
    const user = await requireUser();
    const idempotencyKey = `review:${user.id}:${type}:${periodKey}`;

    try {
        const job = await prisma.workerJob.create({
            data: {
                type: JobType.GENERATE_REVIEW,
                payload: { userId: user.id, type, periodKey, timezone: user.timezone },
                status: JobStatus.PENDING,
                priority: 0,
                maxAttempts: 3,
                userId: user.id,
                idempotencyKey
            },
            select: { id: true }
        });
        return job.id;
    } catch (error) {
        // Handle unique constraint violation (job already exists)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const existing = await prisma.workerJob.findUnique({
                where: { idempotencyKey },
                select: { id: true }
            });
            if (existing) return existing.id;
        }
        throw error;
    }
}
