'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import type { Session } from '@/lib/sessions/types';

interface SessionCardProps {
  session: Session;
  onEdit: () => void;
  onDelete: () => void;
}

function formatTimestamp(isoDate: string): string {
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

export function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const eventCount = session.events.length;

  return (
    <div className="card p-4 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-serif font-semibold text-[var(--color-text)] line-clamp-1">
          {session.title}
        </h3>

        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="
              p-1 -m-1
              text-[var(--color-muted)]
              hover:text-[var(--color-text)]
              transition-colors
              rounded
            "
            aria-label="Session options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="
                absolute right-0 top-full mt-1 z-10
                min-w-[140px]
                bg-[var(--color-surface)]
                border border-[var(--color-line)]
                rounded-[var(--radius-sm)]
                shadow-lg
                py-1
              "
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="
                  w-full flex items-center gap-2 px-3 py-2
                  text-sm text-[var(--color-text)]
                  hover:bg-[var(--color-bg)]
                  transition-colors
                "
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="
                  w-full flex items-center gap-2 px-3 py-2
                  text-sm text-[var(--color-error)]
                  hover:bg-[var(--color-bg)]
                  transition-colors
                "
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Context preview */}
      {session.sessionContext && (
        <p className="text-sm text-[var(--color-muted)] line-clamp-2 mb-3">
          {session.sessionContext}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>{formatTimestamp(session.updatedAt)}</span>

        {eventCount > 0 && (
          <span
            className="
              px-2 py-0.5
              bg-[var(--color-bg)]
              rounded-full
            "
          >
            {eventCount} event{eventCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
