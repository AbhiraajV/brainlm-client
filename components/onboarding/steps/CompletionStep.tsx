'use client';

import { Check } from 'lucide-react';
import type { CompletionStepConfig } from '@/lib/onboarding/types';
import { getCompletionStats } from '@/lib/onboarding/validation';
import type { AllAnswers } from '@/lib/onboarding/types';

interface CompletionStepProps {
  step: CompletionStepConfig;
  answers: AllAnswers;
}

export function CompletionStep({ step, answers }: CompletionStepProps) {
  const stats = getCompletionStats(answers);

  return (
    <div className="max-w-xl mx-auto text-center">
      {/* Success icon */}
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
        <Check className="w-8 h-8 text-[var(--color-accent)]" />
      </div>

      {/* Title */}
      <h1 className="font-serif text-2xl sm:text-3xl text-[var(--color-text)] mb-6 leading-tight">
        {step.title}
      </h1>

      {/* Stats summary */}
      <div className="mb-8 p-4 bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[var(--radius-md)]">
        <div className="flex items-center justify-center gap-8 text-sm">
          <div>
            <div className="text-2xl font-semibold text-[var(--color-accent)]">
              {stats.answeredQuestions}
            </div>
            <div className="text-[var(--color-muted)]">Questions Answered</div>
          </div>
          <div className="w-px h-12 bg-[var(--color-line)]" />
          <div>
            <div className="text-2xl font-semibold text-[var(--color-accent)]">
              {stats.completedSections}
            </div>
            <div className="text-[var(--color-muted)]">Sections Complete</div>
          </div>
        </div>
      </div>

      {/* Content - rendered as paragraphs */}
      <div className="space-y-4 text-left">
        {step.content.split('\n\n').map((paragraph, index) => (
          <p
            key={index}
            className="text-[var(--color-text)] leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
