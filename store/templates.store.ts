import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WorkoutPlan, PlanDay, TemplateExercise, MuscleGroup } from '@/lib/sessions/types';
import { useExercisesStore } from './exercises.store';

const STORAGE_KEY = 'brainlm:workout-templates';
const STORAGE_VERSION = 3;

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

interface PlansState {
  plans: Record<string, WorkoutPlan>;
  planIds: string[];
  activePlanId: string | null;
}

interface PlansActions {
  createPlan: (plan: Omit<WorkoutPlan, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => string;
  updatePlan: (planId: string, updates: Partial<Omit<WorkoutPlan, 'id' | 'createdAt'>>) => void;
  deletePlan: (planId: string) => void;
  setActivePlan: (id: string | null) => void;
  updatePlanDay: (planId: string, dayId: string, updates: Partial<PlanDay>) => void;
  setPlanDayExercises: (planId: string, dayId: string, exercises: TemplateExercise[]) => void;
  addPlanDayExercise: (planId: string, dayId: string, exercise: Omit<TemplateExercise, 'id' | 'orderIndex'>) => void;
  updatePlanDayExercise: (planId: string, dayId: string, exerciseId: string, updates: Partial<TemplateExercise>) => void;
  removePlanDayExercise: (planId: string, dayId: string, exerciseId: string) => void;
  incrementPlanUsage: (planId: string) => void;
}

export type TemplatesStore = PlansState & PlansActions;

const initialState: PlansState = {
  plans: {},
  planIds: [],
  activePlanId: null,
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

const isValidPlan = (plan: unknown): plan is WorkoutPlan => {
  if (!plan || typeof plan !== 'object') return false;
  const p = plan as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.days) &&
    typeof p.createdAt === 'string' &&
    p.preferences !== undefined
  );
};

// Helper: update a day within a plan
function updateDayInPlan(plan: WorkoutPlan, dayId: string, updater: (day: PlanDay) => PlanDay): WorkoutPlan {
  return {
    ...plan,
    days: plan.days.map((d) => (d.id === dayId ? updater(d) : d)),
    updatedAt: new Date().toISOString(),
  };
}

export const useTemplatesStore = create<TemplatesStore>()(
  persist(
    (set) => ({
      ...initialState,

      createPlan: (plan): string => {
        const now = new Date().toISOString();
        const id = generateId();

        const newPlan: WorkoutPlan = {
          ...plan,
          id,
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
        };

        set((state) => ({
          plans: { ...state.plans, [id]: newPlan },
          planIds: [id, ...state.planIds],
          activePlanId: id,
        }));

        return id;
      },

      updatePlan: (planId, updates): void => {
        const now = new Date().toISOString();
        set((state) => {
          const existing = state.plans[planId];
          if (!existing) return state;
          return {
            plans: {
              ...state.plans,
              [planId]: { ...existing, ...updates, updatedAt: now },
            },
          };
        });
      },

      deletePlan: (planId): void => {
        set((state) => {
          const { [planId]: _, ...rest } = state.plans;
          return {
            plans: rest,
            planIds: state.planIds.filter((id) => id !== planId),
            activePlanId: state.activePlanId === planId ? null : state.activePlanId,
          };
        });
      },

      setActivePlan: (id): void => {
        set({ activePlanId: id });
      },

      updatePlanDay: (planId, dayId, updates): void => {
        set((state) => {
          const plan = state.plans[planId];
          if (!plan) return state;
          return {
            plans: {
              ...state.plans,
              [planId]: updateDayInPlan(plan, dayId, (day) => ({ ...day, ...updates })),
            },
          };
        });
      },

      setPlanDayExercises: (planId, dayId, exercises): void => {
        // Auto-resolve exercises that don't have a registry ID
        const registry = useExercisesStore.getState();
        const resolved = exercises.map((ex) => {
          if (ex.exerciseRegistryId) return ex;
          const def = registry.resolveExercise(ex.exerciseName, ex.muscleGroup, ex.equipmentType);
          return { ...ex, exerciseRegistryId: def.id };
        });

        set((state) => {
          const plan = state.plans[planId];
          if (!plan) return state;
          return {
            plans: {
              ...state.plans,
              [planId]: updateDayInPlan(plan, dayId, (day) => ({ ...day, exercises: resolved })),
            },
          };
        });
      },

      addPlanDayExercise: (planId, dayId, exercise): void => {
        // Auto-resolve registry ID if not provided
        let registryId = exercise.exerciseRegistryId;
        if (!registryId) {
          const registry = useExercisesStore.getState();
          const def = registry.resolveExercise(exercise.exerciseName, exercise.muscleGroup, exercise.equipmentType);
          registryId = def.id;
        }

        set((state) => {
          const plan = state.plans[planId];
          if (!plan) return state;
          return {
            plans: {
              ...state.plans,
              [planId]: updateDayInPlan(plan, dayId, (day) => ({
                ...day,
                exercises: [
                  ...day.exercises,
                  { ...exercise, id: generateId(), orderIndex: day.exercises.length, exerciseRegistryId: registryId },
                ],
              })),
            },
          };
        });
      },

      updatePlanDayExercise: (planId, dayId, exerciseId, updates): void => {
        // Re-resolve registry ID if exercise name is changing
        let resolvedUpdates = updates;
        if (updates.exerciseName) {
          const registry = useExercisesStore.getState();
          const def = registry.resolveExercise(
            updates.exerciseName,
            updates.muscleGroup || undefined,
            updates.equipmentType || undefined
          );
          resolvedUpdates = { ...updates, exerciseRegistryId: def.id };
        }

        set((state) => {
          const plan = state.plans[planId];
          if (!plan) return state;
          return {
            plans: {
              ...state.plans,
              [planId]: updateDayInPlan(plan, dayId, (day) => ({
                ...day,
                exercises: day.exercises.map((e) =>
                  e.id === exerciseId ? { ...e, ...resolvedUpdates } : e
                ),
              })),
            },
          };
        });
      },

      removePlanDayExercise: (planId, dayId, exerciseId): void => {
        set((state) => {
          const plan = state.plans[planId];
          if (!plan) return state;
          return {
            plans: {
              ...state.plans,
              [planId]: updateDayInPlan(plan, dayId, (day) => ({
                ...day,
                exercises: day.exercises
                  .filter((e) => e.id !== exerciseId)
                  .map((e, idx) => ({ ...e, orderIndex: idx })),
              })),
            },
          };
        });
      },

      incrementPlanUsage: (planId): void => {
        const now = new Date().toISOString();
        set((state) => {
          const plan = state.plans[planId];
          if (!plan) return state;
          return {
            plans: {
              ...state.plans,
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
        plans: state.plans,
        planIds: state.planIds,
        activePlanId: state.activePlanId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Version 1 was the old templates store — clear it
        if (version < 2) {
          return initialState;
        }

        if (!persistedState) return initialState;

        try {
          const state = persistedState as { plans?: Record<string, unknown>; planIds?: string[]; activePlanId?: string | null };
          const plans: Record<string, WorkoutPlan> = {};
          const planIds: string[] = [];

          if (state.plans) {
            for (const [id, plan] of Object.entries(state.plans)) {
              if (isValidPlan(plan)) {
                plans[id] = plan;
                planIds.push(id);
              }
            }
          }

          const orderedIds = state.planIds?.filter((id) => plans[id]) || planIds;

          // v2 → v3: add activePlanId (default null)
          const activePlanId = (version >= 3 && state.activePlanId && plans[state.activePlanId])
            ? state.activePlanId
            : null;

          return { plans, planIds: orderedIds, activePlanId };
        } catch {
          return initialState;
        }
      },
    }
  )
);

// Selectors
export const selectPlanById = (id: string) => (state: TemplatesStore): WorkoutPlan | undefined =>
  state.plans[id];

export const usePlan = (id: string) =>
  useTemplatesStore((state) => state.plans[id]);

export const usePlanDay = (planId: string, dayId: string) =>
  useTemplatesStore((state) => {
    const plan = state.plans[planId];
    return plan?.days.find((d) => d.id === dayId);
  });

export const useActivePlanId = () =>
  useTemplatesStore((state) => state.activePlanId);

export const useActivePlan = () =>
  useTemplatesStore((state) =>
    state.activePlanId ? state.plans[state.activePlanId] : undefined
  );
