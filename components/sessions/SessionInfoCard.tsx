'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { SessionKnowledge as SessionKnowledgeType, SessionUnderstanding as SessionUnderstandingType, SessionAnalysis as SessionAnalysisType, TrackerType } from '@/lib/sessions/types';
import { useTrackerStore, type ActiveTrackerType } from '@/store/tracker.store';
import { useSessionKnowledgeWithCache } from '@/hooks/useSessionKnowledgeWithCache';
import { useSessionAnalysisWithCache } from '@/hooks/useSessionAnalysisWithCache';
import { useDietGoalProfile } from '@/store/diet-goals.store';

interface Props {
  trackerType: ActiveTrackerType;
  title: string;
  context?: string;
  knowledge?: SessionKnowledgeType;
  understanding?: SessionUnderstandingType;
  analysis?: SessionAnalysisType;
  isCompleted?: boolean;
  hasEvents?: boolean;
  onComplete?: () => void;
  isCompleting?: boolean;
  gymWorkoutContext?: { workoutName: string; muscleGroups: string[]; exerciseNames: string[] } | null;
}

export function SessionInfoCard({
  trackerType,
  title,
  context,
  knowledge,
  analysis,
  isCompleted,
  hasEvents,
  onComplete,
  isCompleting,
  gymWorkoutContext
}: Props) {
  const isGymSession = trackerType === 'gym';
  const displayTitle = isGymSession ? 'Gym' : title;

  const analyzingRef = useRef(false);
  const knowledgeFetchedRef = useRef<string | null>(null);
  const analysisWorkoutKeyRef = useRef<string | undefined>(undefined);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const setKnowledge = useTrackerStore((state) => state.setKnowledge);
  const setAnalysis = useTrackerStore((state) => state.setAnalysis);

  const { fetchKnowledge: fetchKnowledgeWithCache } = useSessionKnowledgeWithCache();
  const { analyzeWithCache } = useSessionAnalysisWithCache();
  const dietProfile = useDietGoalProfile();

  const dietTargets = useMemo(() => {
    if (trackerType !== 'diet' || !dietProfile) return undefined;
    return {
      tdee: dietProfile.tdee,
      calories: dietProfile.targets.calories,
      protein: dietProfile.targets.protein,
      carbs: dietProfile.targets.carbs,
      fat: dietProfile.targets.fat,
      goal: dietProfile.dietGoal,
      proteinPerKg: dietProfile.proteinPerKg,
      weightKg: dietProfile.weightUnit === 'kg' ? dietProfile.weight : dietProfile.weight * 0.453592,
    };
  }, [trackerType, dietProfile]);

  useEffect(() => {
    if (knowledge) return;
    if (knowledgeFetchedRef.current === trackerType) return;
    if (trackerType === 'habit') return;

    knowledgeFetchedRef.current = trackerType;

    async function loadKnowledge() {
      setIsLoadingKnowledge(true);
      try {
        const cachedResult = await fetchKnowledgeWithCache(trackerType);
        if (cachedResult) {
          setKnowledge(trackerType, cachedResult.knowledge);
        }
      } catch (err) {
        console.error('[SessionInfoCard] Error fetching knowledge:', err);
      } finally {
        setIsLoadingKnowledge(false);
      }
    }

    loadKnowledge();
  }, [trackerType, knowledge, setKnowledge, fetchKnowledgeWithCache]);

  useEffect(() => {
    if (!knowledge || analyzingRef.current) return;
    if (trackerType === 'gym' && gymWorkoutContext === null) return;

    const currentWorkoutKey = gymWorkoutContext
      ? `${gymWorkoutContext.workoutName}:${[...gymWorkoutContext.muscleGroups].sort().join(',')}`
      : undefined;

    if (analysis && analysisWorkoutKeyRef.current === currentWorkoutKey) return;

    const totalItems = knowledge.interpretations.length + knowledge.patterns.length +
                       knowledge.insights.length + knowledge.reviews.length +
                       knowledge.events.length;
    if (totalItems === 0) return;

    analyzingRef.current = true;
    analysisWorkoutKeyRef.current = currentWorkoutKey;

    async function generateAnalysis() {
      setIsLoadingAnalysis(true);
      try {
        const cachedResult = await analyzeWithCache(title, context || '', knowledge!, trackerType, dietTargets, gymWorkoutContext ?? undefined);
        if (cachedResult) {
          setAnalysis(trackerType, cachedResult.analysis);
        }
      } catch (err) {
        console.error('[SessionInfoCard] Error analyzing session:', err);
      } finally {
        setIsLoadingAnalysis(false);
        analyzingRef.current = false;
      }
    }

    generateAnalysis();
    return () => {
      analyzingRef.current = false;
    };
  }, [title, context, knowledge, analysis, trackerType, setAnalysis, analyzeWithCache, dietTargets, gymWorkoutContext]);

  const isLoading = isLoadingKnowledge || isLoadingAnalysis;

  const coachLabel = { gym: 'gym', diet: 'diet', habit: 'habit' }[trackerType];

  return (
    <div className="-mx-5 sm:-mx-7 px-4 py-2.5 border-b border-[var(--color-line)] flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-medium text-[var(--color-text)] truncate">
          {displayTitle}
        </h2>
        {coachLabel && (
          <span className="text-[10px] px-1.5 py-0.5 text-[var(--color-muted)] border border-[var(--color-line)] flex-shrink-0">
            {coachLabel}
          </span>
        )}
        {isLoading && (
          <Loader2 className="w-3 h-3 text-[var(--color-muted)] animate-spin flex-shrink-0" />
        )}
      </div>

      {!isCompleted && hasEvents && onComplete && (
        <button
          onClick={onComplete}
          disabled={isCompleting}
          className="px-2.5 py-1 text-[11px] font-medium bg-[var(--color-lime)] text-[var(--color-bg)] hover:bg-[var(--color-lime)]/90 disabled:opacity-40 flex items-center gap-1"
        >
          {isCompleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Done
        </button>
      )}
    </div>
  );
}
