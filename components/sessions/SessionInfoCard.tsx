'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Brain, Sparkles, Loader2, Clock, Calendar, Check, BarChart3 } from 'lucide-react';
import type { SessionKnowledge as SessionKnowledgeType, SessionUnderstanding as SessionUnderstandingType, SessionAnalysis as SessionAnalysisType, TrackerType } from '@/lib/sessions/types';
import { fetchSessionKnowledge } from '@/server/actions/session-knowledge.actions';
import { analyzeSession } from '@/server/actions/session-analysis.actions';
import { useSessionsStore } from '@/store/sessions.store';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useTodaysEventsFromCache } from '@/hooks/useTodaysEventsFromCache';
import { SessionAnalysis } from './SessionAnalysis';

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

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Collapsible section component
function CollapsibleSection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[var(--color-line)] pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-1 text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--color-muted)]" />
        )}
        <Icon className="w-3 h-3 text-[var(--color-muted)]" />
        <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[10px] text-[var(--color-muted)]">({count})</span>
        )}
      </button>
      {isOpen && (
        <div className="mt-2 pl-5 text-xs text-[var(--color-text)]">
          {children}
        </div>
      )}
    </div>
  );
}

// Knowledge items section
function KnowledgeSection({ knowledge }: { knowledge: SessionKnowledgeType }) {
  const { events, interpretations, patterns, insights, reviews } = knowledge;

  return (
    <>
      {events.length > 0 && (
        <CollapsibleSection title="Events" icon={Clock} count={events.length}>
          <div className="space-y-2">
            {events.map((event, i) => (
              <div key={event.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]">
                <p className="line-clamp-2">{event.content}</p>
                <p className="text-[10px] text-[var(--color-muted)] mt-1">
                  {new Date(event.occurredAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {interpretations.length > 0 && (
        <CollapsibleSection title="Interpretations" icon={Sparkles} count={interpretations.length}>
          <div className="space-y-2">
            {interpretations.map((interp, i) => (
              <div key={interp.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]">
                <MarkdownRenderer content={interp.content} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {patterns.length > 0 && (
        <CollapsibleSection title="Patterns" icon={Sparkles} count={patterns.length}>
          <div className="space-y-2">
            {patterns.map((pattern, i) => (
              <div key={pattern.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]">
                <p className="font-medium mb-1">{pattern.name}</p>
                <MarkdownRenderer content={pattern.description} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {insights.length > 0 && (
        <CollapsibleSection title="Insights" icon={Brain} count={insights.length}>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={insight.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]">
                <MarkdownRenderer content={insight.content} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {reviews.length > 0 && (
        <CollapsibleSection title="Reviews" icon={Calendar} count={reviews.length}>
          <div className="space-y-2">
            {reviews.map((review, i) => (
              <div key={review.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-surface)] rounded">
                    {review.type}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">{review.periodKey}</span>
                </div>
                <MarkdownRenderer content={review.summary} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

export function SessionInfoCard({
  sessionId,
  title,
  context,
  knowledge,
  understanding,
  analysis,
  trackerType,
  isCompleted,
  hasEvents,
  onComplete,
  isCompleting
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const analyzingRef = useRef(false);

  const setSessionKnowledge = useSessionsStore((state) => state.setSessionKnowledge);
  const setSessionAnalysis = useSessionsStore((state) => state.setSessionAnalysis);

  const todaysEvents = useTodaysEventsFromCache();

  // Fetch knowledge
  useEffect(() => {
    if (knowledge) return;

    let cancelled = false;

    async function loadKnowledge() {
      setIsLoadingKnowledge(true);
      try {
        const result = await fetchSessionKnowledge(title, context);
        if (cancelled) return;

        if (result) {
          setSessionKnowledge(sessionId, result.knowledge);
          // Don't set trackerType here - analysis will determine it
        }
      } catch (err) {
        console.error('[SessionInfoCard] Error fetching knowledge:', err);
      } finally {
        if (!cancelled) setIsLoadingKnowledge(false);
      }
    }

    loadKnowledge();
    return () => { cancelled = true; };
  }, [sessionId, title, context, knowledge, setSessionKnowledge]);

  // Generate analysis when knowledge exists
  useEffect(() => {
    if (!knowledge || analysis || analyzingRef.current) return;

    const totalItems = knowledge.interpretations.length + knowledge.patterns.length +
                       knowledge.insights.length + knowledge.reviews.length +
                       knowledge.events.length;
    if (totalItems === 0) return;

    let cancelled = false;
    analyzingRef.current = true;

    async function generateAnalysis() {
      setIsLoadingAnalysis(true);
      try {
        const result = await analyzeSession(title, context, knowledge!);
        if (cancelled) return;

        if (result) {
          // setSessionAnalysis also sets trackerType from analysis.sessionType
          setSessionAnalysis(sessionId, result);
        }
      } catch (err) {
        console.error('[SessionInfoCard] Error analyzing session:', err);
      } finally {
        if (!cancelled) {
          setIsLoadingAnalysis(false);
          analyzingRef.current = false;
        }
      }
    }

    generateAnalysis();
    return () => {
      cancelled = true;
      analyzingRef.current = false;
    };
  }, [sessionId, title, context, knowledge, analysis, setSessionAnalysis]);

  const isLoading = isLoadingKnowledge || isLoadingAnalysis;
  const hasYesterdaysReview = !!knowledge?.yesterdaysReview;
  const hasTodaysEvents = todaysEvents.length > 0;
  const knowledgeCount = knowledge
    ? knowledge.events.length + knowledge.interpretations.length +
      knowledge.patterns.length + knowledge.insights.length + knowledge.reviews.length
    : 0;

  // Determine coach name from analysis or trackerType
  const coachName = analysis?.sessionType
    ? { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Session Coach' }[analysis.sessionType]
    : trackerType
      ? { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Session Coach' }[trackerType]
      : null;

  return (
    <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-4 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
      {/* Header row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h2 className="font-serif font-semibold text-base text-[var(--color-text)]">
              {title}
            </h2>
            {/* Goal */}
            {context && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5 line-clamp-2">
                {context}
              </p>
            )}
          </div>

          {/* Expand indicator */}
          <ChevronDown
            className={`w-4 h-4 text-[var(--color-muted)] transition-transform flex-shrink-0 mt-1 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Coach indicator */}
          {coachName && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
              {coachName}
            </span>
          )}
          {analysis && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center gap-1">
              <BarChart3 className="w-2.5 h-2.5" />
              Analyzed
            </span>
          )}
          {knowledgeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-muted)] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {knowledgeCount} items
            </span>
          )}
          {isLoading && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg)] text-[var(--color-muted)] flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              Loading...
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 space-y-1">
          {/* Today's Events */}
          {hasTodaysEvents && (
            <CollapsibleSection title="Today So Far" icon={Clock} count={todaysEvents.length}>
              <ul className="space-y-1">
                {todaysEvents.map((event) => (
                  <li key={event.id} className="flex gap-2">
                    <span className="text-[var(--color-muted)] flex-shrink-0">{formatTime(event.occurredAt)}</span>
                    <span className="line-clamp-1">{event.content}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {/* Yesterday's Review */}
          {hasYesterdaysReview && knowledge?.yesterdaysReview && (
            <CollapsibleSection title={`Yesterday (${knowledge.yesterdaysReview.periodKey})`} icon={Calendar}>
              <MarkdownRenderer content={knowledge.yesterdaysReview.summary} />
            </CollapsibleSection>
          )}

          {/* Session Analysis - the main structured context */}
          {analysis && (
            <CollapsibleSection title="Analysis" icon={BarChart3} defaultOpen={true}>
              <SessionAnalysis analysis={analysis} />
            </CollapsibleSection>
          )}

          {/* Knowledge Items (raw data) */}
          {knowledge && knowledgeCount > 0 && (
            <CollapsibleSection title="Raw Knowledge" icon={Sparkles} count={knowledgeCount}>
              <KnowledgeSection knowledge={knowledge} />
            </CollapsibleSection>
          )}

          {/* Loading states */}
          {isLoadingKnowledge && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] py-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Fetching knowledge...
            </div>
          )}
          {isLoadingAnalysis && !isLoadingKnowledge && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] py-2">
              <BarChart3 className="w-3 h-3 animate-pulse" />
              Analyzing session...
            </div>
          )}
        </div>
      )}

      {/* Complete button - bottom row */}
      {!isCompleted && hasEvents && onComplete && (
        <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
          <button
            onClick={onComplete}
            disabled={isCompleting}
            className="
              w-full
              py-2 px-3
              text-xs font-medium
              text-white
              bg-[var(--color-accent)]
              transition-all duration-200
              hover:opacity-90
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-1.5
            "
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Complete Session
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
