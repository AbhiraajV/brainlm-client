import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/server/prisma/client";
import { AuthUser } from "./types";

/**
 * Enforces authentication via Clerk.
 * Gets the Clerk user, then maps to internal User via clerkUserId.
 *
 * If user is not authenticated, Clerk middleware will have already redirected.
 * If authenticated but no internal user exists, creates one.
 *
 * Usage: const user = await requireUser();
 */
export async function requireUser(): Promise<AuthUser> {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
        // This shouldn't happen if middleware is configured correctly
        // but handle it gracefully
        throw new Error("Unauthorized");
    }

    // Fast path: check if user already exists
    let user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, email: true, timezone: true, baseline: true },
    });

    if (!user) {
        // First time this Clerk user is accessing the app — fetch Clerk profile
        const clerkUser = await currentUser();

        // Use upsert to handle concurrent requests atomically (avoids P2002 race condition)
        user = await prisma.user.upsert({
            where: { clerkUserId },
            update: {},
            create: {
                clerkUserId,
                email: clerkUser?.emailAddresses[0]?.emailAddress ?? `${clerkUserId}@clerk.user`,
                name: clerkUser?.firstName
                    ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ''}`
                    : null,
                timezone: "UTC",
            },
            select: { id: true, email: true, timezone: true, baseline: true },
        });
    }

    return {
        id: user.id,
        email: user.email,
        timezone: user.timezone,
        hasBaseline: !!user.baseline,
    };
}
