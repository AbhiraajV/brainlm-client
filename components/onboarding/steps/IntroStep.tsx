'use client';

import type { IntroStepConfig } from '@/lib/onboarding/types';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

// Map step IDs to emojis for visual interest
const stepEmojis: Record<string, string> = {
  'intro-1': '🧠',
  'intro-2': '⏳',
  'intro-3': '🤝',
  'intro-4': '🧩',
  'intro-5': '🌱',
};

interface IntroStepProps {
  step: IntroStepConfig;
}

export function IntroStep({ step }: IntroStepProps) {
  const emoji = stepEmojis[step.id] || '';

  return (
    <div className="max-w-xl mx-auto">
      {/* Title with emoji inline */}
      <h1 className="font-serif text-2xl sm:text-3xl text-[var(--color-text)] leading-tight mb-8">
        {emoji && <span className="mr-3">{emoji}</span>}
        {step.title}
      </h1>

      {/* Content with markdown formatting */}
      <div className="prose-onboarding">
        <MarkdownRenderer content={step.content} />
      </div>
    </div>
  );
}
