import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DietGoalProfile } from '@/lib/sessions/types';
import { toKg } from '@/lib/diet/plan-utils';

const STORAGE_KEY = 'brainlm:diet-goals';
const STORAGE_VERSION = 3;

interface DietGoalsState {
  profile: DietGoalProfile | null;
  versions: DietGoalProfile[];
}

interface DietGoalsActions {
  setProfile: (profile: DietGoalProfile) => void;
  clearProfile: () => void;
  deleteVersion: (createdAt: string) => void;
}

export type DietGoalsStore = DietGoalsState & DietGoalsActions;

const initialState: DietGoalsState = {
  profile: null,
  versions: [],
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

export const useDietGoalsStore = create<DietGoalsStore>()(
  persist(
    (set) => ({
      ...initialState,

      setProfile: (profile): void => {
        set((state) => {
          // Dedupe by createdAt: if match, replace in-place then move to head
          const existing = state.versions.findIndex(
            (v) => v.createdAt === profile.createdAt
          );
          let newVersions: DietGoalProfile[];
          if (existing >= 0) {
            // Replace and move to front
            newVersions = [
              profile,
              ...state.versions.filter((_, i) => i !== existing),
            ];
          } else {
            // Prepend new version
            newVersions = [profile, ...state.versions];
          }
          return { profile, versions: newVersions };
        });
      },

      clearProfile: (): void => {
        set({ profile: null, versions: [] });
      },

      deleteVersion: (createdAt): void => {
        set((state) => {
          const newVersions = state.versions.filter(
            (v) => v.createdAt !== createdAt
          );
          return {
            versions: newVersions,
            profile: newVersions[0] ?? null,
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        profile: state.profile,
        versions: state.versions,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 1) return initialState;
        if (!persistedState) return initialState;

        try {
          const state = persistedState as { profile?: unknown; versions?: unknown };

          // v2 → v3: wrap single profile into versions array
          if (version < 3) {
            if (state.profile && typeof state.profile === 'object') {
              const p = state.profile as Record<string, unknown>;

              // Apply v1→v2 migration if needed
              if (typeof p.weight === 'number' && typeof p.tdee === 'number' && p.targets) {
                if (version < 2 && p.targetWeeklyChange === undefined) {
                  const goal = p.dietGoal as string;
                  if (goal === 'weight_loss') {
                    p.targetWeeklyChange = 0.5;
                  } else if (goal === 'muscle_gain') {
                    p.targetWeeklyChange = 0.25;
                  } else {
                    p.targetWeeklyChange = 0;
                  }
                }
                const profile = state.profile as DietGoalProfile;
                return { profile, versions: [profile] };
              }
            }
            return initialState;
          }

          // v3+: validate existing shape
          if (state.profile && typeof state.profile === 'object') {
            const p = state.profile as Record<string, unknown>;
            if (typeof p.weight === 'number' && typeof p.tdee === 'number' && p.targets) {
              const versions = Array.isArray(state.versions) ? state.versions as DietGoalProfile[] : [state.profile as DietGoalProfile];
              return { profile: state.profile as DietGoalProfile, versions };
            }
          }
          return initialState;
        } catch {
          return initialState;
        }
      },
    }
  )
);

// Selectors
export const useDietGoalProfile = () =>
  useDietGoalsStore((state) => state.profile);

export const useDietGoalVersions = () =>
  useDietGoalsStore((state) => state.versions);

export const useWeightTrend = () => {
  const versions = useDietGoalsStore((state) => state.versions);
  return useMemo(
    () =>
      versions
        .filter((v) => v.weight != null)
        .map((v) => ({
          date: v.createdAt,
          weight: Math.round(toKg(v.weight, v.weightUnit) * 10) / 10,
        }))
        .reverse(),
    [versions]
  );
};

export const useBodyFatTrend = () => {
  const versions = useDietGoalsStore((state) => state.versions);
  return useMemo(
    () =>
      versions
        .filter((v) => v.bodyFatPercent != null)
        .map((v) => ({
          date: v.createdAt,
          bodyFatPercent: v.bodyFatPercent!,
        }))
        .reverse(),
    [versions]
  );
};
