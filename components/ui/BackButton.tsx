'use client'

import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  /** Custom class names to override default positioning */
  className?: string
}

/**
 * Instant back button using browser history.
 * Uses window.history.back() which leverages browser's bfcache for instant navigation.
 */
export function BackButton({ className }: BackButtonProps) {
  const defaultClasses = `
    fixed bottom-6 left-6
    z-20
    w-12 h-12
    flex items-center justify-center
    bg-[var(--color-surface)]
    border border-[var(--color-line)]
    rounded-full
    shadow-lg
    transition-all duration-200
    hover:shadow-xl hover:border-[var(--color-accent)]
    active:scale-95
  `

  return (
    <button
      onClick={() => window.history.back()}
      className={className || defaultClasses}
      aria-label="Go back"
    >
      <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
    </button>
  )
}
