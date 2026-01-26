'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TrackerType } from '@/lib/sessions/types';

interface MasterSummaryCardProps {
  summary: string | undefined;
  trackerType: TrackerType;
  isLoading?: boolean;
}

/**
 * MasterSummaryCard - Renders the master .md summary for diet/gym trackers
 *
 * This card displays a tabular summary that gets updated with each event:
 * - Diet: Nutrition table with calories, macros, totals
 * - Gym: Workout log with exercises, sets, reps, weights
 *
 * Does not render for addiction/general trackers (they use event-comment pattern only)
 */
export function MasterSummaryCard({ summary, trackerType, isLoading }: MasterSummaryCardProps) {
  // Addiction and general trackers don't have master summary
  if (trackerType === 'addiction' || trackerType === 'general') {
    return null;
  }

  // Don't render if no summary and not loading
  if (!summary && !isLoading) {
    return null;
  }

  return (
    <div className="-mx-5 sm:-mx-7 px-5 sm:px-7 py-4 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-[var(--color-muted)]/20 rounded w-1/3" />
          <div className="h-32 bg-[var(--color-muted)]/20 rounded" />
          <div className="h-4 bg-[var(--color-muted)]/20 rounded w-2/3" />
        </div>
      ) : (
        <div className="master-summary-content overflow-x-auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h3: ({ children }) => (
                <h3 className="font-serif text-base font-semibold mb-3 text-[var(--color-text)]">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-sm text-[var(--color-text)] leading-relaxed mb-2 last:mb-0">
                  {children}
                </p>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-[var(--color-accent-dark)]">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="text-xs text-[var(--color-muted)] not-italic">{children}</em>
              ),
              hr: () => (
                <hr className="my-3 border-[var(--color-line)]" />
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-sm border-collapse">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead>
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-[var(--color-line)]">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr>
                  {children}
                </tr>
              ),
              th: ({ children }) => (
                <th className="px-2 py-2 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap border-b border-[var(--color-line)]">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-2 py-2 text-sm text-[var(--color-text)] whitespace-nowrap">
                  {children}
                </td>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-0.5 mb-2 text-sm text-[var(--color-text)]">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
            }}
          >
            {summary!}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
