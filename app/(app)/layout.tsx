import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/prisma/client";
import { ReactNode } from "react";
import { EventInput } from "@/components/event-input";
import { NavButtonGroup } from "@/components/ui/NavButtonGroup";

export default async function AppLayout({ children }: { children: ReactNode }) {
    // HARD GATE: This runs on every request to the main app
    const user = await requireUser();

    // Check if user has completed onboarding
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { baseline: true },
    });

    if (!dbUser?.baseline) {
        redirect("/onboarding");
    }

    return (
        <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
            {/* Minimal header */}
            <header className="
                sticky top-0 z-10
                h-14
                flex items-center justify-between
                px-5 sm:px-7
                bg-[var(--color-surface)]
                border-b border-[var(--color-line)]
            ">
                <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
                    BrainLM
                </div>

                {/* Subtle accent dot - indicates system is active */}
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-60" />
            </header>

            {/* Main content - add bottom padding for fixed input */}
            <main className="flex-1 container-padding py-6 sm:py-8 pb-40">
                {children}
            </main>

            {/* Fixed bottom input - full width with minimal margins */}
            <div className="
                fixed bottom-0 left-0 right-0
                z-20
                px-2 sm:px-3
                pb-6 pt-4
                bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent
            ">
                <EventInput />
            </div>

            {/* Bottom right navigation */}
            <NavButtonGroup />
        </div>
    );
}
