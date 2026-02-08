'use client';

import type { ReactNode } from 'react';

export interface Tab {
  id: string;
  label?: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  size?: 'sm' | 'md';
  accentColor?: string;
}

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
  size = 'md',
  accentColor = 'var(--color-lime)',
}: TabBarProps) {
  if (size === 'sm') {
    return (
      <div className="flex border-b border-[var(--color-line)]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={(e) => { e.stopPropagation(); onTabChange(tab.id); }}
              className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider border-b -mb-px transition-all"
              style={{
                borderColor: isActive ? accentColor : 'transparent',
                color: isActive ? accentColor : 'var(--color-muted)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex border-b border-[var(--color-line)]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 -mb-px transition-all"
            style={{
              borderColor: isActive ? accentColor : 'transparent',
              color: isActive ? accentColor : 'var(--color-muted)',
              backgroundColor: isActive ? `color-mix(in srgb, ${accentColor} 5%, transparent)` : 'transparent',
            }}
          >
            {tab.icon && (
              <span className="w-4 h-4 flex items-center justify-center">
                {tab.icon}
              </span>
            )}
            {tab.label && <span>{tab.label}</span>}
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                className="text-[9px] px-1 py-px min-w-[16px] text-center rounded-full border"
                style={{
                  borderColor: isActive ? accentColor : 'var(--color-muted)',
                  color: isActive ? accentColor : 'var(--color-muted)',
                  backgroundColor: 'transparent',
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
