'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { SessionKnowledge as SessionKnowledgeType, SessionUnderstanding as SessionUnderstandingType, SessionAnalysis as SessionAnalysisType, TrackerType } from '@/lib/sessions/types';
import { useSessionsStore } from '@/store/sessions.store';
import { useSessionKnowledgeWithCache } from '@/hooks/useSessionKnowledgeWithCache';
import { useSessionAnalysisWithCache } from '@/hooks/useSessionAnalysisWithCache';

interface Props {
  sessionId: string;
  title: string;
  context: string;
  knowledge?: SessionKnowledgeType;
  understanding?: SessionUnderstandingType;
  analysis?: SessionAnalysisType;
  trackerType?: TrackerType;
  isCompleted?: boolean;
  hasEvents?: boolean;
  onComplete?: () => void;
  isCompleting?: boolean;
}

export function SessionInfoCard({
  sessionId,
  title,
  context,
  knowledge,
  analysis,
  trackerType,
  isCompleted,
  hasEvents,
  onComplete,
  isCompleting
}: Props) {
  const isGymSession = analysis?.sessionType === 'gym' || trackerType === 'gym';
  const displayTitle = isGymSession ? 'Gym' : title;

  const analyzingRef = useRef(false);
  const knowledgeFetchedRef = useRef<string | null>(null);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const setSessionKnowledge = useSessionsStore((state) => state.setSessionKnowledge);
  const setSessionAnalysis = useSessionsStore((state) => state.setSessionAnalysis);

  const { fetchKnowledge: fetchKnowledgeWithCache } = useSessionKnowledgeWithCache();
  const { analyzeWithCache } = useSessionAnalysisWithCache();

  useEffect(() => {
    if (knowledge) return;
    if (knowledgeFetchedRef.current === `${sessionId}:${trackerType}`) return;
    if (!trackerType || trackerType === 'general' || trackerType === 'habit') return;

    knowledgeFetchedRef.current = `${sessionId}:${trackerType}`;

    const currentTrackerType = trackerType;

    async function loadKnowledge() {
      setIsLoadingKnowledge(true);
      try {
        const cachedResult = await fetchKnowledgeWithCache(currentTrackerType);
        if (cachedResult) {
          setSessionKnowledge(sessionId, cachedResult.knowledge);
        }
      } catch (err) {
        console.error('[SessionInfoCard] Error fetching knowledge:', err);
      } finally {
        setIsLoadingKnowledge(false);
      }
    }

    loadKnowledge();
  }, [sessionId, trackerType, knowledge, setSessionKnowledge, fetchKnowledgeWithCache]);

  useEffect(() => {
    if (!knowledge || analysis || analyzingRef.current) return;

    const totalItems = knowledge.interpretations.length + knowledge.patterns.length +
                       knowledge.insights.length + knowledge.reviews.length +
                       knowledge.events.length;
    if (totalItems === 0) return;

    analyzingRef.current = true;

    async function generateAnalysis() {
      setIsLoadingAnalysis(true);
      try {
        const effectiveType = trackerType || 'general';
        const cachedResult = await analyzeWithCache(title, context, knowledge!, effectiveType);
        if (cachedResult) {
          setSessionAnalysis(sessionId, cachedResult.analysis);
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
  }, [sessionId, title, context, knowledge, analysis, trackerType, setSessionAnalysis, analyzeWithCache]);

  const isLoading = isLoadingKnowledge || isLoadingAnalysis;

  const coachLabel = analysis?.sessionType
    ? { gym: 'gym', diet: 'diet', addiction: 'recovery', general: 'coach', habit: 'habit' }[analysis.sessionType]
    : trackerType
      ? { gym: 'gym', diet: 'diet', addiction: 'recovery', general: 'coach', habit: 'habit' }[trackerType]
      : null;

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
