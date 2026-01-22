import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PlansFeed } from '@/components/plans';
import { FullscreenReader } from '@/components/ui/FullscreenReader';
import { requireUser } from '@/server/auth';
import { prisma } from '@/server/prisma/client';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { baseline: true },
  });

  if (!dbUser?.baseline) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="
        sticky top-0 z-10
        h-14
        flex items-center justify-between
        px-5 sm:px-7
        bg-[var(--color-surface)]
        border-b border-[var(--color-line)]
      ">
        <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
          Daily Plans
        </div>
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-60" />
      </header>

      {/* Main content */}
      <main className="flex-1 py-6 sm:py-8 pb-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Subtitle */}
          <div className="space-y-2 mb-6">
            <p className="text-sm text-[var(--color-muted)]">
              Personalized plans based on your patterns and insights
            </p>
            <p className="text-sm font-semibold italic text-[var(--color-muted)]">
              These plans help you make the most of each day by surfacing relevant focus areas, suggested schedules, and things to watch out for.
            </p>
          </div>

          {/* Plans feed */}
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center py-16 px-5">
                <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
                <p className="text-sm text-[var(--color-muted)] mt-4">
                  Loading plans...
                </p>
              </div>
            }
          >
            <PlansFeed limit={20} />
          </Suspense>
        </div>
      </main>

      {/* Fixed back button - bottom left */}
      <Link
        href="/"
        className="
          fixed bottom-6 left-6
          z-20
          w-12 h-12
          flex items-center justify-center
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          shadow-lg
          transition-all duration-200
          hover:shadow-xl hover:border-[var(--color-accent)]
          active:scale-95
        "
        aria-label="Go back to home"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
      </Link>

      {/* Fullscreen reader for plan details */}
      <FullscreenReader />
    </div>
  );
}
