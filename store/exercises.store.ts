import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MuscleGroup, EquipmentType } from '@/lib/sessions/types';
import { normalizeExerciseName } from '@/lib/gym/exercise-names';

const STORAGE_KEY = 'brainlm:exercise-registry';
const STORAGE_VERSION = 2;

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

export interface ExerciseDefinition {
  id: string;
  canonicalName: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  aliases: string[];
}

export interface KnownExerciseInput {
  exerciseName: string;
  exerciseRegistryId?: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
}

interface ExerciseRegistryState {
  exercises: Record<string, ExerciseDefinition>;
  nameIndex: Record<string, string>; // normalized name → exercise id
}

interface ExerciseRegistryActions {
  resolveExercise(
    name: string,
    muscleGroup?: MuscleGroup,
    equipmentType?: EquipmentType
  ): ExerciseDefinition;
  addAlias(exerciseId: string, alias: string): void;
  seedFromNames(names: string[]): void;
  seedFromServer(knownExercises: KnownExerciseInput[]): void;
}

export type ExerciseRegistryStore = ExerciseRegistryState & ExerciseRegistryActions;

const initialState: ExerciseRegistryState = {
  exercises: {},
  nameIndex: {},
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

export const useExercisesStore = create<ExerciseRegistryStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      resolveExercise: (
        name: string,
        muscleGroup?: MuscleGroup,
        equipmentType?: EquipmentType
      ): ExerciseDefinition => {
        const key = normalizeExerciseName(name);
        const state = get();

        // Check existing index
        const existingId = state.nameIndex[key];
        if (existingId && state.exercises[existingId]) {
          return state.exercises[existingId];
        }

        // Create new definition
        const id = generateId();
        const def: ExerciseDefinition = {
          id,
          canonicalName: name.trim(),
          muscleGroup: muscleGroup || 'full_body',
          equipmentType: equipmentType || 'other',
          aliases: [],
        };

        set((s) => ({
          exercises: { ...s.exercises, [id]: def },
          nameIndex: { ...s.nameIndex, [key]: id },
        }));

        return def;
      },

      addAlias: (exerciseId: string, alias: string): void => {
        const key = normalizeExerciseName(alias);
        if (!key) return;

        set((s) => {
          const def = s.exercises[exerciseId];
          if (!def) return s;
          if (s.nameIndex[key]) return s;

          return {
            exercises: {
              ...s.exercises,
              [exerciseId]: {
                ...def,
                aliases: [...def.aliases, alias.trim()],
              },
            },
            nameIndex: { ...s.nameIndex, [key]: exerciseId },
          };
        });
      },

      seedFromNames: (names: string[]): void => {
        const state = get();
        const newExercises = { ...state.exercises };
        const newIndex = { ...state.nameIndex };
        let changed = false;

        for (const name of names) {
          const normalized = name.trim();
          if (!normalized) continue;
          const key = normalizeExerciseName(normalized);
          if (newIndex[key]) continue;

          const id = generateId();
          newExercises[id] = {
            id,
            canonicalName: normalized,
            muscleGroup: 'full_body',
            equipmentType: 'other',
            aliases: [],
          };
          newIndex[key] = id;
          changed = true;
        }

        if (changed) {
          set({ exercises: newExercises, nameIndex: newIndex });
        }
      },

      seedFromServer: (knownExercises: KnownExerciseInput[]): void => {
        const state = get();
        const newExercises = { ...state.exercises };
        const newIndex = { ...state.nameIndex };
        let changed = false;

        for (const ke of knownExercises) {
          const key = normalizeExerciseName(ke.exerciseName);
          if (newIndex[key]) continue;

          const id = ke.exerciseRegistryId || generateId();
          newExercises[id] = {
            id,
            canonicalName: ke.exerciseName,
            muscleGroup: ke.muscleGroup,
            equipmentType: ke.equipmentType,
            aliases: [],
          };
          newIndex[key] = id;
          changed = true;
        }

        if (changed) set({ exercises: newExercises, nameIndex: newIndex });
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        exercises: state.exercises,
        nameIndex: state.nameIndex,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1 || !persistedState) return initialState;

        // v1 → v2: re-index using normalization
        if (version === 1) {
          const old = persistedState as ExerciseRegistryState;
          const newIndex: Record<string, string> = {};

          for (const [, def] of Object.entries(old.exercises)) {
            const key = normalizeExerciseName(def.canonicalName);
            if (!newIndex[key]) {
              newIndex[key] = def.id;
            }
            // Also index aliases
            for (const alias of def.aliases) {
              const aliasKey = normalizeExerciseName(alias);
              if (!newIndex[aliasKey]) {
                newIndex[aliasKey] = def.id;
              }
            }
          }

          return { exercises: old.exercises, nameIndex: newIndex };
        }

        return persistedState as ExerciseRegistryState;
      },
    }
  )
);

// Selectors
export const useExerciseById = (id: string) =>
  useExercisesStore((s) => s.exercises[id]);

export const useExerciseByName = (name: string) =>
  useExercisesStore((s) => {
    const key = normalizeExerciseName(name);
    const eid = s.nameIndex[key];
    return eid ? s.exercises[eid] : undefined;
  });
