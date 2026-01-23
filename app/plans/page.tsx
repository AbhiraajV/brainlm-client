'use client'

import { PlansFeed } from '@/components/plans';
import { FullscreenReader } from '@/components/ui/FullscreenReader';
import { BackButton } from '@/components/ui/BackButton';

// Auth + baseline check already done by middleware
// Fully client-side page - shows cached data instantly
export default function PlansPage() {
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

          {/* Plans feed - client component with cache-first rendering */}
          <PlansFeed limit={20} />
        </div>
      </main>

      {/* Fixed back button - bottom left (uses browser history for instant nav) */}
      <BackButton />

      {/* Fullscreen reader for plan details */}
      <FullscreenReader />
    </div>
  );
}
