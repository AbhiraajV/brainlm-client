'use client';

import { useEffect, useState } from 'react';
import { Trophy, X, TrendingUp } from 'lucide-react';
import type { PRSummary } from '@/lib/sessions/types';

interface PRCelebrationProps {
  prs: PRSummary[];
  onDismiss: () => void;
  autoDismissMs?: number;
}

// Format PR type for display
function formatPRType(prType: PRSummary['prType']): string {
  switch (prType) {
    case 'e1rm':
      return 'Estimated 1RM';
    case 'weight':
      return 'Weight';
    case 'volume':
      return 'Volume';
    case 'reps':
      return 'Reps';
    default:
      return 'PR';
  }
}

// Get unit suffix for PR values
function getValueUnit(prType: PRSummary['prType']): string {
  switch (prType) {
    case 'e1rm':
    case 'weight':
    case 'volume':
      return 'kg';
    case 'reps':
      return ' reps';
    default:
      return '';
  }
}

/**
 * PRCelebration - Celebratory banner when PRs are detected
 * Shows trophy icon with animation, exercise name, PR type, and improvement percentage
 */
export function PRCelebration({ prs, onDismiss, autoDismissMs = 8000 }: PRCelebrationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);

  // Auto-dismiss after delay
  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Allow fade out animation
      }, autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs, onDismiss]);

  // Stop animation after initial burst
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (prs.length === 0) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        max-w-md w-[calc(100%-2rem)]
        bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-bg)]
        border-2 border-[var(--color-success)]
        rounded-xl shadow-lg
        overflow-hidden
        transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
    >
      {/* Animated confetti effect background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {isAnimating && (
          <>
            <div className="absolute top-0 left-1/4 w-2 h-2 bg-[var(--color-mint)] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="absolute top-0 left-1/2 w-2 h-2 bg-[var(--color-lime)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="absolute top-0 left-3/4 w-2 h-2 bg-[var(--color-coral)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </>
        )}
      </div>

      <div className="relative p-4">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`
            p-2 rounded-full bg-[var(--color-success)]/20
            ${isAnimating ? 'animate-pulse' : ''}
          `}>
            <Trophy className="w-6 h-6 text-[var(--color-success)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text)]">
              {prs.length === 1 ? 'New Personal Record!' : `${prs.length} New PRs!`}
            </h3>
            <p className="text-xs text-[var(--color-muted)]">Congratulations on your progress!</p>
          </div>
        </div>

        {/* PR list */}
        <div className="space-y-2">
          {prs.map((pr, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-[var(--color-line)]/50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
                <div>
                  <span className="font-medium text-[var(--color-text)]">{pr.exerciseName}</span>
                  <span className="text-xs text-[var(--color-muted)] ml-2">{formatPRType(pr.prType)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1">
                  {pr.previousValue > 0 && (
                    <span className="text-xs text-[var(--color-muted)] line-through">
                      {Math.round(pr.previousValue)}{getValueUnit(pr.prType)}
                    </span>
                  )}
                  <span className="font-bold text-[var(--color-text)]">
                    {Math.round(pr.newValue)}{getValueUnit(pr.prType)}
                  </span>
                </div>
                {pr.improvement > 0 && pr.previousValue > 0 && (
                  <span className="text-xs font-medium text-[var(--color-success)]">
                    +{pr.improvement.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
