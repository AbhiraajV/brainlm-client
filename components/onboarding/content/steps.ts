import type { StepConfig } from '@/lib/onboarding/types';
import { introSteps } from './intro-content';
import { questionSteps, completionStep } from './question-content';

// All steps in order: 5 intro + 7 question + 1 completion = 13 total
export const ALL_STEPS: StepConfig[] = [
  ...introSteps,
  ...questionSteps,
  completionStep,
];

export const TOTAL_STEPS = ALL_STEPS.length;

// Helper to get step by index
export function getStep(index: number): StepConfig | undefined {
  return ALL_STEPS[index];
}

// Helper to check if step is a question step
export function isQuestionStep(step: StepConfig): step is Extract<StepConfig, { type: 'question' }> {
  return step.type === 'question';
}

// Helper to check if step is an intro step
export function isIntroStep(step: StepConfig): step is Extract<StepConfig, { type: 'intro' }> {
  return step.type === 'intro';
}

// Helper to check if step is the completion step
export function isCompletionStep(step: StepConfig): step is Extract<StepConfig, { type: 'completion' }> {
  return step.type === 'completion';
}
