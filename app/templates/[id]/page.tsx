'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check, X, Zap } from 'lucide-react';
import { useTemplatesStore, useTemplate } from '@/store/templates.store';
import { useSessionsStore } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';
import { TemplateExerciseList, StartWorkoutButton, TemplateChat } from '@/components/templates';
import { BackButton } from '@/components/ui/BackButton';
import { workoutFromTemplate, estimateWorkoutDuration } from '@/lib/templates/utils';
import type { MuscleGroup, WorkoutTemplate } from '@/lib/sessions/types';

function formatMuscleGroup(mg: MuscleGroup): string {
  return mg.replace(/_/g, ' ');
}

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const router = useRouter();

  const template = useTemplate(id);
  const updateTemplate = useTemplatesStore((s) => s.updateTemplate);
  const addExercise = useTemplatesStore((s) => s.addExercise);
  const updateExercise = useTemplatesStore((s) => s.updateExercise);
  const removeExercise = useTemplatesStore((s) => s.removeExercise);
  const incrementUsage = useTemplatesStore((s) => s.incrementUsage);

  const createSession = useSessionsStore((s) => s.createSession);
  const setTrackerType = useSessionsStore((s) => s.setTrackerType);
  const setWorkoutLog = useSessionsStore((s) => s.setWorkoutLog);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);

  const handleSaveName = () => {
    if (editedName.trim() && template) {
      updateTemplate(id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleSaveDescription = () => {
    if (template) {
      updateTemplate(id, { description: editedDescription.trim() || undefined });
    }
    setIsEditingDescription(false);
  };

  const handleStartWorkout = () => {
    if (!template) return;
    const sessionId = createSession(template.name, `Workout from ${template.name} template`);
    setTrackerType(sessionId, 'gym');
    const workoutLog = workoutFromTemplate(template);
    setWorkoutLog(sessionId, workoutLog);
    incrementUsage(template.id);
    router.push(`/sessions/${sessionId}`);
  };

  const handleTemplateGenerated = (
    generatedTemplate: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
    _summary: string
  ) => {
    updateTemplate(id, {
      name: generatedTemplate.name,
      description: generatedTemplate.description,
      exercises: generatedTemplate.exercises,
    });
    setShowAIChat(false);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Template</div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <div className="text-sm font-medium text-[var(--color-text)]">Template</div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4">
          <p className="text-sm text-[var(--color-text)]">Template not found</p>
          <button
            onClick={() => router.push('/templates')}
            className="mt-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Back to templates
          </button>
        </main>
        <BackButton />
      </div>
    );
  }

  const estimatedDuration = estimateWorkoutDuration(template);
  const totalSets = template.exercises.reduce((sum, e) => sum + e.targetSets, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm font-medium bg-transparent border-b border-[var(--color-lime)] focus:outline-none"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <button onClick={handleSaveName} className="p-1 text-[var(--color-lime)]">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setEditedName(template.name); setIsEditingName(true); }}
            className="flex items-center gap-1.5 group"
          >
            <span className="text-sm font-medium text-[var(--color-text)]">
              {template.name}
            </span>
            <Pencil className="w-3 h-3 text-[var(--color-muted)] opacity-0 group-hover:opacity-100" />
          </button>
        )}

        {/* AI button in header */}
        {template.exercises.length > 0 && !showAIChat && (
          <button
            onClick={() => setShowAIChat(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/10"
          >
            <Zap className="w-3 h-3" />
            AI
          </button>
        )}

        {showAIChat && (
          <button
            onClick={() => setShowAIChat(false)}
            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* AI Chat */}
        {(template.exercises.length === 0 || showAIChat) && (
          <div className="flex-1 flex flex-col">
            <TemplateChat
              onTemplateGenerated={handleTemplateGenerated}
              onCancel={template.exercises.length > 0 ? () => setShowAIChat(false) : undefined}
            />
          </div>
        )}

        {/* Template content */}
        {template.exercises.length > 0 && !showAIChat && (
          <>
            {/* Info bar */}
            <div className="px-4 py-2 border-b border-[var(--color-line)] flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
              <span>{template.exercises.length} exercises</span>
              <span className="text-[var(--color-line)]">|</span>
              <span>{totalSets} sets</span>
              {estimatedDuration > 0 && (
                <>
                  <span className="text-[var(--color-line)]">|</span>
                  <span>~{estimatedDuration}min</span>
                </>
              )}
              {template.usageCount > 0 && (
                <>
                  <span className="text-[var(--color-line)]">|</span>
                  <span>{template.usageCount}x used</span>
                </>
              )}
            </div>

            {/* Description */}
            {isEditingDescription ? (
              <div className="px-4 py-2 border-b border-[var(--color-line)]">
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Add description..."
                  className="w-full px-2 py-1 text-xs bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                  >
                    cancel
                  </button>
                  <button
                    onClick={handleSaveDescription}
                    className="px-2 py-0.5 text-[10px] text-[var(--color-lime)]"
                  >
                    save
                  </button>
                </div>
              </div>
            ) : template.description ? (
              <button
                onClick={() => { setEditedDescription(template.description || ''); setIsEditingDescription(true); }}
                className="px-4 py-2 text-xs text-[var(--color-muted)] text-left border-b border-[var(--color-line)] hover:text-[var(--color-text)]"
              >
                {template.description}
              </button>
            ) : (
              <button
                onClick={() => { setEditedDescription(''); setIsEditingDescription(true); }}
                className="px-4 py-2 text-xs text-[var(--color-muted)]/50 text-left border-b border-[var(--color-line)] hover:text-[var(--color-muted)]"
              >
                + description
              </button>
            )}

            {/* Muscle groups */}
            {template.muscleGroups.length > 0 && (
              <div className="px-4 py-2 flex flex-wrap gap-1 border-b border-[var(--color-line)]">
                {template.muscleGroups.map(mg => (
                  <span
                    key={mg}
                    className="text-[10px] px-1.5 py-0.5 text-[var(--color-muted)] border border-[var(--color-line)]"
                  >
                    {formatMuscleGroup(mg)}
                  </span>
                ))}
              </div>
            )}

            {/* Exercises */}
            <div className="flex-1">
              <TemplateExerciseList
                exercises={template.exercises}
                editable
                onUpdateExercise={(exerciseId, updates) => updateExercise(id, exerciseId, updates)}
                onDeleteExercise={(exerciseId) => removeExercise(id, exerciseId)}
                onAddExercise={(exercise) => addExercise(id, exercise)}
              />
            </div>

            {/* Spacer */}
            <div className="h-20" />
          </>
        )}
      </main>

      {/* Start button */}
      {template.exercises.length > 0 && !showAIChat && (
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent pt-6">
          <StartWorkoutButton
            onClick={handleStartWorkout}
            disabled={template.exercises.length === 0}
          />
        </div>
      )}

      <BackButton />
    </div>
  );
}
