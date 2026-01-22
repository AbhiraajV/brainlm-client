'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/store/onboarding.store';
import { ALL_STEPS, TOTAL_STEPS, isQuestionStep, isIntroStep, isCompletionStep } from './content/steps';
import { canProceedFromStep, areAllSectionsComplete } from '@/lib/onboarding/validation';
import { saveBaseline } from '@/server/actions/onboarding.actions';
import { ProgressIndicator } from './ProgressIndicator';
import { NavigationButtons } from './NavigationButtons';
import { IntroStep } from './steps/IntroStep';
import { QuestionStep } from './steps/QuestionStep';
import { CompletionStep } from './steps/CompletionStep';
import { ConsolidationLoader } from './ConsolidationLoader';

export function OnboardingContainer() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    currentStepIndex,
    answers,
    goNext,
    goPrevious,
    setAnswer,
    reset,
  } = useOnboardingStore();

  const currentStep = ALL_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOTAL_STEPS - 1;

  // Check if we can proceed to the next step
  const canProceed = canProceedFromStep(currentStepIndex, answers);

  // Check if all sections are complete (for final submission)
  const allComplete = areAllSectionsComplete(answers);

  // Get custom next label for intro steps
  const nextLabel = isIntroStep(currentStep) && currentStep.nextLabel
    ? currentStep.nextLabel
    : 'Continue';

  const handleNext = useCallback(() => {
    if (canProceed && !isLastStep) {
      goNext();
      // Scroll to top after navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [canProceed, isLastStep, goNext]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      goPrevious();
      // Scroll to top after navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isFirstStep, goPrevious]);

  const handleAnswerChange = useCallback(
    (questionId: string, value: string) => {
      if (isQuestionStep(currentStep)) {
        setAnswer(currentStep.id, questionId, value);
      }
    },
    [currentStep, setAnswer]
  );

  const handleComplete = useCallback(async () => {
    if (!allComplete || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await saveBaseline(answers);

      if (result.success) {
        // Clear local storage and redirect to profile page
        reset();
        router.push('/me');
        router.refresh();
      } else {
        setSubmitError(result.error || 'Failed to save. Please try again.');
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [allComplete, isSubmitting, answers, reset, router]);

  if (!currentStep) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[var(--color-muted)]">Something went wrong. Please refresh the page.</p>
      </div>
    );
  }

  // Show full-screen loader during consolidation
  if (isSubmitting) {
    return <ConsolidationLoader />;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Progress indicator */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] py-4 px-5 sm:px-7 border-b border-[var(--color-line)]">
        <div className="max-w-2xl mx-auto">
          <ProgressIndicator currentStep={currentStepIndex} />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 container-padding py-8 sm:py-12 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Error message */}
          {submitError && (
            <div className="mb-6 px-4 py-3 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-[var(--radius-md)]">
              {submitError}
            </div>
          )}

          {/* Render the appropriate step component with animation */}
          <div key={currentStepIndex} className="onboarding-step-enter">
            {isIntroStep(currentStep) && <IntroStep step={currentStep} />}

            {isQuestionStep(currentStep) && (
              <QuestionStep
                step={currentStep}
                answers={answers[currentStep.id] || {}}
                onAnswerChange={handleAnswerChange}
              />
            )}

            {isCompletionStep(currentStep) && (
              <CompletionStep step={currentStep} answers={answers} />
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="sticky bottom-0 z-10 bg-[var(--color-bg)] py-4 px-5 sm:px-7 border-t border-[var(--color-line)]">
        <div className="max-w-2xl mx-auto">
          <NavigationButtons
            onBack={handleBack}
            onNext={handleNext}
            onComplete={handleComplete}
            showBack={!isFirstStep}
            showNext={!isLastStep}
            showComplete={isLastStep}
            nextLabel={nextLabel}
            nextDisabled={!canProceed}
            completeDisabled={!allComplete}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
