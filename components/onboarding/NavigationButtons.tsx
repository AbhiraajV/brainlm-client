'use client';

import { Loader2 } from 'lucide-react';

interface NavigationButtonsProps {
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  backLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
  showBack?: boolean;
  showNext?: boolean;
  showComplete?: boolean;
  nextDisabled?: boolean;
  completeDisabled?: boolean;
  isLoading?: boolean;
}

export function NavigationButtons({
  onBack,
  onNext,
  onComplete,
  backLabel = 'Back',
  nextLabel = 'Continue',
  completeLabel = 'Finish Onboarding',
  showBack = true,
  showNext = true,
  showComplete = false,
  nextDisabled = false,
  completeDisabled = false,
  isLoading = false,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Back button */}
      <div>
        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="
              py-2.5 px-5
              text-sm font-medium
              text-[var(--color-muted)]
              bg-transparent
              border border-[var(--color-line)]
              rounded-[var(--radius-sm)]
              transition-all duration-200
              hover:text-[var(--color-text)]
              hover:border-[var(--color-muted)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {backLabel}
          </button>
        )}
      </div>

      {/* Next / Complete button */}
      <div>
        {showComplete ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={completeDisabled || isLoading}
            className="
              py-2.5 px-6
              text-sm font-medium
              text-white
              bg-[var(--color-accent)]
              border border-[var(--color-accent)]
              rounded-[var(--radius-sm)]
              transition-all duration-200
              hover:opacity-90
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              completeLabel
            )}
          </button>
        ) : showNext ? (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || isLoading}
            className="
              py-2.5 px-6
              text-sm font-medium
              text-white
              bg-[var(--color-accent)]
              border border-[var(--color-accent)]
              rounded-[var(--radius-sm)]
              transition-all duration-200
              hover:opacity-90
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
