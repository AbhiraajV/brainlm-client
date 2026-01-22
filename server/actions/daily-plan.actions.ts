"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";

/**
 * Daily Plan Actions
 * Forward-looking plans generated from daily reviews.
 */

/**
 * Get tomorrow's plan for current user.
 */
export async function getTomorrowPlan() {
    const user = await requireUser();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return prisma.dailyPlan.findFirst({
        where: { userId: user.id, targetDate: tomorrow }
    });
}

/**
 * Get plan for a specific date.
 */
export async function getDailyPlanByDate(date: Date) {
    const user = await requireUser();
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return prisma.dailyPlan.findFirst({
        where: { userId: user.id, targetDate: normalizedDate }
    });
}

/**
 * Get recent daily plans with pagination.
 */
export async function getDailyPlansPage({
    cursor,
    limit = 10
}: {
    cursor?: string;
    limit?: number;
}) {
    const user = await requireUser();

    const plans = await prisma.dailyPlan.findMany({
        where: { userId: user.id },
        orderBy: { targetDate: 'desc' },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 })
    });

    const hasMore = plans.length > limit;
    const displayPlans = hasMore ? plans.slice(0, limit) : plans;

    return {
        plans: displayPlans,
        nextCursor: hasMore ? displayPlans[displayPlans.length - 1]?.id : undefined
    };
}
