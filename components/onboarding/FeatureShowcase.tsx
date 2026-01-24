'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface FeatureShowcaseProps {
  onSaveComplete?: boolean;
  onError?: string | null;
  onRetry?: () => void;
}

const FEATURES = [
  {
    title: "Building your baseline",
    description: "Distilling your answers into a living document — ",
    detail: "one that evolves with you",
  },
  {
    title: "Mapping your context",
    description: "Understanding your patterns, routines & goals — ",
    detail: "so nothing gets lost",
  },
  {
    title: "Preparing insights",
    description: "Setting up personalized pattern recognition — ",
    detail: "the things you'd miss",
  },
  {
    title: "Configuring reviews",
    description: "Daily, weekly & monthly summaries — ",
    detail: "tailored just for you",
  },
  {
    title: "Almost ready",
    description: "Finalizing your experience — ",
    detail: "let's begin",
  },
];

export function FeatureShowcase({ onSaveComplete, onError, onRetry }: FeatureShowcaseProps) {
  const router = useRouter();
  const [currentFeature, setCurrentFeature] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [fade, setFade] = useState(true);

  const saveComplete = onSaveComplete ?? true;

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentFeature((prev) => {
          if (prev >= FEATURES.length - 1) return prev;
          return prev + 1;
        });
        setFade(true);
      }, 250);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentFeature >= FEATURES.length - 1) {
      const timeout = setTimeout(() => {
        setAnimationComplete(true);
      }, 2200);
      return () => clearTimeout(timeout);
    }
  }, [currentFeature]);

  useEffect(() => {
    if (animationComplete && saveComplete && !onError) {
      setIsExiting(true);
      const timeout = setTimeout(() => {
        router.push('/pricing');
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [animationComplete, saveComplete, onError, router]);

  if (onError) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-[var(--color-error)] text-sm mb-6">{onError}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-[var(--color-text)] underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const current = FEATURES[currentFeature];
  const showWaiting = animationComplete && !saveComplete;

  return (
    <div
      className={`fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Color splashes in corners */}
      <div
        className="absolute -top-32 -left-32 w-72 h-72 rounded-full opacity-[0.08] blur-3xl"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />
      <div
        className="absolute -top-24 -right-24 w-56 h-56 rounded-full opacity-[0.06] blur-3xl"
        style={{ backgroundColor: 'var(--color-accent-secondary)' }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-[0.08] blur-3xl"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full opacity-[0.06] blur-3xl"
        style={{ backgroundColor: 'var(--color-accent-secondary)' }}
      />

      {/* Main content */}
      <div className="flex flex-col items-center px-6 relative z-10">

        {/* Three pulsing dots - middle one secondary */}
        <div className="flex gap-1.5 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-secondary)] animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>

        {/* Feature content */}
        <div
          className={`text-center transition-all duration-300 ${fade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
        >
          {/* Title */}
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--color-text)] mb-2">
            {showWaiting ? "Almost there..." : current.title}
          </h2>

          {/* Description with italic detail */}
          <p className="text-[var(--color-muted)] text-base">
            {showWaiting ? (
              <span className="italic">just a moment more</span>
            ) : (
              <>
                {current.description}
                <em className="text-[var(--color-accent)]">{current.detail}</em>
              </>
            )}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex gap-1.5 mt-8">
          {FEATURES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentFeature
                  ? 'w-6 bg-[var(--color-accent)]'
                  : i < currentFeature
                    ? 'w-1.5 bg-[var(--color-accent)] opacity-40'
                    : 'w-1.5 bg-[var(--color-line)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
