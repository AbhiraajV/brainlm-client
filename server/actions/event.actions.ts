"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { JobType, JobStatus } from "@prisma/client";

/**
 * Event Actions
 * No userId passed from client.
 */

export interface CreateEventInput {
    content: string;
    occurredAt?: Date;
}

export interface CreateEventResult {
    event: {
        id: string;
        content: string;
        createdAt: Date;
        occurredAt: Date;
    };
    jobId: string;
}

export async function getById(id: string) {
    const user = await requireUser();
    return prisma.event.findFirst({
        where: { id, userId: user.id },
    });
}

export async function getMany(limit = 20) {
    const user = await requireUser();
    return prisma.event.findMany({
        where: { userId: user.id },
        take: limit,
        orderBy: { occurredAt: 'desc' },
    });
}

export async function getForCurrentUser() {
    return getMany();
}

/**
 * Create an event and enqueue it for interpretation processing.
 * Uses a transaction to ensure atomic creation of event + worker job.
 */
/**
 * Manually enqueue an existing event for interpretation processing.
 * Use this to fix events that were created without being enqueued.
 * TEMPORARY: Remove after fixing all orphaned events.
 */
export async function enqueueEvent(eventId: string): Promise<{ success: true; jobId: string } | { success: false; error: string }> {
    const user = await requireUser();

    // Verify the event exists and belongs to the user
    const event = await prisma.event.findFirst({
        where: { id: eventId, userId: user.id },
        select: { id: true },
    });

    if (!event) {
        return { success: false, error: 'Event not found' };
    }

    // Check if a job already exists for this event
    const existingJob = await prisma.workerJob.findFirst({
        where: {
            type: JobType.INTERPRET_EVENT,
            idempotencyKey: `interpret:${eventId}`,
        },
        select: { id: true, status: true },
    });

    if (existingJob) {
        return { success: false, error: `Job already exists (status: ${existingJob.status})` };
    }

    // Create the worker job
    const job = await prisma.workerJob.create({
        data: {
            type: JobType.INTERPRET_EVENT,
            payload: { eventId, userId: user.id },
            status: JobStatus.PENDING,
            priority: 0,
            maxAttempts: 3,
            userId: user.id,
            idempotencyKey: `interpret:${eventId}`,
        },
        select: { id: true },
    });

    return { success: true, jobId: job.id };
}

export async function createEvent({ content, occurredAt }: CreateEventInput): Promise<CreateEventResult> {
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
        const event = await tx.event.create({
            data: {
                userId: user.id,
                content,
                occurredAt: occurredAt ?? new Date(),
            },
            select: {
                id: true,
                content: true,
                createdAt: true,
                occurredAt: true,
            }
        });

        const job = await tx.workerJob.create({
            data: {
                type: JobType.INTERPRET_EVENT,
                payload: { eventId: event.id, userId: user.id },
                status: JobStatus.PENDING,
                priority: 0,
                maxAttempts: 3,
                userId: user.id,
                idempotencyKey: `interpret:${event.id}`,
            },
            select: { id: true }
        });

        return { event, jobId: job.id };
    });

    return result;
}

export type DateFilter = {
    from?: string
    to?: string
}

export async function getEventsPage({
    cursor,
    limit = 20,
    dateFilter
}: {
    cursor?: string
    limit?: number
    dateFilter?: DateFilter
}): Promise<{
    events: Array<{ id: string; content: string; createdAt: Date; occurredAt: Date | null }>
    nextCursor?: string
}> {
    const user = await requireUser();

    // Build date filter conditions
    const dateConditions: Record<string, Date> = {}
    if (dateFilter?.from) {
        dateConditions.gte = new Date(dateFilter.from)
    }
    if (dateFilter?.to) {
        dateConditions.lte = new Date(dateFilter.to)
    }

    const events = await prisma.event.findMany({
        where: {
            userId: user.id,
            ...(Object.keys(dateConditions).length > 0 && {
                occurredAt: dateConditions
            })
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && {
            cursor: { id: cursor },
            skip: 1 // Skip the cursor itself
        }),
        select: {
            id: true,
            content: true,
            createdAt: true,
            occurredAt: true
        }
    });

    const hasMore = events.length > limit;
    const displayEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? displayEvents[displayEvents.length - 1]?.id : undefined;

    return { events: displayEvents, nextCursor };
}
