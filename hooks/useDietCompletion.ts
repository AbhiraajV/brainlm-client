import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTrackerStore, useDietState } from '@/store/tracker.store';
import { saveDietSession } from '@/server/actions/diet-session.actions';

export function useDietCompletion() {
  const router = useRouter();
  const dietState = useDietState();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleCompleteDietSession = useCallback(async () => {
    const state = useTrackerStore.getState().diet;
    if (!state?.dietLog || isCompleting) return;

    setIsCompleting(true);
    try {
      await saveDietSession(
        state.dietLog,
        state.events.map(e => ({ content: e.content, llmComment: e.llmComment ?? undefined })),
        {
          title: 'Diet',
          goal: state.analysis?.userGoals || '',
          guide: 'Nutrition Coach',
          analysis: state.analysis ? {
            sessionType: state.analysis.sessionType,
            relevantHistory: state.analysis.relevantHistory?.map(h => ({
              date: h.date, event: h.event, highlight: h.highlight,
            })),
            patterns: state.analysis.patterns?.map(p => ({
              name: p.name, description: p.description, trend: p.trend,
            })),
            correlations: state.analysis.correlations?.map(c => ({
              factor: c.factor, impact: c.impact, direction: c.direction,
            })),
            context: state.analysis.context,
            userGoals: state.analysis.userGoals,
          } : undefined,
        },
      );
      useTrackerStore.getState().resetTracker('diet');
      router.push('/');
    } catch (err) {
      console.error('[useDietCompletion] Error:', err);
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, router]);

  return { isCompleting, handleCompleteDietSession };
}
