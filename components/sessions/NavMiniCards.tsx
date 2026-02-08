'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, CalendarDays, User } from 'lucide-react';

const navItems = [
  { label: 'Review', href: '/reviews', icon: BookOpen, color: '#3b5fe0' },
  { label: 'Plan', href: '/plans', icon: CalendarDays, color: '#e0a820' },
  { label: 'Me', href: '/me', icon: User, color: '#a03040' },
] as const;

export function NavMiniCards() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className="
              flex items-center gap-2.5 px-3 py-2.5
              bg-[var(--color-surface)] rounded-xl
              border border-[var(--color-line)]
              transition-all duration-200
              hover:shadow-lg hover:shadow-black/5
              active:scale-[0.98]
            "
          >
            <div
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ backgroundColor: `${item.color}20` }}
            >
              <Icon className="w-4 h-4" style={{ color: item.color }} />
            </div>
            <span className="text-sm font-serif font-semibold text-[var(--color-text)]">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
