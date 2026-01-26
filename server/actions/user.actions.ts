"use server";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";

/**
 * Update the user's timezone if it's still the default "UTC".
 * Called from client when browser timezone is detected.
 */
export async function syncUserTimezone(
  browserTimezone: string
): Promise<{ updated: boolean; timezone: string }> {
  const user = await requireUser();
  const currentTimezone = user.timezone ?? "UTC";

  // Only update if timezone is still the default "UTC"
  if (currentTimezone !== "UTC") {
    return { updated: false, timezone: currentTimezone };
  }

  // Validate the timezone string (basic check)
  try {
    Intl.DateTimeFormat(undefined, { timeZone: browserTimezone });
  } catch {
    console.warn(`[syncUserTimezone] Invalid timezone: ${browserTimezone}`);
    return { updated: false, timezone: currentTimezone };
  }

  // Update the user's timezone
  await prisma.user.update({
    where: { id: user.id },
    data: { timezone: browserTimezone },
  });

  console.log(`[syncUserTimezone] Updated user ${user.id} timezone to ${browserTimezone}`);
  return { updated: true, timezone: browserTimezone };
}

/**
 * Get the current user's timezone.
 */
export async function getUserTimezoneFromDb(): Promise<string> {
  const user = await requireUser();
  return user.timezone ?? "UTC";
}
