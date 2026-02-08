'use client';

import { useHydrated } from '@/hooks/useHydrated';
import { SessionsGrid } from '@/components/sessions/SessionsGrid';

export default function SessionsPage() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <main className="flex-1 px-2 pt-3 sm:px-3 sm:pt-4">
        <SessionsGrid />
      </main>
    </div>
  );
}
