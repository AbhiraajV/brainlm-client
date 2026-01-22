import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { OnboardingState, OnboardingActions, AllAnswers } from '@/lib/onboarding/types';
import { TOTAL_STEPS } from '@/components/onboarding/content/steps';

const STORAGE_KEY = 'brainlm-onboarding';
const STORAGE_VERSION = 1;

interface OnboardingStore extends OnboardingState, OnboardingActions {}

const initialState: OnboardingState = {
  currentStepIndex: 0,
  answers: {},
  startedAt: null,
  lastActiveAt: null,
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      goNext: () => {
        const { currentStepIndex, startedAt } = get();
        const now = new Date().toISOString();

        if (currentStepIndex < TOTAL_STEPS - 1) {
          set({
            currentStepIndex: currentStepIndex + 1,
            startedAt: startedAt || now,
            lastActiveAt: now,
          });
        }
      },

      goPrevious: () => {
        const { currentStepIndex } = get();
        const now = new Date().toISOString();

        if (currentStepIndex > 0) {
          set({
            currentStepIndex: currentStepIndex - 1,
            lastActiveAt: now,
          });
        }
      },

      goToStep: (index: number) => {
        const { startedAt } = get();
        const now = new Date().toISOString();

        if (index >= 0 && index < TOTAL_STEPS) {
          set({
            currentStepIndex: index,
            startedAt: startedAt || now,
            lastActiveAt: now,
          });
        }
      },

      setAnswer: (sectionId: string, questionId: string, value: string) => {
        const { answers, startedAt } = get();
        const now = new Date().toISOString();

        const sectionAnswers = answers[sectionId] || {};
        const newSectionAnswers = { ...sectionAnswers, [questionId]: value };
        const newAnswers: AllAnswers = { ...answers, [sectionId]: newSectionAnswers };

        set({
          answers: newAnswers,
          startedAt: startedAt || now,
          lastActiveAt: now,
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentStepIndex: state.currentStepIndex,
        answers: state.answers,
        startedAt: state.startedAt,
        lastActiveAt: state.lastActiveAt,
      }),
    }
  )
);

// Selectors for common derived state
export const selectCurrentStepIndex = (state: OnboardingStore) => state.currentStepIndex;
export const selectAnswers = (state: OnboardingStore) => state.answers;
export const selectSectionAnswers = (sectionId: string) => (state: OnboardingStore) =>
  state.answers[sectionId] || {};
