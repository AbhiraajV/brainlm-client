import { PricingTable } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function PricingPage() {
  // If user already has a subscription, redirect to app
  const { has } = await auth();

  // Check if user has an active Motif subscription
  const hasSubscription = await has({ plan: "motif_monthly_plan" });

  if (hasSubscription) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="max-w-xl w-full text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl mb-6">
            <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)] bg-clip-text text-transparent">
              Motif
            </span>
          </h1>
          <p className="text-[var(--color-text)] text-base leading-relaxed mb-4">
            Your personal <strong>pattern engine</strong>.
          </p>
          <p className="text-[var(--color-muted)] text-sm leading-relaxed mb-4">
            Log your{' '}
            <span className="text-[var(--color-accent)] font-medium">Workouts</span>,{' '}
            <span className="text-[var(--color-accent)] font-medium">Meals</span>,{' '}
            <span className="text-[var(--color-accent)] font-medium">Moods</span>,{' '}
            <span className="text-[var(--color-accent)] font-medium">Work</span>, and{' '}
            <span className="text-[var(--color-accent)] font-medium">Life</span>{' '}
            in one place — <em>then forget it</em>.
          </p>
          <p className="text-[var(--color-muted)] text-sm leading-relaxed mb-4">
            Motif quietly analyzes everything, spots patterns, and guides your next day
            with <strong className="text-[var(--color-text)]">smart, timely suggestions</strong>.
          </p>
          <p className="text-[var(--color-text)] text-sm font-medium">
            No clutter. No charts. <span className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-light)] bg-clip-text text-transparent">Just clarity.</span>
          </p>
          <p className="text-[var(--color-muted)] text-xs mt-4 italic">
            Motif understands you — just log, leave the rest to us.
          </p>
        </div>

        {/* Clerk's built-in pricing table */}
        <div className="w-full max-w-4xl">
          <PricingTable />
        </div>
      </main>
    </div>
  );
}
