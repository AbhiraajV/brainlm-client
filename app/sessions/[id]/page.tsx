'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, Trash2, Check } from 'lucide-react';
import { useSessionsStore, selectSessionById } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';
import { SessionEventInput } from '@/components/sessions/SessionEventInput';
import { SessionKnowledge } from '@/components/sessions/SessionKnowledge';
import { SessionUnderstanding } from '@/components/sessions/SessionUnderstanding';
import { EventSuggestion } from '@/components/sessions/EventSuggestion';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import { completeSession } from '@/server/actions/session-complete.actions';
import type { EventDraft, Session } from '@/lib/sessions/types';

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function EventDraftRow({
  event,
  sessionId,
  onRetry,
}: {
  event: EventDraft;
  sessionId: string;
  onRetry: (eventId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(event.content);
  const { updateEventDraft, deleteEventDraft } = useSessionsStore();

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== event.content) {
      updateEventDraft(sessionId, event.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(event.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteEventDraft(sessionId, event.id);
  };

  if (isEditing) {
    return (
      <div className="px-5 sm:px-7 py-4 bg-[var(--color-surface)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
            className="
              flex-1 px-3 py-2
              bg-[var(--color-bg)]
              border border-[var(--color-accent)]
              rounded-[var(--radius-sm)]
              text-[var(--color-text)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
            "
          />
          <button
            onClick={handleSave}
            className="
              px-3 py-2
              text-sm font-medium
              text-white
              bg-[var(--color-accent)]
              rounded-[var(--radius-sm)]
              transition-colors
              hover:opacity-90
            "
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="
              px-3 py-2
              text-sm
              text-[var(--color-muted)]
              transition-colors
              hover:text-[var(--color-text)]
            "
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="px-5 sm:px-7 py-4 bg-[var(--color-surface)] group">
      <div className="flex items-start gap-3">
        {/* Event dot */}
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-line)] flex-shrink-0 mt-1.5" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[var(--color-text)] leading-relaxed">{event.content}</p>
          <p className="text-micro mt-2">{formatTimeAgo(event.createdAt)}</p>

          {/* LLM Suggestion */}
          <EventSuggestion
            sessionId={sessionId}
            eventId={event.id}
            status={event.llmCommentStatus}
            comment={event.llmComment}
            error={event.llmCommentError}
            onRetry={() => onRetry(event.id)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            className="
              p-1.5
              text-[var(--color-muted)]
              rounded
              transition-colors
              hover:text-[var(--color-text)]
              hover:bg-[var(--color-bg)]
            "
            aria-label="Edit event"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="
              p-1.5
              text-[var(--color-muted)]
              rounded
              transition-colors
              hover:text-[var(--color-error)]
              hover:bg-[var(--color-bg)]
            "
            aria-label="Delete event"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

// Helper to get domain knowledge from understanding content
// The brain transfer content IS the domain knowledge - no extraction needed
function getDomainKnowledge(understandingContent?: string): string {
  return understandingContent || '';
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const sessionId = params.id as string;

  const session = useSessionsStore(selectSessionById(sessionId));
  const setEventLlmComment = useSessionsStore((s) => s.setEventLlmComment);
  const markSessionCompleted = useSessionsStore((s) => s.markSessionCompleted);
  const [isCompleting, setIsCompleting] = useState(false);

  // Generate LLM suggestion for an event
  const generateSuggestion = useCallback(async (eventId: string, session: Session) => {
    const event = session.events.find(e => e.id === eventId);
    if (!event) return;

    // Mark as generating
    setEventLlmComment(session.id, eventId, null, 'generating');

    // Get domain knowledge from brain transfer
    const domainKnowledge = getDomainKnowledge(session.understanding?.content);
    const guide = session.understanding?.guide || 'Coach';
    const goal = session.sessionContext || session.understanding?.inferredGoal || '';

    // Get previous events (all events before this one chronologically)
    const eventIndex = session.events.findIndex(e => e.id === eventId);
    const previousEvents = session.events
      .slice(0, eventIndex)
      .map(e => ({ content: e.content, createdAt: e.createdAt }));

    // Get today's events and yesterday's review from knowledge (displayed directly, also passed to commenting LLM)
    const todaysEvents = session.knowledge?.todaysEvents?.map(e => ({
      content: e.content,
      occurredAt: e.occurredAt,
    }));
    const yesterdaysReview = session.knowledge?.yesterdaysReview
      ? { summary: session.knowledge.yesterdaysReview.summary, periodKey: session.knowledge.yesterdaysReview.periodKey }
      : undefined;

    try {
      const result = await generateEventSuggestion(
        session.id,
        eventId,
        event.content,
        previousEvents,
        session.title,
        goal,
        guide,
        domainKnowledge,
        todaysEvents,
        yesterdaysReview
      );

      if ('suggestion' in result) {
        setEventLlmComment(session.id, eventId, result.suggestion, 'completed');
      } else {
        setEventLlmComment(session.id, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      setEventLlmComment(session.id, eventId, null, 'failed', 'Network error');
    }
  }, [setEventLlmComment]);

  // Handle retry for failed suggestions
  const handleRetry = useCallback((eventId: string) => {
    if (!session) return;
    generateSuggestion(eventId, session);
  }, [session, generateSuggestion]);

  // Handle session completion
  const handleCompleteSession = async () => {
    if (!session || isCompleting) return;

    setIsCompleting(true);
    try {
      const result = await completeSession({
        sessionTitle: session.title,
        sessionGoal: session.sessionContext || session.understanding?.inferredGoal || '',
        guide: session.understanding?.guide,
        events: session.events.map(e => ({
          content: e.content,
          createdAt: e.createdAt,
          llmComment: e.llmComment,
        })),
        coachBrief: session.understanding?.content,
      });

      if (result.success) {
        markSessionCompleted(session.id);
        router.push('/sessions');
      } else {
        console.error(result.error);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  // Redirect if session doesn't exist (after hydration)
  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/sessions');
    }
  }, [hydrated, session, router]);

  // Process pending/generating events on page load (handle return to page)
  useEffect(() => {
    if (!hydrated || !session) return;

    // Find events that need LLM comments (pending or were generating when page was left)
    const pendingEvents = session.events.filter(
      e => e.llmCommentStatus === 'pending' || e.llmCommentStatus === 'generating'
    );

    // Process chronologically (oldest first)
    const sortedPending = [...pendingEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedPending.forEach(event => {
      generateSuggestion(event.id, session);
    });
    // Only run once per session load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.id]);

  // Show loading state while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-5 sm:px-7 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
          <div className="w-32 h-5 bg-[var(--color-line)] rounded animate-pulse" />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // Return null if redirecting
  if (!session) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        {/* Header with session title and guide */}
        <header
          className="
            sticky top-0 z-10
            h-14
            flex items-center justify-between
            px-5 sm:px-7
            bg-[var(--color-surface)]
            border-b border-[var(--color-line)]
          "
        >
          <h1 className="font-serif font-semibold text-lg text-[var(--color-text)] truncate">
            {session.title}
          </h1>

          <div className="flex items-center gap-3">
            {/* Complete Session Button */}
            {!session.isCompleted && session.events.length > 0 && (
              <button
                onClick={handleCompleteSession}
                disabled={isCompleting}
                className="
                  py-1.5 px-3
                  text-xs font-medium
                  text-white
                  bg-[var(--color-accent)]
                  rounded-[var(--radius-sm)]
                  transition-all duration-200
                  hover:opacity-90
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-1.5
                "
              >
                {isCompleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Complete
                  </>
                )}
              </button>
            )}

            {/* Guide indicator */}
            {session.understanding?.guide && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-[var(--color-success)] animate-ping opacity-75" />
                </div>
                <span className="text-xs text-[var(--color-muted)]">
                  {session.understanding.guide}
                </span>
              </div>
            )}
          </div>
        </header>


        {/* Main content */}
        <main className="flex-1 container-padding py-6 pb-48">
          {/* Session goal (if exists) */}
          {session.sessionContext && (
            <div className="mb-4">
              <span className="text-micro uppercase tracking-wider text-[var(--color-muted)]">
                Session Goal
              </span>
              <p className="text-[var(--color-text)] text-sm mt-1 max-w-prose">
                {session.sessionContext}
              </p>
            </div>
          )}

          {/* Session Knowledge */}
          <SessionKnowledge
            sessionId={session.id}
            title={session.title}
            context={session.sessionContext}
            knowledge={session.knowledge}
          />

          {/* Session Understanding */}
          <SessionUnderstanding
            sessionId={session.id}
            title={session.title}
            context={session.sessionContext}
            knowledge={session.knowledge}
            understanding={session.understanding}
          />

          {/* Events list */}
          {session.events.length > 0 ? (
            <div className="divide-y divide-[var(--color-line)] -mx-5 sm:-mx-7">
              {session.events.map((event) => (
                <EventDraftRow
                  key={event.id}
                  event={event}
                  sessionId={session.id}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
              <p className="font-serif text-lg text-[var(--color-text)]">No events yet</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Add your first event below
              </p>
            </div>
          )}
        </main>

        {/* Fixed EventInput at bottom */}
        <div
          className="
            fixed bottom-0 left-0 right-0 z-20
            px-5 sm:px-7 py-4
            bg-[var(--color-bg)]
            border-t border-[var(--color-line)]
          "
        >
          <div className="max-w-2xl mx-auto">
            <SessionEventInput sessionId={session.id} />
          </div>
        </div>

        {/* Back button */}
        <Link
          href="/sessions"
          className="
            fixed bottom-28 left-6
            z-20
            w-12 h-12
            flex items-center justify-center
            bg-[var(--color-surface)]
            border border-[var(--color-line)]
            rounded-full
            shadow-lg
            transition-all duration-200
            hover:shadow-xl hover:border-[var(--color-accent)]
            active:scale-95
          "
          aria-label="Back to sessions"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
        </Link>
      </div>
    </>
  );
}
