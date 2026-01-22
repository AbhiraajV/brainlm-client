import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    return new PrismaClient({
        datasources: {
            db: {
                url: process.env.DIRECT_URL || process.env.DATABASE_URL
            }
        }
    });
}

// Skip creation during build when no DATABASE_URL
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export const prisma: PrismaClient = url
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : (undefined as unknown as PrismaClient);
