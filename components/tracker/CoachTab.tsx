'use client';

import { useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { EventDraftRow } from './EventDraftRow';
import { useTrackerStore, type ActiveTrackerType } from '@/store/tracker.store';
import type { EventDraft } from '@/lib/sessions/types';

interface Props {
  trackerType: ActiveTrackerType;
  events: EventDraft[];
  emptyMessage?: string;
}

export function CoachTab({ trackerType, events, emptyMessage }: Props) {
  const handleRetry = useCallback((eventId: string) => {
    // Retry is a no-op here — events will be re-processed by the init hook
  }, []);

  const handleDelete = useCallback((eventId: string) => {
    useTrackerStore.getState().deleteEventDraft(trackerType, eventId);
  }, [trackerType]);

  if (events.length > 0) {
    return (
      <div className="divide-y divide-[var(--color-line)]">
        {events.map((event) => (
          <EventDraftRow
            key={event.id}
            event={event}
            onRetry={handleRetry}
            onDelete={handleDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-5">
      <MessageSquare className="w-12 h-12 text-[var(--color-line)] mb-4" />
      <p className="font-serif text-lg text-[var(--color-text)]">Ask your coach</p>
      <p className="text-sm text-[var(--color-muted)] mt-1">
        {emptyMessage || 'Questions, advice — your coach knows your history'}
      </p>
    </div>
  );
}
