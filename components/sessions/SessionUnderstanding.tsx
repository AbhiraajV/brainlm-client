'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, ChevronDown, Calendar, Clock } from 'lucide-react';
import type { SessionKnowledge, SessionUnderstanding as SessionUnderstandingType } from '@/lib/sessions/types';
import { condenseSessionKnowledge } from '@/server/actions/session-understanding.actions';
import { useSessionsStore } from '@/store/sessions.store';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface Props {
  sessionId: string;
  title: string;
  context: string;
  knowledge?: SessionKnowledge;
  understanding?: SessionUnderstandingType;
}

// Animated thinking messages for brain transfer
const THINKING_MESSAGES = [
  'Loading your history...',
  'Gathering your data...',
  'Finding relevant patterns...',
  'Building your context...',
];

/**
 * Format time from ISO string
 */
function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function ThinkingLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 py-4">
      <div className="relative">
        <Brain className="w-5 h-5 text-[var(--color-accent)] animate-pulse" />
        <div className="absolute inset-0 w-5 h-5 bg-[var(--color-accent)]/20 rounded-full animate-ping" />
      </div>
      <span className="text-sm text-[var(--color-muted)] animate-pulse">
        {THINKING_MESSAGES[messageIndex]}
      </span>
    </div>
  );
}

export function SessionUnderstanding({ sessionId, title, context, knowledge, understanding }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const generatingRef = useRef(false);
  const setSessionUnderstanding = useSessionsStore((state) => state.setSessionUnderstanding);

  // Today's events are fetched separately (all events from today, not just vector-search related)
  const todaysEvents = knowledge?.todaysEvents ?? [];

  // Generate understanding when knowledge exists but understanding doesn't
  useEffect(() => {
    // Skip if already have understanding, no knowledge, or already generating
    if (!knowledge || understanding || generatingRef.current) return;

    // Skip if knowledge is empty
    const totalItems = knowledge.interpretations.length + knowledge.patterns.length +
                       knowledge.insights.length + knowledge.reviews.length;
    if (totalItems === 0) return;

    let cancelled = false;
    generatingRef.current = true;

    async function generateUnderstanding() {
      setIsLoading(true);
      try {
        const result = await condenseSessionKnowledge(title, context, knowledge!);
        if (cancelled) return;

        if (result) {
          setSessionUnderstanding(sessionId, {
            content: result.content,
            guide: result.guide,
            generatedAt: new Date().toISOString(),
            inferredGoal: result.inferredGoal,
          });
        }
      } catch (err) {
        console.error('[SessionUnderstanding] Error:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          generatingRef.current = false;
        }
      }
    }

    generateUnderstanding();
    return () => {
      cancelled = true;
      generatingRef.current = false;
    };
  }, [sessionId, title, context, knowledge, understanding, setSessionUnderstanding]);

  // Don't render if no knowledge yet
  if (!knowledge) return null;

  // Check if we have any context to show (today's events, yesterday's review, or understanding)
  const hasYesterdaysReview = !!knowledge.yesterdaysReview;
  const hasTodaysEvents = todaysEvents.length > 0;
  const hasContent = hasYesterdaysReview || hasTodaysEvents || understanding;

  // Loading state
  if (isLoading && !hasContent) {
    return (
      <div className="mb-4">
        <ThinkingLoader />
      </div>
    );
  }

  // No content to show
  if (!hasContent) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text)]">
            Session Context
          </span>
          {understanding?.inferredGoal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium">
              Goal Inferred
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--color-muted)] transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Today's Events - Always shown if available */}
          {hasTodaysEvents && (
            <div className="rounded-lg bg-[var(--color-surface)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                  Today So Far
                </span>
              </div>
              <ul className="space-y-1.5">
                {todaysEvents.map((event) => (
                  <li key={event.id} className="text-sm text-[var(--color-text)]">
                    <span className="text-[var(--color-muted)] text-xs mr-2">
                      {formatTime(event.occurredAt)}
                    </span>
                    {event.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Yesterday's Review - Always shown if available */}
          {hasYesterdaysReview && knowledge.yesterdaysReview && (
            <div className="rounded-lg bg-[var(--color-surface)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                  Yesterday ({knowledge.yesterdaysReview.periodKey})
                </span>
              </div>
              <div className="text-sm text-[var(--color-text)]">
                <MarkdownRenderer content={knowledge.yesterdaysReview.summary} />
              </div>
            </div>
          )}

          {/* Brain Transfer Content */}
          {understanding && (
            <div>
              {(hasTodaysEvents || hasYesterdaysReview) && (
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                  <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                    Domain Knowledge
                  </span>
                </div>
              )}
              <MarkdownRenderer content={understanding.content} />
            </div>
          )}

          {/* Show loader if still generating understanding but we have some content */}
          {isLoading && !understanding && (
            <ThinkingLoader />
          )}
        </div>
      )}
    </div>
  );
}
