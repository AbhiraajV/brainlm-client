'use client';

import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import type { SessionKnowledge } from '@/lib/sessions/types';

interface Props {
  knowledge: SessionKnowledge;
}

export function KnowledgeContent({ knowledge }: Props) {
  return (
    <div className="space-y-3">
      {knowledge.events.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Related Events</h4>
          <div className="space-y-2">
            {knowledge.events.map((event, i) => (
              <div key={event.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <p className="line-clamp-2">{event.content}</p>
                <p className="text-[10px] text-[var(--color-muted)] mt-1">
                  {new Date(event.occurredAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.interpretations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Interpretations</h4>
          <div className="space-y-2">
            {knowledge.interpretations.map((interp, i) => (
              <div key={interp.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <MarkdownRenderer content={interp.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.patterns.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Patterns</h4>
          <div className="space-y-2">
            {knowledge.patterns.map((pattern, i) => (
              <div key={pattern.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <p className="font-medium mb-1">{pattern.name}</p>
                <MarkdownRenderer content={pattern.description} />
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.insights.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Insights</h4>
          <div className="space-y-2">
            {knowledge.insights.map((insight, i) => (
              <div key={insight.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <MarkdownRenderer content={insight.content} />
              </div>
            ))}
          </div>
        </div>
      )}

      {knowledge.reviews.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">Reviews</h4>
          <div className="space-y-2">
            {knowledge.reviews.map((review, i) => (
              <div key={review.id || i} className="p-2 bg-[var(--color-bg)] rounded border border-[var(--color-line)] text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-surface)] rounded">{review.type}</span>
                  <span className="text-[10px] text-[var(--color-muted)]">{review.periodKey}</span>
                </div>
                <MarkdownRenderer content={review.summary} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
