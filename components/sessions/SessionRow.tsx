'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, MoreVertical, Trash2 } from 'lucide-react';
import type { Session } from '@/lib/sessions/types';
import { useSessionsStore } from '@/store/sessions.store';

interface SessionRowProps {
  session: Session;
}

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

export function SessionRow({ session }: SessionRowProps) {
  const eventCount = session.events.length;
  const deleteSession = useSessionsStore((state) => state.deleteSession);
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

  const handleDelete = () => {
    deleteSession(session.id);
    setMenuOpen(false);
  };

  return (
    <article className="px-5 sm:px-7 py-4 bg-[var(--color-surface)]">
      <div className="flex items-start justify-between gap-3">
        {/* Left: Title + metadata */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[var(--color-text)] truncate">
            {session.title}
          </h3>
          {session.sessionContext && (
            <p className="text-sm text-[var(--color-muted)] truncate mt-0.5">
              {session.sessionContext}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 text-micro">
            <span>{eventCount} event{eventCount !== 1 ? 's' : ''}</span>
            <span className="text-[var(--color-line)]">·</span>
            <span>{formatTimeAgo(session.updatedAt)}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="
                w-9 h-9
                flex items-center justify-center
                rounded-full
                text-[var(--color-muted)]
                transition-all duration-200
                hover:bg-[var(--color-line)]/30
                hover:text-[var(--color-text)]
              "
              aria-label="Session options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className="
                  absolute right-0 top-full mt-1
                  min-w-[140px]
                  bg-[var(--color-surface)]
                  border border-[var(--color-line)]
                  rounded-lg
                  shadow-lg
                  z-30
                  overflow-hidden
                "
              >
                <button
                  onClick={handleDelete}
                  className="
                    w-full
                    flex items-center gap-2
                    px-3 py-2.5
                    text-sm text-red-500
                    transition-colors duration-150
                    hover:bg-red-500/10
                  "
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Arrow to detail page */}
          <Link
            href={`/sessions/${session.id}`}
            className="
              w-9 h-9
              flex items-center justify-center
              rounded-full
              border border-[var(--color-line)]
              text-[var(--color-muted)]
              transition-all duration-200
              hover:border-[var(--color-accent)]
              hover:text-[var(--color-accent)]
            "
            aria-label={`Open ${session.title}`}
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
