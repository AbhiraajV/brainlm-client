'use client';

import type { QuestionStepConfig, SectionAnswers } from '@/lib/onboarding/types';
import { OnboardingInput } from '../OnboardingInput';

interface QuestionStepProps {
  step: QuestionStepConfig;
  answers: SectionAnswers;
  onAnswerChange: (questionId: string, value: string) => void;
}

const SECTION_EMOJIS: Record<string, string> = {
  'life-context': '🌍',
  'routines': '🔄',
  'strengths': '💪',
  'struggles': '🌊',
  'goals': '🎯',
  'quantitative': '📊',
  'reflection': '🪞',
};

export function QuestionStep({ step, answers, onAnswerChange }: QuestionStepProps) {
  const emoji = SECTION_EMOJIS[step.id] || '📝';

  return (
    <div className="max-w-xl mx-auto">
      {/* Section header */}
      <p className="text-lg font-bold text-[var(--color-text)] mb-8">
        {emoji} {step.title}
      </p>

      {/* Questions */}
      <div className="space-y-8">
        {step.questions.map((question, index) => (
          <div key={question.id}>
            <OnboardingInput
              label={`${index + 1}. ${question.text}`}
              value={answers[question.id] || ''}
              onChange={(value) => onAnswerChange(question.id, value)}
              placeholder="Type or speak your answer..."
            />
          </div>
        ))}
      </div>

      {/* Reassurance message */}
      {step.reassurance && (
        <p className="mt-8 text-sm text-[var(--color-muted)] text-center italic">
          {step.reassurance}
        </p>
      )}
    </div>
  );
}
