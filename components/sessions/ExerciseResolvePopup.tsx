'use client';

import { useState, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { searchGlobalExercises } from '@/server/actions/exercise-resolve.actions';
import type { ExerciseEntry, MuscleGroup, EquipmentType } from '@/lib/sessions/types';
import { formatMuscleGroup } from '@/lib/gym/muscle-groups';

interface SearchResult {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
}

interface ExerciseResolvePopupProps {
  exercise: ExerciseEntry;
  onResolve: (exercise: ExerciseEntry, globalExerciseId: number, name: string, muscleGroup: MuscleGroup, equipmentType: EquipmentType) => void;
  onCreateCustom: (exercise: ExerciseEntry) => void;
  onDismiss: () => void;
}

export function ExerciseResolvePopup({
  exercise,
  onResolve,
  onCreateCustom,
  onDismiss,
}: ExerciseResolvePopupProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState(exercise.exerciseName);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    searchGlobalExercises(query, 10).then((res) => {
      if (!cancelled) {
        setResults(res as SearchResult[]);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[var(--color-line)] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">
              Identify exercise
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              &ldquo;{exercise.exerciseName}&rdquo;
            </p>
          </div>
          <button onClick={onDismiss} className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg)] rounded-lg border border-[var(--color-line)]">
            <Search className="w-4 h-4 text-[var(--color-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none"
              placeholder="Search exercises..."
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-[var(--color-line)]">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onResolve(exercise, r.id, r.name, r.muscleGroup, r.equipmentType)}
                  className="w-full text-left px-5 py-3 hover:bg-[var(--color-bg)] transition-colors"
                >
                  <p className="text-sm font-medium text-[var(--color-text)]">{r.name}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    {formatMuscleGroup(r.muscleGroup)} &middot; {r.equipmentType}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-[var(--color-muted)]">
              No matches found
            </div>
          )}
        </div>

        {/* Create custom */}
        <div className="px-5 py-3 border-t border-[var(--color-line)]">
          <button
            onClick={() => onCreateCustom(exercise)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--color-line)] text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Keep as custom exercise
          </button>
        </div>
      </div>
    </div>
  );
}
