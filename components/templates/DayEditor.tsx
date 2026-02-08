'use client';

import { useState } from 'react';
import { Zap, Loader2, RefreshCw } from 'lucide-react';
import { TemplateExerciseList } from './TemplateExerciseList';
import { GeneratePromptArea, EXERCISE_GENERATION_CHIPS } from './GeneratePromptArea';
import type { PlanDay, TemplateExercise, WorkoutPreferences } from '@/lib/sessions/types';
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
  const [userInstruction, setUserInstruction] = useState('');

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
        },
        userInstruction.trim() || undefined
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
        exerciseRegistryId: ex.exerciseRegistryId,
        targetSets: ex.targetSets,
        targetReps: ex.targetReps,
        targetWeight: ex.targetWeight,
        targetWeightUnit: ex.targetWeightUnit || 'kg',
        restSeconds: ex.restSeconds,
        notes: ex.notes,
        orderIndex: index,
      }));

      onSetExercises(templateExercises);
      setUserInstruction('');
    } catch {
      setError('Failed to generate exercises');
    } finally {
      setIsGenerating(false);
    }
  };

  if (day.exercises.length === 0 && !isGenerating) {
    return (
      <div>
        <GeneratePromptArea
          title="Generate Exercises"
          subtitle={day.name}
          helperText="Tell us your preferences and we'll create a personalized exercise list"
          placeholder="e.g., Include bench press, no machines, focus on compounds..."
          chips={EXERCISE_GENERATION_CHIPS}
          value={userInstruction}
          onChange={setUserInstruction}
          onSubmit={handleGenerate}
          submitLabel="Generate with AI"
          submitIcon={<Zap className="w-4 h-4" />}
          isLoading={isGenerating}
          error={error}
          variant="primary"
        />

        <div className="px-4">
          <TemplateExerciseList
            exercises={[]}
            editable
            onAddExercise={onAddExercise}
            onUpdateExercise={onUpdateExercise}
            onDeleteExercise={onDeleteExercise}
          />
        </div>
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
        <div className="border-t border-[var(--color-line)]">
          <GeneratePromptArea
            title="Regenerate"
            helperText="This will replace all current exercises"
            placeholder="e.g., Include bench press, no machines..."
            chips={EXERCISE_GENERATION_CHIPS}
            value={userInstruction}
            onChange={setUserInstruction}
            onSubmit={handleGenerate}
            submitLabel="Regenerate Exercises"
            submitIcon={<RefreshCw className="w-4 h-4" />}
            isLoading={isGenerating}
            loadingLabel="Regenerating..."
            error={error}
            variant="outline"
          />
        </div>
      )}
    </div>
  );
}
