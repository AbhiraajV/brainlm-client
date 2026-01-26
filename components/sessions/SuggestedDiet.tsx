'use client';

import { useState } from 'react';
import { UtensilsCrossed, ChevronDown, ChevronRight, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import type { SuggestedDiet as SuggestedDietType } from '@/lib/sessions/types';

interface Props {
  suggestedDiet?: SuggestedDietType;
  onGenerate?: () => void;
  isGenerating?: boolean;
}

export function SuggestedDiet({ suggestedDiet, onGenerate, isGenerating }: Props) {
  const [isExpanded, setIsExpanded] = useState(!!suggestedDiet);
  const [isReasonExpanded, setIsReasonExpanded] = useState(false);

  // Show generate button if no diet and onGenerate is provided
  if (!suggestedDiet && onGenerate) {
    return (
      <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing your goals...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Meal Plan
            </>
          )}
        </button>
      </div>
    );
  }

  if (!suggestedDiet) {
    return null;
  }

  return (
    <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-3 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text)]">
            Suggested Meal Plan
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            ({suggestedDiet.meals.length} meals)
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)]" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Meals List */}
          {suggestedDiet.meals.map((meal, i) => (
            <div key={i} className="py-2 border-b border-[var(--color-line)] last:border-b-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                      {meal.time}
                    </span>
                    {meal.calories && (
                      <span className="text-xs text-[var(--color-muted)]">
                        ~{meal.calories} cal
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text)]">
                    {meal.suggestion}
                  </p>
                  {(meal.protein || meal.carbs || meal.fat) && (
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      {meal.protein && `${meal.protein}g protein`}
                      {meal.protein && meal.carbs && ' · '}
                      {meal.carbs && `${meal.carbs}g carbs`}
                      {(meal.protein || meal.carbs) && meal.fat && ' · '}
                      {meal.fat && `${meal.fat}g fat`}
                    </p>
                  )}
                  {meal.notes && (
                    <p className="text-xs text-[var(--color-muted)] mt-1 italic">
                      "{meal.notes}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Daily Totals */}
          <div className="pt-2 border-t border-[var(--color-line)]">
            <p className="text-xs text-[var(--color-text)] font-medium">
              Daily Totals: {suggestedDiet.dailyTotals.calories} cal · {suggestedDiet.dailyTotals.protein}g protein · {suggestedDiet.dailyTotals.carbs}g carbs · {suggestedDiet.dailyTotals.fat}g fat
            </p>
          </div>

          {/* Reason Section */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsReasonExpanded(!isReasonExpanded);
            }}
            className="flex items-center gap-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            {isReasonExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <Lightbulb className="w-3 h-3" />
            <span>Why this plan?</span>
          </button>

          {isReasonExpanded && (
            <div className="mt-2 p-3 bg-[var(--color-bg)] text-xs text-[var(--color-text)] leading-relaxed">
              {suggestedDiet.reason}
            </div>
          )}

          {/* Regenerate button */}
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
