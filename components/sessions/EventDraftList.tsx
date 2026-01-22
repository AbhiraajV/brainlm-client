'use client';

import { useState } from 'react';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import type { EventDraft } from '@/lib/sessions/types';
import { EventDraftInput } from './EventDraftInput';

interface EventDraftItemProps {
  event: EventDraft;
  onUpdate: (content: string) => void;
  onDelete: () => void;
}

function EventDraftItem({ event, onUpdate, onDelete }: EventDraftItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(event.content);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== event.content) {
      onUpdate(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(event.content);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-2">
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
            flex-1 px-3 py-1.5
            bg-[var(--color-bg)]
            border border-[var(--color-accent)]
            rounded-[var(--radius-sm)]
            text-sm text-[var(--color-text)]
            focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1
          "
        />
        <button
          onClick={handleSave}
          className="p-1.5 text-[var(--color-success)] hover:bg-[var(--color-line)] rounded transition-colors"
          aria-label="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-line)] rounded transition-colors"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="
        group flex items-center gap-2 py-2
        border-b border-[var(--color-line)] last:border-b-0
      "
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
      <span className="flex-1 text-sm text-[var(--color-text)]">{event.content}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-line)] rounded transition-colors"
          aria-label="Edit event"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-line)] rounded transition-colors"
          aria-label="Delete event"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

interface EventDraftListProps {
  events: EventDraft[];
  onAddEvent: (content: string) => void;
  onUpdateEvent: (eventId: string, content: string) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function EventDraftList({
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
}: EventDraftListProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[var(--color-text)]">
        Events
      </label>

      {events.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-[var(--radius-sm)] px-3">
          {events.map((event) => (
            <EventDraftItem
              key={event.id}
              event={event}
              onUpdate={(content) => onUpdateEvent(event.id, content)}
              onDelete={() => onDeleteEvent(event.id)}
            />
          ))}
        </div>
      )}

      <EventDraftInput onAdd={onAddEvent} />

      {events.length === 0 && (
        <p className="text-xs text-[var(--color-muted)] italic">
          No events added yet. Add events to track your activities.
        </p>
      )}
    </div>
  );
}
