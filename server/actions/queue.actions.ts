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

// ============================================
// Queue Health Monitoring Actions
// ============================================

export interface QueueStats {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
}

export interface JobTypeStats {
    type: JobType;
    count: number;
    avgDuration: number | null;
    failureRate: number;
}

export interface RecentJob {
    id: string;
    type: JobType;
    status: JobStatus;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    lockedBy: string | null;
}

export interface QueueHealth {
    stats: QueueStats;
    byType: JobTypeStats[];
    recentJobs: RecentJob[];
    oldestPending: Date | null;
    stuckJobs: number;
}

/**
 * Get comprehensive queue health stats
 */
export async function getQueueHealth(): Promise<QueueHealth> {
    await requireUser();

    const [
        statusCounts,
        typeCounts,
        recentJobs,
        oldestPending,
        stuckJobs
    ] = await Promise.all([
        prisma.workerJob.groupBy({
            by: ['status'],
            _count: { id: true }
        }),
        prisma.workerJob.groupBy({
            by: ['type'],
            _count: { id: true },
            _avg: { attempts: true }
        }),
        prisma.workerJob.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                type: true,
                status: true,
                attempts: true,
                maxAttempts: true,
                lastError: true,
                createdAt: true,
                startedAt: true,
                completedAt: true,
                lockedBy: true
            }
        }),
        prisma.workerJob.findFirst({
            where: { status: JobStatus.PENDING },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true }
        }),
        prisma.workerJob.count({
            where: {
                status: JobStatus.PROCESSING,
                lockedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }
            }
        })
    ]);

    // Build stats object
    const stats: QueueStats = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        deadLetter: 0
    };

    for (const row of statusCounts) {
        stats.total += row._count.id;
        switch (row.status) {
            case JobStatus.PENDING: stats.pending = row._count.id; break;
            case JobStatus.PROCESSING: stats.processing = row._count.id; break;
            case JobStatus.COMPLETED: stats.completed = row._count.id; break;
            case JobStatus.FAILED: stats.failed = row._count.id; break;
            case JobStatus.DEAD_LETTER: stats.deadLetter = row._count.id; break;
        }
    }

    // Calculate failure rates by type
    const typeStatsMap = new Map<JobType, { total: number; failed: number }>();

    const failedByType = await prisma.workerJob.groupBy({
        by: ['type'],
        where: { status: { in: [JobStatus.FAILED, JobStatus.DEAD_LETTER] } },
        _count: { id: true }
    });

    for (const row of typeCounts) {
        typeStatsMap.set(row.type, { total: row._count.id, failed: 0 });
    }
    for (const row of failedByType) {
        const existing = typeStatsMap.get(row.type);
        if (existing) existing.failed = row._count.id;
    }

    const byType: JobTypeStats[] = typeCounts.map(row => ({
        type: row.type,
        count: row._count.id,
        avgDuration: null, // Would need completed jobs with timestamps
        failureRate: typeStatsMap.get(row.type)?.failed
            ? (typeStatsMap.get(row.type)!.failed / row._count.id) * 100
            : 0
    }));

    return {
        stats,
        byType,
        recentJobs,
        oldestPending: oldestPending?.createdAt ?? null,
        stuckJobs
    };
}

/**
 * Clear completed jobs older than N days
 */
export async function clearOldCompletedJobs(daysOld: number = 7): Promise<number> {
    await requireUser();

    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.workerJob.deleteMany({
        where: {
            status: JobStatus.COMPLETED,
            completedAt: { lt: cutoff }
        }
    });

    return result.count;
}

/**
 * Retry failed jobs
 */
export async function retryFailedJobs(jobType?: JobType): Promise<number> {
    await requireUser();

    const result = await prisma.workerJob.updateMany({
        where: {
            status: JobStatus.FAILED,
            ...(jobType && { type: jobType })
        },
        data: {
            status: JobStatus.PENDING,
            attempts: 0,
            lastError: null,
            lockedAt: null,
            lockedBy: null
        }
    });

    return result.count;
}

/**
 * Clear dead letter jobs
 */
export async function clearDeadLetterJobs(): Promise<number> {
    await requireUser();

    const result = await prisma.workerJob.deleteMany({
        where: { status: JobStatus.DEAD_LETTER }
    });

    return result.count;
}

/**
 * Unstick stuck jobs (processing for too long)
 */
export async function unstickJobs(minutesStuck: number = 5): Promise<number> {
    await requireUser();

    const cutoff = new Date(Date.now() - minutesStuck * 60 * 1000);

    const result = await prisma.workerJob.updateMany({
        where: {
            status: JobStatus.PROCESSING,
            lockedAt: { lt: cutoff }
        },
        data: {
            status: JobStatus.PENDING,
            lockedAt: null,
            lockedBy: null
        }
    });

    return result.count;
}
