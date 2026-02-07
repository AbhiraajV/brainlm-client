'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { TemplateExerciseList } from './TemplateExerciseList';
import type { PlanDay, TemplateExercise, WorkoutPreferences, MuscleGroup } from '@/lib/sessions/types';
import { generateDayExercises } from '@/server/actions/template-suggestion.actions';

interface DayEditorProps {
  day: PlanDay;
  preferences: WorkoutPreferences;
  allDays: PlanDay[];
  onSetExercises: (exercises: TemplateExercise[]) => void;
  onAddExercise: (exercise: Omit<TemplateExercise, 'id' | 'orderIndex'>) => void;
  onUpdateExercise: (exerciseId: string, updates: Partial<TemplateExercise>) => void;
  onDeleteExercise: (exerciseId: string) => void;
}

export function DayEditor({
  day,
  preferences,
  allDays,
  onSetExercises,
  onAddExercise,
  onUpdateExercise,
  onDeleteExercise,
}: DayEditorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const planContext = allDays.map((d) => ({
        name: d.name,
        targetMuscles: d.targetMuscles,
        exercises: d.exercises.map((e) => ({ exerciseName: e.exerciseName })),
      }));

      const { exercises, error: genError } = await generateDayExercises(
        preferences,
        planContext,
        {
          name: day.name,
          targetMuscles: day.targetMuscles,
          estimatedDuration: day.estimatedDuration,
        }
      );

      if (genError || !exercises) {
        setError(genError || 'Failed to generate exercises');
        return;
      }

      const templateExercises: TemplateExercise[] = exercises.map((ex, index) => ({
        id: crypto.randomUUID(),
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        secondaryMuscles: ex.secondaryMuscles,
        equipmentType: ex.equipmentType,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        targetWeightUnit: ex.targetWeightUnit || 'kg',
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        orderIndex: index,
      }));

      onSetExercises(templateExercises);
    } catch {
      setError('Failed to generate exercises');
    } finally {
      setIsGenerating(false);
    }
  };

  if (day.exercises.length === 0 && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 gap-4">
        <p className="text-sm text-[var(--color-muted)]">No exercises yet</p>

        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--color-lime)] text-[var(--color-bg)] hover:bg-[var(--color-lime)]/90 transition-colors"
        >
          <Zap className="w-4 h-4" />
          Generate with AI
        </button>

        <div className="w-full">
          <TemplateExerciseList
            exercises={[]}
            editable
            onAddExercise={onAddExercise}
            onUpdateExercise={onUpdateExercise}
            onDeleteExercise={onDeleteExercise}
          />
        </div>

        {error && (
          <p className="text-xs text-[var(--color-coral)]">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {isGenerating && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-line)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-lime)]" />
          <span className="text-xs text-[var(--color-muted)]">Generating exercises...</span>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-[var(--color-coral)]">{error}</div>
      )}

      <TemplateExerciseList
        exercises={day.exercises}
        editable
        onAddExercise={onAddExercise}
        onUpdateExercise={onUpdateExercise}
        onDeleteExercise={onDeleteExercise}
      />

      {day.exercises.length > 0 && (
        <div className="px-4 py-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-lime)] transition-colors disabled:opacity-40"
          >
            <Zap className="w-3 h-3" />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
