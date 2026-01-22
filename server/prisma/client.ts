import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    _prisma: PrismaClient | undefined;
};

function getOrCreatePrismaClient(): PrismaClient {
    // Return cached instance if exists
    if (globalForPrisma._prisma) {
        return globalForPrisma._prisma;
    }

    // Create new client
    const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const client = new PrismaClient(
        url ? { datasources: { db: { url } } } : undefined
    );

    // Always cache globally to prevent connection leaks
    globalForPrisma._prisma = client;
    return client;
}

// Lazy proxy - only creates client when actually used (not at import time)
// This allows build to succeed without DATABASE_URL
export const prisma = new Proxy({} as PrismaClient, {
    get(_, prop) {
        // Special handling for Promise detection
        if (prop === 'then') return undefined;

        const client = getOrCreatePrismaClient();
        const value = client[prop as keyof PrismaClient];
        return typeof value === 'function' ? value.bind(client) : value;
    }
});
