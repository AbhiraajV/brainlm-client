'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { User, BookOpen, CalendarDays, Menu, X } from 'lucide-react'

export function NavButtonGroup() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Navigate with transition for non-blocking UI
  const navigate = useCallback((path: string) => {
    setIsExpanded(false)
    startTransition(() => {
      router.push(path)
    })
  }, [router])

  return (
    <nav
      className={`
        fixed right-4 z-30
        flex flex-col
        bg-[var(--color-surface)]
        border border-[var(--color-line)]
        rounded-full
        shadow-[var(--shadow-card)]
        overflow-hidden
        transition-all duration-300 ease-out
        ${isPending ? 'opacity-70' : ''}
      `}
      style={{ bottom: '120px' }}
    >
      {/* Expandable buttons */}
      <div
        className={`
          flex flex-col
          transition-all duration-300 ease-out
          ${isExpanded ? 'max-h-40 opacity-100 pointer-events-auto' : 'max-h-0 opacity-0 pointer-events-none'}
        `}
      >
        <button
          onClick={() => navigate('/plans')}
          className="
            w-11 h-11
            flex items-center justify-center
            transition-all duration-200
            hover:bg-[var(--color-bg)]
          "
          style={{ color: 'var(--color-warn)' }}
          aria-label="Daily Plans"
        >
          <CalendarDays className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="h-px bg-[var(--color-line)]" />
        <button
          onClick={() => navigate('/reviews')}
          className="
            w-11 h-11
            flex items-center justify-center
            transition-all duration-200
            hover:bg-[var(--color-bg)]
          "
          style={{ color: 'var(--color-accent)' }}
          aria-label="Reviews"
        >
          <BookOpen className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="h-px bg-[var(--color-line)]" />
        <button
          onClick={() => navigate('/me')}
          className="
            w-11 h-11
            flex items-center justify-center
            transition-all duration-200
            hover:bg-[var(--color-bg)]
          "
          style={{ color: 'var(--color-accent-secondary)' }}
          aria-label="My Profile"
        >
          <User className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="h-px bg-[var(--color-line)]" />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          w-11 h-11
          flex items-center justify-center
          transition-all duration-200
          hover:bg-[var(--color-bg)]
          text-[var(--color-muted)]
        "
        aria-label={isExpanded ? 'Close menu' : 'Open menu'}
      >
        <div className="relative w-5 h-5">
          <Menu
            className={`
              w-5 h-5 absolute inset-0
              transition-all duration-300
              ${isExpanded ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
            `}
            strokeWidth={1.5}
          />
          <X
            className={`
              w-5 h-5 absolute inset-0
              transition-all duration-300
              ${isExpanded ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
            `}
            strokeWidth={1.5}
          />
        </div>
      </button>
    </nav>
  )
}
