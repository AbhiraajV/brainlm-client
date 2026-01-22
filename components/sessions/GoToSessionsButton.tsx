'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { useSessionsStore } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';

export function GoToSessionsButton() {
  const hydrated = useHydrated();
  const sessions = useSessionsStore((state) => state.sessions);

  // Compute today's active (non-completed) sessions count
  const count = useMemo(() => {
    if (!hydrated) return 0;
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter((s) => s.createdAt.startsWith(today) && !s.isCompleted).length;
  }, [sessions, hydrated]);

  return (
    <Link
      href="/sessions"
      className="
        fixed left-4 z-30
        flex items-center gap-2
        px-3 py-2
        bg-[var(--color-surface)]
        border border-[var(--color-line)]
        rounded-full
        text-sm text-[var(--color-muted)]
        shadow-lg
        transition-all duration-200
        hover:border-[var(--color-muted)]
        hover:text-[var(--color-text)]
        active:scale-95
      "
      style={{ bottom: '120px' }}
      aria-label="Go to sessions"
    >
      <Layers className="w-4 h-4" />
      <span>Sessions</span>
      {hydrated && count > 0 && (
        <span
          className="
            min-w-[1.25rem] h-5
            flex items-center justify-center
            bg-[var(--color-accent)] text-white text-xs font-semibold
            rounded-full px-1.5
          "
        >
          {count}
        </span>
      )}
    </Link>
  );
}
