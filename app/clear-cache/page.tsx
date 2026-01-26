'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useEventsCacheStore } from '@/store/events-cache.store';
import { useDailyDataStore } from '@/store/daily-data.store';
import { useAnalysisCache } from '@/store/analysis-cache';

export default function ClearCachePage() {
  const router = useRouter();
  const [cleared, setCleared] = useState(false);

  const clearEventsCache = useEventsCacheStore((s) => s.clearCache);
  const clearDailyData = useDailyDataStore((s) => s.clearCache);
  const clearAnalysis = useAnalysisCache((s) => s.clearCache);

  const handleClearAll = () => {
    // Clear all Zustand persisted stores
    clearEventsCache();
    clearDailyData();
    clearAnalysis();

    // Clear any other localStorage items with our prefix
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('brainlm:') || key?.startsWith('Motif.:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    setCleared(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-8">
      <div className="max-w-sm w-full text-center">
        <h1 className="font-serif text-2xl text-[var(--color-text)] mb-2">
          Clear Cache
        </h1>
        <p className="text-[var(--color-muted)] text-sm mb-8">
          This will clear all locally cached data including events, reviews, and analysis.
        </p>

        {cleared ? (
          <div className="space-y-4">
            <p className="text-[var(--color-accent)] font-medium">
              Cache cleared successfully
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-[var(--color-text)] text-[var(--color-surface)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Go to Home
            </button>
          </div>
        ) : (
          <button
            onClick={handleClearAll}
            className="px-5 py-2.5 bg-[var(--color-error)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Clear All Cache
          </button>
        )}
      </div>
    </div>
  );
}
