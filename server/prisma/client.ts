import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Lazy initialization to avoid build-time errors when DATABASE_URL isn't set
function getPrismaClient(): PrismaClient {
    if (globalForPrisma.prisma) {
        return globalForPrisma.prisma;
    }

    const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

    const client = new PrismaClient(
        url ? { datasources: { db: { url } } } : undefined
    );

    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = client;
    }

    return client;
}

// Export a getter that lazily initializes
export const prisma = new Proxy({} as PrismaClient, {
    get(_, prop) {
        const client = getPrismaClient();
        const value = client[prop as keyof PrismaClient];
        return typeof value === 'function' ? value.bind(client) : value;
    }
});
