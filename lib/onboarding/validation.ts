import type { StepConfig, AllAnswers, SectionAnswers } from './types';
import { ALL_STEPS, isQuestionStep } from '@/components/onboarding/content/steps';

/**
 * Check if a question step has all questions answered
 */
export function isSectionComplete(
  step: Extract<StepConfig, { type: 'question' }>,
  sectionAnswers: SectionAnswers
): boolean {
  return step.questions.every((q) => {
    const answer = sectionAnswers[q.id];
    return answer && answer.trim().length > 0;
  });
}

/**
 * Check if a specific step can be navigated past (for "Next" validation)
 */
export function canProceedFromStep(stepIndex: number, answers: AllAnswers): boolean {
  const step = ALL_STEPS[stepIndex];
  if (!step) return false;

  // Intro steps can always proceed
  if (step.type === 'intro') {
    return true;
  }

  // Question steps require all questions answered
  if (step.type === 'question') {
    const sectionAnswers = answers[step.id] || {};
    return isSectionComplete(step, sectionAnswers);
  }

  // Completion step - can't proceed (it's the last one)
  return false;
}

/**
 * Get the count of unanswered questions in a section
 */
export function getUnansweredCount(
  step: Extract<StepConfig, { type: 'question' }>,
  sectionAnswers: SectionAnswers
): number {
  return step.questions.filter((q) => {
    const answer = sectionAnswers[q.id];
    return !answer || answer.trim().length === 0;
  }).length;
}

/**
 * Check if all question sections are complete (for final submission)
 */
export function areAllSectionsComplete(answers: AllAnswers): boolean {
  const questionSteps = ALL_STEPS.filter(isQuestionStep);

  return questionSteps.every((step) => {
    const sectionAnswers = answers[step.id] || {};
    return isSectionComplete(step, sectionAnswers);
  });
}

/**
 * Get completion stats for progress display
 */
export function getCompletionStats(answers: AllAnswers): {
  totalSections: number;
  completedSections: number;
  totalQuestions: number;
  answeredQuestions: number;
} {
  const questionSteps = ALL_STEPS.filter(isQuestionStep);

  let completedSections = 0;
  let totalQuestions = 0;
  let answeredQuestions = 0;

  questionSteps.forEach((step) => {
    const sectionAnswers = answers[step.id] || {};

    totalQuestions += step.questions.length;

    const answeredInSection = step.questions.filter((q) => {
      const answer = sectionAnswers[q.id];
      return answer && answer.trim().length > 0;
    }).length;

    answeredQuestions += answeredInSection;

    if (answeredInSection === step.questions.length) {
      completedSections++;
    }
  });

  return {
    totalSections: questionSteps.length,
    completedSections,
    totalQuestions,
    answeredQuestions,
  };
}
