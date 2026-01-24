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

    // Find or create internal user
    let user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: { id: true, email: true, timezone: true },
    });

    if (!user) {
        // First time this Clerk user is accessing the app - create internal user
        const clerkUser = await currentUser();

        user = await prisma.user.create({
            data: {
                clerkUserId,
                email: clerkUser?.emailAddresses[0]?.emailAddress ?? `${clerkUserId}@clerk.user`,
                name: clerkUser?.firstName
                    ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ''}`
                    : null,
                timezone: "UTC",
            },
            select: { id: true, email: true, timezone: true },
        });
    }

    return {
        id: user.id,
        email: user.email,
        timezone: user.timezone,
    };
}
