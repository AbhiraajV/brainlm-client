'use client';

import type { ReactNode } from 'react';

interface FixedInputContainerProps {
  children: ReactNode;
  gradient?: boolean;
}

export function FixedInputContainer({ children, gradient = false }: FixedInputContainerProps) {
  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-20
        pb-[max(0.75rem,env(safe-area-inset-bottom))]
        px-0
        pointer-events-none
        ${gradient
          ? 'pt-8 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)] to-transparent'
          : 'pt-3 bg-[var(--color-bg)] shadow-[0_-4px_12px_rgba(0,0,0,0.2)]'
        }
      `}
    >
      <div className="pointer-events-auto">
        {children}
      </div>
    </div>
  );
}
