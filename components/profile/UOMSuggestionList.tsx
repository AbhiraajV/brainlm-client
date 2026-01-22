'use client';

import { Sparkles } from 'lucide-react';
import { UOMSuggestionCard, type UOMSuggestionData } from './UOMSuggestionCard';

interface UOMSuggestionListProps {
  suggestions: UOMSuggestionData[];
}

export function UOMSuggestionList({ suggestions }: UOMSuggestionListProps) {
  const handleAccept = (id: string) => {
    // TODO: Implement accept functionality
    console.log('Accept suggestion:', id);
  };

  const handleReject = (id: string) => {
    // TODO: Implement reject functionality
    console.log('Reject suggestion:', id);
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
        <h2 className="font-serif text-lg font-semibold text-[var(--color-text)]">
          Suggested Updates
        </h2>
        <span className="
          ml-auto
          px-2 py-0.5
          text-[11px] font-medium
          text-[var(--color-accent)]
          bg-[var(--color-accent)]/10
          rounded-full
        ">
          {suggestions.length} pending
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--color-muted)] mb-4">
        Based on your recent entries, we have some suggestions to keep your profile up to date.
      </p>

      {/* Suggestion cards */}
      <div className="space-y-4">
        {suggestions.map((suggestion) => (
          <UOMSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ))}
      </div>
    </section>
  );
}
