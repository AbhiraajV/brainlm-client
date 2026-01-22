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
        },
        // Limit connections to avoid pool exhaustion
        // Supabase free tier has limited connections
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
}

// Skip creation during build when no DATABASE_URL
const hasDbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

// IMPORTANT: Always cache globally in ALL environments (dev AND production)
// The original code only cached in non-production which caused connection leaks
export const prisma: PrismaClient = hasDbUrl
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : (undefined as unknown as PrismaClient);

// Also set it explicitly to ensure it's cached
if (hasDbUrl) {
    globalForPrisma.prisma = prisma;
}
