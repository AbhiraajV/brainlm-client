'use client';

import { useState, useMemo, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useExerciseLibrary } from '@/hooks/useExerciseLibrary';
import { ExerciseDetailRow } from './ExerciseDetailRow';
import { formatRelativeDate, formatWeight, trendArrow } from '@/lib/gym/exercise-library-utils';
import { getMuscleGroupColor, formatMuscleGroup, BROAD_MUSCLE_GROUPS, getBroadGroup } from '@/lib/gym/muscle-groups';
import { convertWeight } from '@/lib/gym/units';
import { useDisplayUnit, useSetDisplayUnit } from '@/store/gym-settings.store';
import type { ExerciseLibraryEntry, MuscleGroup, WeightUnit } from '@/lib/sessions/types';

function formatEquipmentType(et: string): string {
  return et.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

const trendColors: Record<string, string> = {
  up: 'text-[var(--color-lime)]',
  down: 'text-[var(--color-coral)]',
  flat: 'text-[var(--color-muted)]',
};

// All broad muscle groups for filter pills
const allMuscleGroups: MuscleGroup[] = BROAD_MUSCLE_GROUPS;

export function ExerciseLibrary() {
  const { exercises, isLoading, refresh } = useExerciseLibrary();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const displayUnit = useDisplayUnit();
  const setDisplayUnit = useSetDisplayUnit();

  // Derive which broad muscle groups actually exist in the data
  // (sub-groups map to their parent for filter purposes)
  const activeMuscleGroups = useMemo(() => {
    const broadSet = new Set<MuscleGroup>();
    for (const ex of exercises) broadSet.add(getBroadGroup(ex.muscleGroup));
    return allMuscleGroups.filter((mg) => broadSet.has(mg));
  }, [exercises]);

  // Filter exercises
  const filtered = useMemo(() => {
    let list = exercises;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((ex) => ex.exerciseName.toLowerCase().includes(q));
    }
    if (muscleFilter) {
      list = list.filter((ex) => getBroadGroup(ex.muscleGroup) === muscleFilter);
    }
    return list;
  }, [exercises, search, muscleFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const toggleExpand = (key: string) => {
    setExpandedId((prev) => (prev === key ? null : key));
  };

  const getKey = (ex: ExerciseLibraryEntry) =>
    ex.exerciseRegistryId ?? ex.exerciseName.toLowerCase();

  // Loading state
  if (isLoading && exercises.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state
  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-4">
        <p className="text-sm text-[var(--color-muted)]">No exercises tracked yet</p>
        <p className="text-xs text-[var(--color-muted)]/60 mt-1">
          Complete gym sessions to build your library
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Search + Refresh */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-line)]">
        <div className="flex-1 flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-line)] px-2 py-1.5 rounded">
          <Search className="w-3.5 h-3.5 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]/50"
          />
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setDisplayUnit('lbs')}
            className={`text-[10px] px-2 py-0.5 font-medium transition-colors ${
              displayUnit === 'lbs'
                ? 'bg-[var(--color-text)] text-[var(--color-bg)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            LB
          </button>
          <button
            onClick={() => setDisplayUnit('kg')}
            className={`text-[10px] px-2 py-0.5 font-medium transition-colors ${
              displayUnit === 'kg'
                ? 'bg-[var(--color-text)] text-[var(--color-bg)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            KG
          </button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Muscle group filter pills */}
      {activeMuscleGroups.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-[var(--color-line)] scrollbar-none">
          <button
            onClick={() => setMuscleFilter(null)}
            className={`shrink-0 px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
              muscleFilter === null
                ? 'bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]'
                : 'bg-transparent text-[var(--color-muted)] border-[var(--color-line)] hover:border-[var(--color-muted)]'
            }`}
          >
            All
          </button>
          {activeMuscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
              className={`shrink-0 px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                muscleFilter === mg
                  ? 'bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)]'
                  : 'bg-transparent text-[var(--color-muted)] border-[var(--color-line)] hover:border-[var(--color-muted)]'
              }`}
            >
              {formatMuscleGroup(mg)}
            </button>
          ))}
        </div>
      )}

      {/* Exercise list */}
      <div>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-[var(--color-muted)]">No matching exercises</p>
          </div>
        ) : (
          filtered.map((ex) => {
            const key = getKey(ex);
            const isExpanded = expandedId === key;
            // Determine unit from first set of most recent session
            const storedUnit = ex.sessions[0]?.sets[0]?.weightUnit ?? 'lbs';

            return (
              <div key={key}>
                {/* Summary row */}
                <div
                  onClick={() => toggleExpand(key)}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-line)] hover:bg-[var(--color-surface)]/50 cursor-pointer"
                >
                  {/* Expand icon */}
                  <div className="shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                    )}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text)] truncate">
                        {ex.exerciseName}
                      </span>
                      <span
                        className={`shrink-0 px-1.5 py-0 text-[9px] rounded-full ${
                          getMuscleGroupColor(ex.muscleGroup)
                        }`}
                      >
                        {formatMuscleGroup(ex.muscleGroup)}
                      </span>
                      <span className="shrink-0 text-[9px] text-[var(--color-muted)]/60">
                        {formatEquipmentType(ex.equipmentType)}
                      </span>
                      {!ex.isPlanOnly && ex.planSources && ex.planSources.length > 0 && (
                        <span className="shrink-0 px-1.5 py-0 text-[9px] rounded-full bg-[var(--color-lime)]/15 text-[var(--color-lime)]">
                          In plan
                        </span>
                      )}
                    </div>
                    {ex.isPlanOnly ? (
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted)]">
                        <span className="px-1.5 py-0 text-[9px] rounded-full bg-[var(--color-line)] text-[var(--color-muted)]">
                          Planned
                        </span>
                        <span>
                          {ex.planSources![0].targetSets}×{ex.planSources![0].targetReps}
                          {ex.planSources![0].targetWeight ? ` @ ${ex.planSources![0].targetWeight}` : ''}
                        </span>
                        <span className="text-[var(--color-line)]">|</span>
                        <span className="truncate">
                          {ex.planSources!.map((s) => s.dayLabel).join(', ')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-muted)]">
                        <span>{formatWeight(convertWeight(ex.prWeight, storedUnit, displayUnit), displayUnit)}</span>
                        <span className="text-[var(--color-line)]">|</span>
                        <span>~{Math.round(convertWeight(ex.prE1RM, storedUnit, displayUnit))} e1rm</span>
                        <span className="text-[var(--color-line)]">|</span>
                        <span>{ex.sessionCount} sessions</span>
                        <span className="text-[var(--color-line)]">|</span>
                        <span>{formatRelativeDate(ex.lastPerformed)}</span>
                      </div>
                    )}
                  </div>

                  {/* Trend arrow */}
                  {ex.progressTrend && (
                    <span
                      className={`text-sm font-bold shrink-0 ${
                        trendColors[ex.progressTrend] ?? ''
                      }`}
                    >
                      {trendArrow(ex.progressTrend)}
                    </span>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && <ExerciseDetailRow exercise={ex} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
