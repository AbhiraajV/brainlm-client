'use client';

import { useState } from 'react';
import {
  Target,
  Clock,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { ConfidenceLevel } from '@prisma/client';

// Types for the JSON fields
interface FocusArea {
  area: string;
  reasoning: string;
  patternRef?: string;
  confidence: ConfidenceLevel;
}

interface Session {
  timeSlot: string;
  activity: string;
  reasoning: string;
  optional?: boolean;
}

interface Warning {
  warning: string;
  patternId?: string;
  confidence: ConfidenceLevel;
}

interface CTA {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface DailyPlanData {
  id: string;
  targetDate: Date;
  focusAreas: FocusArea[];
  sessions: Session[];
  warnings: Warning[];
  ctas: CTA[];
  renderedMarkdown: string;
  createdAt: Date;
}

interface DailyPlanCardProps {
  plan: DailyPlanData;
  onReadMore?: () => void;
}

const confidenceColors: Record<ConfidenceLevel, { bg: string; text: string }> = {
  HIGH: { bg: 'bg-[var(--color-accent)]/15', text: 'text-[var(--color-accent)]' },
  MEDIUM: { bg: 'bg-[var(--color-warn)]/15', text: 'text-[var(--color-warn)]' },
  EMERGING: { bg: 'bg-[var(--color-muted)]/15', text: 'text-[var(--color-muted)]' },
};

const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-[var(--color-error)]/15', text: 'text-[var(--color-error)]', label: 'High' },
  medium: { bg: 'bg-[var(--color-warn)]/15', text: 'text-[var(--color-warn)]', label: 'Medium' },
  low: { bg: 'bg-[var(--color-muted)]/15', text: 'text-[var(--color-muted)]', label: 'Low' },
};

function formatDate(date: Date): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const planDate = new Date(d);
  planDate.setHours(0, 0, 0, 0);

  if (planDate.getTime() === today.getTime()) {
    return 'Today';
  }
  if (planDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  color,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${color}`} />
      <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
      {count !== undefined && (
        <span className="text-[11px] text-[var(--color-muted)]">({count})</span>
      )}
    </div>
  );
}

export function DailyPlanCard({ plan, onReadMore }: DailyPlanCardProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    focus: true,
    sessions: true,
    warnings: false,
    ctas: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const dateLabel = formatDate(plan.targetDate);
  const isToday = dateLabel === 'Today';
  const isTomorrow = dateLabel === 'Tomorrow';

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-line)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${isToday || isTomorrow
                ? 'bg-[var(--color-accent)]/15'
                : 'bg-[var(--color-bg)]'
              }
            `}>
              <Calendar className={`w-5 h-5 ${
                isToday || isTomorrow
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-muted)]'
              }`} />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-lg text-[var(--color-text)]">
                {dateLabel}
              </h3>
              <p className="text-[11px] text-[var(--color-muted)]">
                {new Date(plan.targetDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          {(isToday || isTomorrow) && (
            <span className={`
              px-2.5 py-1
              text-[10px] font-medium uppercase tracking-wide
              rounded-full
              ${isToday
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'bg-[var(--color-accent-secondary)]/15 text-[var(--color-accent-secondary)]'
              }
            `}>
              {isToday ? 'Active' : 'Upcoming'}
            </span>
          )}
        </div>
      </div>

      {/* Focus Areas */}
      {plan.focusAreas.length > 0 && (
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <button
            onClick={() => toggleSection('focus')}
            className="w-full flex items-center justify-between"
          >
            <SectionHeader
              icon={Target}
              title="Focus Areas"
              count={plan.focusAreas.length}
              color="text-[var(--color-accent)]"
            />
            {expandedSections.focus ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
            )}
          </button>

          {expandedSections.focus && (
            <div className="space-y-3 mt-2">
              {plan.focusAreas.map((focus, idx) => {
                const conf = confidenceColors[focus.confidence];
                return (
                  <div key={idx} className="pl-6">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {focus.area}
                      </span>
                      <span className={`
                        px-1.5 py-0.5 text-[9px] font-medium uppercase rounded
                        ${conf.bg} ${conf.text}
                      `}>
                        {focus.confidence}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--color-muted)] leading-relaxed">
                      {focus.reasoning}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sessions / Schedule */}
      {plan.sessions.length > 0 && (
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <button
            onClick={() => toggleSection('sessions')}
            className="w-full flex items-center justify-between"
          >
            <SectionHeader
              icon={Clock}
              title="Suggested Schedule"
              count={plan.sessions.length}
              color="text-[var(--color-accent-secondary)]"
            />
            {expandedSections.sessions ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
            )}
          </button>

          {expandedSections.sessions && (
            <div className="space-y-3 mt-2">
              {plan.sessions.map((session, idx) => (
                <div key={idx} className="pl-6 flex gap-3">
                  <div className="shrink-0 w-20">
                    <span className={`
                      text-[12px] font-medium
                      ${session.optional
                        ? 'text-[var(--color-muted)]'
                        : 'text-[var(--color-text)]'
                      }
                    `}>
                      {session.timeSlot}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`
                        text-sm
                        ${session.optional
                          ? 'text-[var(--color-muted)]'
                          : 'text-[var(--color-text)]'
                        }
                      `}>
                        {session.activity}
                      </span>
                      {session.optional && (
                        <span className="text-[9px] text-[var(--color-muted)] uppercase">
                          optional
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--color-muted)] leading-relaxed mt-0.5">
                      {session.reasoning}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <button
            onClick={() => toggleSection('warnings')}
            className="w-full flex items-center justify-between"
          >
            <SectionHeader
              icon={AlertTriangle}
              title="Watch Out For"
              count={plan.warnings.length}
              color="text-[var(--color-warn)]"
            />
            {expandedSections.warnings ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
            )}
          </button>

          {expandedSections.warnings && (
            <div className="space-y-2 mt-2">
              {plan.warnings.map((warning, idx) => {
                const conf = confidenceColors[warning.confidence];
                return (
                  <div
                    key={idx}
                    className="
                      pl-6 py-2 pr-3
                      bg-[var(--color-warn)]/5
                      border-l-2 border-[var(--color-warn)]
                      rounded-r-[var(--radius-sm)]
                    "
                  >
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-[var(--color-text)] flex-1">
                        {warning.warning}
                      </p>
                      <span className={`
                        shrink-0 px-1.5 py-0.5 text-[9px] font-medium uppercase rounded
                        ${conf.bg} ${conf.text}
                      `}>
                        {warning.confidence}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CTAs / Actions */}
      {plan.ctas.length > 0 && (
        <div className="px-5 py-4">
          <button
            onClick={() => toggleSection('ctas')}
            className="w-full flex items-center justify-between"
          >
            <SectionHeader
              icon={Zap}
              title="Actions"
              count={plan.ctas.length}
              color="text-[var(--color-accent)]"
            />
            {expandedSections.ctas ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
            )}
          </button>

          {expandedSections.ctas && (
            <div className="space-y-3 mt-2">
              {plan.ctas.map((cta, idx) => {
                const priority = priorityColors[cta.priority] || priorityColors.medium;
                return (
                  <div key={idx} className="pl-6">
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`
                        shrink-0 px-1.5 py-0.5 text-[9px] font-medium uppercase rounded
                        ${priority.bg} ${priority.text}
                      `}>
                        {priority.label}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {cta.action}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--color-muted)] leading-relaxed ml-12">
                      {cta.reasoning}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Read more button */}
      {onReadMore && (
        <div className="px-5 py-3 bg-[var(--color-bg)] border-t border-[var(--color-line)]">
          <button
            onClick={onReadMore}
            className="
              w-full flex items-center justify-center gap-2
              py-2 text-sm text-[var(--color-accent)]
              hover:text-[var(--color-accent-dark)]
              transition-colors
            "
          >
            <Sparkles className="w-4 h-4" />
            View full plan details
          </button>
        </div>
      )}
    </div>
  );
}
