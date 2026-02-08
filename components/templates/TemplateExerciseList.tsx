'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { TemplateExerciseRow } from './TemplateExerciseRow';
import { searchGlobalExercises } from '@/server/actions/exercise-resolve.actions';
import type { TemplateExercise, MuscleGroup, EquipmentType } from '@/lib/sessions/types';
import type { GlobalExercise } from '@/lib/gym/exercise-database';
import { formatMuscleGroup } from '@/lib/gym/muscle-groups';

interface TemplateExerciseListProps {
  exercises: TemplateExercise[];
  editable?: boolean;
  onUpdateExercise?: (exerciseId: string, updates: Partial<TemplateExercise>) => void;
  onDeleteExercise?: (exerciseId: string) => void;
  onAddExercise?: (exercise: Omit<TemplateExercise, 'id' | 'orderIndex'>) => void;
}

const muscleGroupOptions: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'obliques',
  'lower_back', 'traps', 'lats', 'full_body'
];

const equipmentOptions: EquipmentType[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight',
  'kettlebell', 'resistance_band', 'smith_machine', 'ez_bar', 'trap_bar', 'other'
];

function formatEquipment(eq: EquipmentType): string {
  return eq.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function AddExercisePicker({
  onAdd,
  onCancel
}: {
  onAdd: (exercise: Omit<TemplateExercise, 'id' | 'orderIndex'>) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalExercise[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Custom exercise state
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<EquipmentType>('barbell');
  const [customSets, setCustomSets] = useState('3');
  const [customReps, setCustomReps] = useState('10');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchGlobalExercises(query, 15);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelectGlobal = (ex: GlobalExercise) => {
    onAdd({
      exerciseName: ex.name,
      exerciseRegistryId: String(ex.id),
      muscleGroup: ex.muscleGroup,
      equipmentType: ex.equipmentType,
      targetSets: 3,
      targetReps: 10,
    });
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    onAdd({
      exerciseName: customName.trim(),
      muscleGroup: customMuscle,
      equipmentType: customEquipment,
      targetSets: parseInt(customSets) || 3,
      targetReps: parseInt(customReps) || 10,
    });
  };

  if (showCustom) {
    return (
      <div className="py-3 px-3 bg-[var(--color-bg)] border-t border-[var(--color-line)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--color-muted)]">Custom exercise</span>
          <button
            onClick={() => setShowCustom(false)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Back to search
          </button>
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Exercise name"
            className="w-full px-2 py-1.5 border border-[var(--color-line)] text-sm bg-transparent rounded"
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={customMuscle}
              onChange={e => setCustomMuscle(e.target.value as MuscleGroup)}
              className="flex-1 px-2 py-1 border border-[var(--color-line)] text-xs bg-transparent rounded"
            >
              {muscleGroupOptions.map(mg => (
                <option key={mg} value={mg}>{formatMuscleGroup(mg)}</option>
              ))}
            </select>
            <select
              value={customEquipment}
              onChange={e => setCustomEquipment(e.target.value as EquipmentType)}
              className="flex-1 px-2 py-1 border border-[var(--color-line)] text-xs bg-transparent rounded"
            >
              {equipmentOptions.map(eq => (
                <option key={eq} value={eq}>{formatEquipment(eq)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={customSets}
                onChange={e => setCustomSets(e.target.value)}
                className="w-12 px-1.5 py-1 border border-[var(--color-line)] text-xs text-center bg-transparent rounded"
                min="1"
              />
              <span className="text-xs text-[var(--color-muted)]">sets</span>
            </div>
            <span className="text-[var(--color-muted)]">x</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={customReps}
                onChange={e => setCustomReps(e.target.value)}
                className="w-12 px-1.5 py-1 border border-[var(--color-line)] text-xs text-center bg-transparent rounded"
                min="1"
              />
              <span className="text-xs text-[var(--color-muted)]">reps</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="px-3 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className="px-3 py-1 text-xs bg-[var(--color-text)] text-[var(--color-bg)] rounded hover:opacity-80 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 px-3 bg-[var(--color-bg)] border-t border-[var(--color-line)]">
      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="w-full pl-7 pr-8 py-1.5 border border-[var(--color-line)] text-sm bg-transparent rounded"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="max-h-48 overflow-y-auto">
        {isSearching && (
          <div className="py-2 text-center text-xs text-[var(--color-muted)]">Searching...</div>
        )}

        {!isSearching && results.length > 0 && results.map(ex => (
          <button
            key={ex.id}
            onClick={() => handleSelectGlobal(ex)}
            className="flex items-center gap-2 w-full py-1.5 px-2 text-left text-sm hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            <span className="flex-1 truncate text-[var(--color-text)]">{ex.name}</span>
            <span className="text-[10px] text-[var(--color-muted)] shrink-0">
              {formatMuscleGroup(ex.muscleGroup)} / {formatEquipment(ex.equipmentType)}
            </span>
          </button>
        ))}

        {!isSearching && query.length >= 2 && results.length === 0 && (
          <div className="py-2 text-center text-xs text-[var(--color-muted)]">
            No matches found
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] mt-2">
        <button
          onClick={() => setShowCustom(true)}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          + Custom exercise
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function TemplateExerciseList({
  exercises,
  editable,
  onUpdateExercise,
  onDeleteExercise,
  onAddExercise
}: TemplateExerciseListProps) {
  const [isAddingExercise, setIsAddingExercise] = useState(false);

  const sortedExercises = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="bg-[var(--color-surface)]">
      {sortedExercises.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-muted)]">
          No exercises yet. Add your first exercise to get started.
        </div>
      ) : (
        sortedExercises.map(exercise => (
          <TemplateExerciseRow
            key={exercise.id}
            exercise={exercise}
            editable={editable}
            onUpdate={updates => onUpdateExercise?.(exercise.id, updates)}
            onDelete={() => onDeleteExercise?.(exercise.id)}
          />
        ))
      )}

      {editable && !isAddingExercise && (
        <button
          onClick={() => setIsAddingExercise(true)}
          className="flex items-center gap-2 w-full py-3 px-3 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          <Plus className="w-4 h-4" />
          Add exercise
        </button>
      )}

      {isAddingExercise && onAddExercise && (
        <AddExercisePicker
          onAdd={(exercise) => {
            onAddExercise(exercise);
            setIsAddingExercise(false);
          }}
          onCancel={() => setIsAddingExercise(false)}
        />
      )}
    </div>
  );
}
