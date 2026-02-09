'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function InsightsSection({ title, icon: Icon, count, children, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--color-line)] last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 py-3 px-5 sm:px-7 text-left hover:bg-[var(--color-bg)] transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-muted)]" />
        )}
        <Icon className="w-4 h-4 text-[var(--color-muted)]" />
        <span className="text-sm font-medium text-[var(--color-text)]">{title}</span>
        {count !== undefined && (
          <span className="text-xs text-[var(--color-muted)]">({count})</span>
        )}
      </button>
      {isOpen && (
        <div className="px-5 sm:px-7 pb-4 pl-12 sm:pl-14">
          {children}
        </div>
      )}
    </div>
  );
}
