"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";

export async function getById(id: string) {
    const user = await requireUser();
    return prisma.interpretation.findFirst({
        where: { id, userId: user.id },
    });
}

export async function getMany(limit = 20) {
    const user = await requireUser();
    return prisma.interpretation.findMany({
        where: { userId: user.id },
        take: limit,
        orderBy: { createdAt: 'desc' },
    });
}

export async function getForCurrentUser() {
    return getMany();
}
