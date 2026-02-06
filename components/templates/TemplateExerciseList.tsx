'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TemplateExerciseRow } from './TemplateExerciseRow';
import type { TemplateExercise, MuscleGroup, EquipmentType } from '@/lib/sessions/types';

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

function formatMuscleGroup(mg: MuscleGroup): string {
  return mg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatEquipment(eq: EquipmentType): string {
  return eq.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function AddExerciseForm({
  onAdd,
  onCancel
}: {
  onAdd: (exercise: Omit<TemplateExercise, 'id' | 'orderIndex'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<EquipmentType>('barbell');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;

    onAdd({
      exerciseName: name.trim(),
      muscleGroup,
      equipmentType: equipment,
      targetSets: parseInt(sets) || 3,
      targetReps: parseInt(reps) || 10,
      targetWeight: weight ? parseFloat(weight) : undefined,
      targetWeightUnit: 'kg',
    });

    // Reset form
    setName('');
    setSets('3');
    setReps('10');
    setWeight('');
  };

  return (
    <div className="py-3 px-3 bg-[var(--color-bg)] border-t border-[var(--color-line)]">
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full px-2 py-1.5 border border-[var(--color-line)] text-sm bg-transparent rounded"
          autoFocus
        />
        <div className="flex gap-2">
          <select
            value={muscleGroup}
            onChange={e => setMuscleGroup(e.target.value as MuscleGroup)}
            className="flex-1 px-2 py-1 border border-[var(--color-line)] text-xs bg-transparent rounded"
          >
            {muscleGroupOptions.map(mg => (
              <option key={mg} value={mg}>{formatMuscleGroup(mg)}</option>
            ))}
          </select>
          <select
            value={equipment}
            onChange={e => setEquipment(e.target.value as EquipmentType)}
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
              value={sets}
              onChange={e => setSets(e.target.value)}
              className="w-12 px-1.5 py-1 border border-[var(--color-line)] text-xs text-center bg-transparent rounded"
              min="1"
            />
            <span className="text-xs text-[var(--color-muted)]">sets</span>
          </div>
          <span className="text-[var(--color-muted)]">x</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={reps}
              onChange={e => setReps(e.target.value)}
              className="w-12 px-1.5 py-1 border border-[var(--color-line)] text-xs text-center bg-transparent rounded"
              min="1"
            />
            <span className="text-xs text-[var(--color-muted)]">reps</span>
          </div>
          <span className="text-[var(--color-muted)]">@</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="—"
              className="w-14 px-1.5 py-1 border border-[var(--color-line)] text-xs text-center bg-transparent rounded"
            />
            <span className="text-xs text-[var(--color-muted)]">kg</span>
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
            onClick={handleAdd}
            disabled={!name.trim()}
            className="px-3 py-1 text-xs bg-[var(--color-text)] text-[var(--color-bg)] rounded hover:opacity-80 disabled:opacity-50"
          >
            Add
          </button>
        </div>
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
        <AddExerciseForm
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
