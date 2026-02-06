import { useMemo } from 'react';
import { useEventsCacheStore } from '@/store/events-cache.store';
import { getUserTimezone, getLocalDayBoundaries } from '@/lib/timezone';

export interface TodaysEvent {
  id: string;
  content: string;
  occurredAt: string;
}

/**
 * Hook to get today's events from the local events cache.
 *
 * Uses the existing events-cache.store.ts which caches events from the main feed.
 * This provides always-current "Today So Far" data without additional API calls.
 *
 * The cache typically has up to 200 events, so this filters them by today's date
 * using the user's local timezone.
 */
export function useTodaysEventsFromCache(): TodaysEvent[] {
  // Select stable references from store - don't call getAllEvents() which creates new array
  const events = useEventsCacheStore((state) => state.events);
  const eventIds = useEventsCacheStore((state) => state.eventIds);
  const pendingEvents = useEventsCacheStore((state) => state.pendingEvents);

  return useMemo(() => {
    const timezone = getUserTimezone();
    const { start, end } = getLocalDayBoundaries(timezone, 0);

    // Reconstruct all events from stable store references
    const pending = Object.values(pendingEvents);
    const cached = eventIds.map(id => events[id]).filter(Boolean);
    const allEvents = [...pending, ...cached];

    return allEvents
      .filter(event => {
        // Use occurredAt if available, otherwise createdAt
        const eventDate = new Date(event.occurredAt || event.createdAt);
        return eventDate >= start && eventDate < end;
      })
      .map(e => ({
        id: 'tempId' in e ? e.tempId : e.id,
        content: e.content,
        occurredAt: e.occurredAt || e.createdAt,
      }))
      // Sort by occurredAt descending (most recent first)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [events, eventIds, pendingEvents]);
}
