'use client';

import { Trash2 } from 'lucide-react';
import { EventSuggestion } from '@/components/sessions/EventSuggestion';
import type { EventDraft } from '@/lib/sessions/types';

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

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  event: EventDraft;
  onRetry: (eventId: string) => void;
  onDelete: (eventId: string) => void;
}

export function EventDraftRow({ event, onRetry, onDelete }: Props) {
  return (
    <article className="px-5 sm:px-7 py-3 bg-[var(--color-surface)]">
      <div className="flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-[var(--color-line)] flex-shrink-0 mt-1.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-[10px] text-[var(--color-muted)]">{formatTimeAgo(event.createdAt)}</span>
            <button
              onClick={() => onDelete(event.id)}
              className="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors opacity-60 hover:opacity-100"
              aria-label="Delete event"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <p className="text-sm text-[var(--color-text)] leading-relaxed">{event.content}</p>
          <EventSuggestion
            eventId={event.id}
            status={event.llmCommentStatus}
            comment={event.llmComment}
            error={event.llmCommentError}
            onRetry={() => onRetry(event.id)}
          />
        </div>
      </div>
    </article>
  );
}
