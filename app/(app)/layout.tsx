import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { EventInput } from "@/components/event-input";
import { FixedInputContainer } from "@/components/ui/FixedInputContainer";

import { TimezoneSync } from "@/components/TimezoneSync";
import { requireUser } from "@/server/auth";

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
    // Get authenticated user — also returns hasBaseline (avoids a second DB query)
    const [user, { has }] = await Promise.all([requireUser(), auth()]);

    if (!user.hasBaseline) {
        redirect("/onboarding");
    }

    // Check if user has an active subscription (Clerk handles free trials)
    const hasSubscription = await has({ plan: "motif_monthly_plan" });

    if (!hasSubscription) {
        redirect("/pricing");
    }

    return (
        <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
            {/* Background timezone sync */}
            <TimezoneSync />

            {/* Minimal header */}
            <header className="
                sticky top-0 z-10
                h-10
                flex items-center justify-between
                px-5 sm:px-7
                bg-[var(--color-surface)]
                border-b border-[var(--color-line)]
            ">
                <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
                    Motif.
                </div>

                {/* User menu with sign out */}
                <UserButton afterSignOutUrl="/" />
            </header>

            {/* Main content - add bottom padding for fixed input */}
            <main className="flex-1 container-padding py-3 sm:py-4 pb-24">
                {children}
            </main>

            {/* Fixed bottom input */}
            <FixedInputContainer gradient>
                <EventInput />
            </FixedInputContainer>

        </div>
    );
}
