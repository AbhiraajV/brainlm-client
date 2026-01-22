'use client';

import { Plus } from 'lucide-react';

interface EmptyStateProps {
  onCreateNew: () => void;
}

export function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5">
      <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
      <p className="font-serif text-lg text-[var(--color-text)]">No sessions yet</p>
      <p className="text-sm text-[var(--color-muted)] mt-1 mb-6">
        Create a session to start tracking
      </p>
      <button
        onClick={onCreateNew}
        className="
          inline-flex items-center gap-2
          px-4 py-2.5
          bg-transparent
          border border-[var(--color-line)]
          rounded-full
          text-sm text-[var(--color-muted)]
          transition-all duration-200
          hover:border-[var(--color-muted)]
          hover:text-[var(--color-text)]
        "
      >
        <Plus className="w-4 h-4" />
        <span>New Session</span>
      </button>
    </div>
  );
}
