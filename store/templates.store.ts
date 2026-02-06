import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WorkoutTemplate, TemplateExercise, MuscleGroup } from '@/lib/sessions/types';

const STORAGE_KEY = 'brainlm:workout-templates';
const STORAGE_VERSION = 1;

// Helper to generate UUIDs
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

interface TemplatesState {
  templates: Record<string, WorkoutTemplate>;
  templateIds: string[];
}

interface TemplatesActions {
  createTemplate: (template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => string;
  updateTemplate: (id: string, updates: Partial<Omit<WorkoutTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  addExercise: (templateId: string, exercise: Omit<TemplateExercise, 'id' | 'orderIndex'>) => void;
  updateExercise: (templateId: string, exerciseId: string, updates: Partial<TemplateExercise>) => void;
  removeExercise: (templateId: string, exerciseId: string) => void;
  reorderExercises: (templateId: string, exerciseIds: string[]) => void;
  incrementUsage: (templateId: string) => void;
}

export type TemplatesStore = TemplatesState & TemplatesActions;

const initialState: TemplatesState = {
  templates: {},
  templateIds: [],
};

// Safe localStorage wrapper
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(name);
    } catch {
      console.warn('Failed to read from localStorage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(name, value);
    } catch {
      console.warn('Failed to write to localStorage');
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    } catch {
      console.warn('Failed to remove from localStorage');
    }
  },
};

// Validate template object
const isValidTemplate = (template: unknown): template is WorkoutTemplate => {
  if (!template || typeof template !== 'object') return false;
  const t = template as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Array.isArray(t.exercises) &&
    typeof t.createdAt === 'string'
  );
};

// Compute muscle groups from exercises
const computeMuscleGroups = (exercises: TemplateExercise[]): MuscleGroup[] => {
  const groups = new Set<MuscleGroup>();
  exercises.forEach(e => {
    groups.add(e.muscleGroup);
    e.secondaryMuscles?.forEach(m => groups.add(m));
  });
  return Array.from(groups);
};

export const useTemplatesStore = create<TemplatesStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createTemplate: (template): string => {
        const now = new Date().toISOString();
        const id = generateId();

        const newTemplate: WorkoutTemplate = {
          ...template,
          id,
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
          muscleGroups: computeMuscleGroups(template.exercises),
        };

        set((state) => ({
          templates: { ...state.templates, [id]: newTemplate },
          templateIds: [id, ...state.templateIds],
        }));

        return id;
      },

      updateTemplate: (id, updates): void => {
        const now = new Date().toISOString();

        set((state) => {
          const existing = state.templates[id];
          if (!existing) return state;

          const updated: WorkoutTemplate = {
            ...existing,
            ...updates,
            updatedAt: now,
            muscleGroups: updates.exercises
              ? computeMuscleGroups(updates.exercises)
              : existing.muscleGroups,
          };

          return {
            templates: { ...state.templates, [id]: updated },
          };
        });
      },

      deleteTemplate: (id): void => {
        set((state) => {
          const { [id]: _, ...rest } = state.templates;
          return {
            templates: rest,
            templateIds: state.templateIds.filter((tid) => tid !== id),
          };
        });
      },

      addExercise: (templateId, exercise): void => {
        const now = new Date().toISOString();

        set((state) => {
          const template = state.templates[templateId];
          if (!template) return state;

          const newExercise: TemplateExercise = {
            ...exercise,
            id: generateId(),
            orderIndex: template.exercises.length,
          };

          const updatedExercises = [...template.exercises, newExercise];

          return {
            templates: {
              ...state.templates,
              [templateId]: {
                ...template,
                exercises: updatedExercises,
                muscleGroups: computeMuscleGroups(updatedExercises),
                updatedAt: now,
              },
            },
          };
        });
      },

      updateExercise: (templateId, exerciseId, updates): void => {
        const now = new Date().toISOString();

        set((state) => {
          const template = state.templates[templateId];
          if (!template) return state;

          const updatedExercises = template.exercises.map((e) =>
            e.id === exerciseId ? { ...e, ...updates } : e
          );

          return {
            templates: {
              ...state.templates,
              [templateId]: {
                ...template,
                exercises: updatedExercises,
                muscleGroups: computeMuscleGroups(updatedExercises),
                updatedAt: now,
              },
            },
          };
        });
      },

      removeExercise: (templateId, exerciseId): void => {
        const now = new Date().toISOString();

        set((state) => {
          const template = state.templates[templateId];
          if (!template) return state;

          const updatedExercises = template.exercises
            .filter((e) => e.id !== exerciseId)
            .map((e, idx) => ({ ...e, orderIndex: idx }));

          return {
            templates: {
              ...state.templates,
              [templateId]: {
                ...template,
                exercises: updatedExercises,
                muscleGroups: computeMuscleGroups(updatedExercises),
                updatedAt: now,
              },
            },
          };
        });
      },

      reorderExercises: (templateId, exerciseIds): void => {
        const now = new Date().toISOString();

        set((state) => {
          const template = state.templates[templateId];
          if (!template) return state;

          const exerciseMap = new Map(template.exercises.map((e) => [e.id, e]));
          const reorderedExercises = exerciseIds
            .map((id, idx) => {
              const exercise = exerciseMap.get(id);
              return exercise ? { ...exercise, orderIndex: idx } : null;
            })
            .filter((e): e is TemplateExercise => e !== null);

          return {
            templates: {
              ...state.templates,
              [templateId]: {
                ...template,
                exercises: reorderedExercises,
                updatedAt: now,
              },
            },
          };
        });
      },

      incrementUsage: (templateId): void => {
        const now = new Date().toISOString();

        set((state) => {
          const template = state.templates[templateId];
          if (!template) return state;

          return {
            templates: {
              ...state.templates,
              [templateId]: {
                ...template,
                usageCount: template.usageCount + 1,
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
        templates: state.templates,
        templateIds: state.templateIds,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState) {
          return initialState;
        }

        try {
          const state = persistedState as { templates?: Record<string, unknown>; templateIds?: string[] };
          const templates: Record<string, WorkoutTemplate> = {};
          const templateIds: string[] = [];

          if (state.templates) {
            for (const [id, template] of Object.entries(state.templates)) {
              if (isValidTemplate(template)) {
                templates[id] = template;
                templateIds.push(id);
              }
            }
          }

          // Use stored order if available, otherwise use collected IDs
          const orderedIds = state.templateIds?.filter((id) => templates[id]) || templateIds;

          return {
            templates,
            templateIds: orderedIds,
          };
        } catch {
          console.warn('Failed to migrate templates data, resetting to initial state');
          return initialState;
        }
      },
    }
  )
);

// Selectors - NOTE: selectAllTemplates creates a new array, use with useMemo in components
export const selectTemplateById = (id: string) => (state: TemplatesStore): WorkoutTemplate | undefined =>
  state.templates[id];

// Hook for single template - returns stable reference
export const useTemplate = (id: string) =>
  useTemplatesStore((state) => state.templates[id]);
