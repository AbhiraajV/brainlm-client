import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    // Prefer DATABASE_URL (pooled) over DIRECT_URL (direct) for queries
    // DIRECT_URL should only be used for migrations
    const url = process.env.DATABASE_URL || process.env.DIRECT_URL;

    return new PrismaClient({
        datasources: {
            db: { url }
        }
    });
}

// Skip creation during build when no DATABASE_URL
const hasDbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

export const prisma: PrismaClient = hasDbUrl
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : (undefined as unknown as PrismaClient);
