// Onboarding Types

export type StepType = 'intro' | 'question' | 'completion';

export interface IntroStepConfig {
  type: 'intro';
  id: string;
  title: string;
  content: string;
  nextLabel?: string;
}

export interface QuestionConfig {
  id: string;
  text: string;
}

export interface QuestionStepConfig {
  type: 'question';
  id: string;
  title: string;
  description?: string;
  questions: QuestionConfig[];
  reassurance?: string;
}

export interface CompletionStepConfig {
  type: 'completion';
  id: string;
  title: string;
  content: string;
}

export type StepConfig = IntroStepConfig | QuestionStepConfig | CompletionStepConfig;

// Answers are stored by section ID, then question ID
export type SectionAnswers = Record<string, string>;
export type AllAnswers = Record<string, SectionAnswers>;

export interface OnboardingState {
  currentStepIndex: number;
  answers: AllAnswers;
  startedAt: string | null;
  lastActiveAt: string | null;
}

export interface OnboardingActions {
  goNext: () => void;
  goPrevious: () => void;
  goToStep: (index: number) => void;
  setAnswer: (sectionId: string, questionId: string, value: string) => void;
  reset: () => void;
}

export type OnboardingStore = OnboardingState & OnboardingActions;

// Baseline data structure saved to DB
export interface BaselineData {
  answers: AllAnswers;
  completedAt: string;
  version: number;
}
