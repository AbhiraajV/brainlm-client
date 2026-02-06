'use client';

import { useState, useCallback } from 'react';
import { GripVertical, X, Check } from 'lucide-react';
import type { TemplateExercise, MuscleGroup, EquipmentType, WeightUnit } from '@/lib/sessions/types';

interface TemplateExerciseRowProps {
  exercise: TemplateExercise;
  editable?: boolean;
  onUpdate?: (updates: Partial<TemplateExercise>) => void;
  onDelete?: () => void;
}

// Muscle group colors
const muscleGroupColors: Record<MuscleGroup, string> = {
  chest: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  back: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  shoulders: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  biceps: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  triceps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  forearms: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  quadriceps: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  hamstrings: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  glutes: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  calves: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  abs: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  obliques: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  lower_back: 'bg-[var(--color-lime)]/20 text-[var(--color-lime)]',
  traps: 'bg-[var(--color-coral)]/20 text-[var(--color-coral)]',
  lats: 'bg-[var(--color-mint)]/20 text-[var(--color-mint)]',
  full_body: 'bg-[var(--color-line)] text-[var(--color-muted)]',
};

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

export function TemplateExerciseRow({ exercise, editable, onUpdate, onDelete }: TemplateExerciseRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(exercise.exerciseName);
  const [sets, setSets] = useState(exercise.targetSets.toString());
  const [reps, setReps] = useState(exercise.targetReps.toString());
  const [weight, setWeight] = useState(exercise.targetWeight?.toString() || '');
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscleGroup);
  const [equipment, setEquipment] = useState(exercise.equipmentType);

  const handleSave = useCallback(() => {
    onUpdate?.({
      exerciseName: name.trim() || exercise.exerciseName,
      targetSets: parseInt(sets) || exercise.targetSets,
      targetReps: parseInt(reps) || exercise.targetReps,
      targetWeight: weight ? parseFloat(weight) : undefined,
      muscleGroup,
      equipmentType: equipment,
    });
    setIsEditing(false);
  }, [name, sets, reps, weight, muscleGroup, equipment, exercise, onUpdate]);

  const handleCancel = () => {
    setName(exercise.exerciseName);
    setSets(exercise.targetSets.toString());
    setReps(exercise.targetReps.toString());
    setWeight(exercise.targetWeight?.toString() || '');
    setMuscleGroup(exercise.muscleGroup);
    setEquipment(exercise.equipmentType);
    setIsEditing(false);
  };

  if (editable && isEditing) {
    return (
      <div className="py-3 px-3 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
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
              onClick={handleCancel}
              className="px-3 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs bg-[var(--color-text)] text-[var(--color-bg)] rounded hover:opacity-80"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 py-3 px-3 border-b border-[var(--color-line)] group cursor-pointer hover:bg-[var(--color-bg)]"
      onClick={() => editable && setIsEditing(true)}
    >
      {editable && (
        <GripVertical className="w-4 h-4 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 cursor-grab" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[var(--color-text)] truncate">
            {exercise.exerciseName}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 font-medium ${muscleGroupColors[exercise.muscleGroup]}`}>
            {formatMuscleGroup(exercise.muscleGroup)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-muted)]">
          <span>{exercise.targetSets} sets x {exercise.targetReps} reps</span>
          {exercise.targetWeight && (
            <>
              <span>@</span>
              <span>{exercise.targetWeight} {exercise.targetWeightUnit || 'kg'}</span>
            </>
          )}
          <span>·</span>
          <span>{formatEquipment(exercise.equipmentType)}</span>
        </div>
      </div>
      {editable && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-error)]"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
