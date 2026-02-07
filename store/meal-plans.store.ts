import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MealPlan } from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:meal-plans';
const STORAGE_VERSION = 1;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface MealPlansState {
  mealPlans: Record<string, MealPlan>;
  mealPlanIds: string[];
}

interface MealPlansActions {
  createMealPlan: (plan: Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => string;
  updateMealPlan: (planId: string, updates: Partial<Omit<MealPlan, 'id' | 'createdAt'>>) => void;
  deleteMealPlan: (planId: string) => void;
  incrementMealPlanUsage: (planId: string) => void;
}

export type MealPlansStore = MealPlansState & MealPlansActions;

const initialState: MealPlansState = {
  mealPlans: {},
  mealPlanIds: [],
};

const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {}
  },
};

const isValidMealPlan = (plan: unknown): plan is MealPlan => {
  if (!plan || typeof plan !== 'object') return false;
  const p = plan as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.createdAt === 'string' &&
    p.targets !== undefined &&
    Array.isArray(p.meals)
  );
};

export const useMealPlansStore = create<MealPlansStore>()(
  persist(
    (set) => ({
      ...initialState,

      createMealPlan: (plan): string => {
        const now = new Date().toISOString();
        const id = generateId();

        const newPlan: MealPlan = {
          ...plan,
          id,
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
        };

        set((state) => ({
          mealPlans: { ...state.mealPlans, [id]: newPlan },
          mealPlanIds: [id, ...state.mealPlanIds],
        }));

        return id;
      },

      updateMealPlan: (planId, updates): void => {
        const now = new Date().toISOString();
        set((state) => {
          const existing = state.mealPlans[planId];
          if (!existing) return state;
          return {
            mealPlans: {
              ...state.mealPlans,
              [planId]: { ...existing, ...updates, updatedAt: now },
            },
          };
        });
      },

      deleteMealPlan: (planId): void => {
        set((state) => {
          const { [planId]: _, ...rest } = state.mealPlans;
          return {
            mealPlans: rest,
            mealPlanIds: state.mealPlanIds.filter((id) => id !== planId),
          };
        });
      },

      incrementMealPlanUsage: (planId): void => {
        const now = new Date().toISOString();
        set((state) => {
          const plan = state.mealPlans[planId];
          if (!plan) return state;
          return {
            mealPlans: {
              ...state.mealPlans,
              [planId]: {
                ...plan,
                usageCount: plan.usageCount + 1,
                lastUsedAt: now,
                updatedAt: now,
              },
            },
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        mealPlans: state.mealPlans,
        mealPlanIds: state.mealPlanIds,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1) return initialState;
        if (!persistedState) return initialState;

        try {
          const state = persistedState as { mealPlans?: Record<string, unknown>; mealPlanIds?: string[] };
          const mealPlans: Record<string, MealPlan> = {};
          const mealPlanIds: string[] = [];

          if (state.mealPlans) {
            for (const [id, plan] of Object.entries(state.mealPlans)) {
              if (isValidMealPlan(plan)) {
                mealPlans[id] = plan;
                mealPlanIds.push(id);
              }
            }
          }

          const orderedIds = state.mealPlanIds?.filter((id) => mealPlans[id]) || mealPlanIds;
          return { mealPlans, mealPlanIds: orderedIds };
        } catch {
          return initialState;
        }
      },
    }
  )
);

// Selectors
export const useMealPlan = (id: string) =>
  useMealPlansStore((state) => state.mealPlans[id]);
