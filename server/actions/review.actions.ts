"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { ReviewType } from "@prisma/client";

export async function getById(id: string) {
    const user = await requireUser();
    return prisma.review.findFirst({
        where: { id, userId: user.id },
    });
}

export async function getMany(limit = 20) {
    const user = await requireUser();
    return prisma.review.findMany({
        where: { userId: user.id },
        take: limit,
        orderBy: { periodStart: 'desc' },
    });
}

export async function getForCurrentUser() {
    return getMany();
}

export async function getReviewsByType({
    type,
    cursor,
    limit = 20,
}: {
    type?: ReviewType;
    cursor?: string;
    limit?: number;
}) {
    const user = await requireUser();

    const reviews = await prisma.review.findMany({
        where: {
            userId: user.id,
            ...(type && { type }),
        },
        orderBy: { periodStart: 'desc' },
        take: limit + 1,
        ...(cursor && {
            skip: 1,
            cursor: { id: cursor },
        }),
        select: {
            id: true,
            type: true,
            periodKey: true,
            periodStart: true,
            periodEnd: true,
            summary: true,
            renderedMarkdown: true,
            eventIds: true,
            interpretationIds: true,
            patternIds: true,
            insightIds: true,
            createdAt: true,
        },
    });

    const hasMore = reviews.length > limit;
    const displayReviews = hasMore ? reviews.slice(0, limit) : reviews;
    const nextCursor = hasMore ? displayReviews[displayReviews.length - 1]?.id : undefined;

    return {
        reviews: displayReviews,
        nextCursor,
    };
}

export async function getReviewCounts() {
    const user = await requireUser();

    const [daily, weekly, monthly, total] = await Promise.all([
        prisma.review.count({ where: { userId: user.id, type: 'DAILY' } }),
        prisma.review.count({ where: { userId: user.id, type: 'WEEKLY' } }),
        prisma.review.count({ where: { userId: user.id, type: 'MONTHLY' } }),
        prisma.review.count({ where: { userId: user.id } }),
    ]);

    return { daily, weekly, monthly, total };
}
