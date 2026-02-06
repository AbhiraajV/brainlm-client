'use client';

import { Play } from 'lucide-react';

interface StartWorkoutButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function StartWorkoutButton({ onClick, disabled, className }: StartWorkoutButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-1.5
        w-full py-2.5 px-4
        bg-[var(--color-lime)] text-[var(--color-bg)]
        font-medium text-sm
        transition-colors
        hover:bg-[var(--color-lime)]/90
        disabled:opacity-40 disabled:cursor-not-allowed
        ${className || ''}
      `}
    >
      <Play className="w-3.5 h-3.5" />
      Start
    </button>
  );
}
