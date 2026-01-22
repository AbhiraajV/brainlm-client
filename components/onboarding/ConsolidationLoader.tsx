'use client';

import { useState, useEffect } from 'react';

const LOADING_MESSAGES = [
  "Reading your responses...",
  "Understanding your context...",
  "Mapping your routines...",
  "Recognizing your patterns...",
  "Consolidating your baseline...",
  "Building your profile...",
  "Almost there...",
];

export function ConsolidationLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col items-center justify-center">
      {/* Animated rings */}
      <div className="relative w-24 h-24 mb-8">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-[var(--color-line)] opacity-30" />

        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-accent)] animate-spin"
             style={{ animationDuration: '1.5s' }} />

        {/* Inner pulse */}
        <div className="absolute inset-4 rounded-full bg-[var(--color-accent)]/10 animate-pulse" />

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-[var(--color-accent)]" />
        </div>
      </div>

      {/* Message with fade transition */}
      <div className="h-8 flex items-center justify-center">
        <p
          key={messageIndex}
          className="text-[var(--color-text)] text-lg font-medium animate-fadeIn"
        >
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>

      {/* Subtle subtext */}
      <p className="mt-4 text-[var(--color-muted)] text-sm">
        This may take a moment
      </p>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--color-accent)]"
            style={{
              opacity: 0.3,
              animation: 'pulse-subtle 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
