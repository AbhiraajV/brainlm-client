'use client';

import type { Session } from '@/lib/sessions/types';
import { SessionRow } from './SessionRow';

interface SessionListProps {
  sessions: Session[];
}

export function SessionList({ sessions }: SessionListProps) {
  // Sort by updatedAt descending
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="divide-y divide-[var(--color-line)] -mx-5 sm:-mx-7">
      {sortedSessions.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </div>
  );
}
