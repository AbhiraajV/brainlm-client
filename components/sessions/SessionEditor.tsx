'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Session } from '@/lib/sessions/types';
import { useSessionsStore } from '@/store/sessions.store';
import { EventDraftList } from './EventDraftList';

interface SessionEditorProps {
  session?: Session;
  onClose: () => void;
}

export function SessionEditor({ session, onClose }: SessionEditorProps) {
  const isEditing = !!session;

  const [title, setTitle] = useState(session?.title || '');
  const [context, setContext] = useState(session?.sessionContext || '');
  const [localEvents, setLocalEvents] = useState(session?.events || []);

  const {
    createSession,
    updateSession,
    addEventDraft,
    updateEventDraft,
    deleteEventDraft,
  } = useSessionsStore();

  // Sync local events when session changes (for editing)
  useEffect(() => {
    if (session) {
      setLocalEvents(session.events);
    }
  }, [session]);

  const handleSave = () => {
    if (!title.trim()) return;

    if (isEditing && session) {
      // Update existing session
      updateSession(session.id, {
        title: title.trim(),
        sessionContext: context.trim(),
      });
    } else {
      // Create new session
      createSession(title.trim(), context.trim());
    }

    onClose();
  };

  const handleAddEvent = (content: string) => {
    if (isEditing && session) {
      addEventDraft(session.id, content);
    } else {
      // For new sessions, store locally until save
      const newEvent = {
        id: crypto.randomUUID(),
        content,
        createdAt: new Date().toISOString(),
      };
      setLocalEvents([...localEvents, newEvent]);
    }
  };

  const handleUpdateEvent = (eventId: string, content: string) => {
    if (isEditing && session) {
      updateEventDraft(session.id, eventId, content);
    } else {
      setLocalEvents(
        localEvents.map((e) => (e.id === eventId ? { ...e, content } : e))
      );
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    if (isEditing && session) {
      deleteEventDraft(session.id, eventId);
    } else {
      setLocalEvents(localEvents.filter((e) => e.id !== eventId));
    }
  };

  // Get events - for editing mode, use session events from store
  const displayEvents = isEditing && session
    ? useSessionsStore.getState().sessions.find((s) => s.id === session.id)?.events || []
    : localEvents;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-[var(--color-text)]">
          {isEditing ? 'Edit Session' : 'New Session'}
        </h2>
        <button
          onClick={onClose}
          className="
            p-2 -m-2
            text-[var(--color-muted)]
            hover:text-[var(--color-text)]
            transition-colors
          "
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="session-title"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Title <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Morning Gym, Study Session, Diet Log..."
            className="
              w-full px-3 py-2.5
              bg-[var(--color-surface)]
              border border-[var(--color-line)]
              rounded-[var(--radius-sm)]
              text-[0.9375rem] text-[var(--color-text)]
              placeholder:text-[var(--color-muted)]
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1
            "
          />
        </div>

        {/* Context */}
        <div className="space-y-1.5">
          <label
            htmlFor="session-context"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Context <span className="text-[var(--color-muted)] font-normal">(optional)</span>
          </label>
          <textarea
            id="session-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Add any notes or context for this session..."
            rows={3}
            className="
              w-full px-3 py-2.5
              bg-[var(--color-surface)]
              border border-[var(--color-line)]
              rounded-[var(--radius-sm)]
              text-[0.9375rem] text-[var(--color-text)]
              placeholder:text-[var(--color-muted)]
              resize-none
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1
            "
          />
        </div>

        {/* Events (only for editing existing sessions) */}
        {isEditing && (
          <EventDraftList
            events={displayEvents}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          className="
            px-4 py-2
            text-[var(--color-muted)]
            text-[0.9375rem] font-medium
            rounded-[var(--radius-sm)]
            transition-all duration-200
            hover:text-[var(--color-text)]
            hover:bg-[var(--color-line)]
          "
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="
            px-5 py-2
            bg-[var(--color-accent)] text-white
            text-[0.9375rem] font-medium
            rounded-[var(--radius-sm)]
            transition-all duration-200
            hover:bg-[var(--color-accent-dark)]
            focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98]
          "
        >
          {isEditing ? 'Save Changes' : 'Create Session'}
        </button>
      </div>
    </div>
  );
}
