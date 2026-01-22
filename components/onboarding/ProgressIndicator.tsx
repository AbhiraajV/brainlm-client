'use client';

import { TOTAL_STEPS } from './content/steps';

interface ProgressIndicatorProps {
  currentStep: number;
}

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  return (
    <div className="w-full">
      {/* Connected bubbles - responsive sizing */}
      <div className="flex items-center justify-center gap-0.5 sm:gap-1">
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex items-center">
              {/* Connector line (not for first item) */}
              {index > 0 && (
                <div
                  className={`
                    w-2 sm:w-4 h-0.5 transition-colors duration-200
                    ${isCompleted || isCurrent
                      ? 'bg-[var(--color-accent)]'
                      : 'bg-[var(--color-line)]'
                    }
                  `}
                />
              )}

              {/* Bubble */}
              <div
                className={`
                  w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-200
                  ${isCompleted
                    ? 'bg-[var(--color-accent)]'
                    : isCurrent
                    ? 'bg-[var(--color-surface)] border-2 border-[var(--color-accent)]'
                    : 'bg-[var(--color-line)]'
                  }
                `}
              />
            </div>
          );
        })}
      </div>

      {/* Step counter below */}
      <p className="text-center text-xs text-[var(--color-muted)] mt-3">
        Step {currentStep + 1} of {TOTAL_STEPS}
      </p>
    </div>
  );
}
