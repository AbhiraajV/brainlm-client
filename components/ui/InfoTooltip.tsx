'use client'

import { useState, useRef, useEffect } from 'react'

interface InfoTooltipProps {
  content: string
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-4 h-4
          flex items-center justify-center
          rounded-full
          text-[10px] font-medium
          text-[var(--color-muted)]
          border border-[var(--color-line)]
          transition-colors duration-150
          hover:text-[var(--color-accent-secondary)]
          hover:border-[var(--color-accent-secondary)]
          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-[var(--color-accent-secondary)]
          focus-visible:ring-offset-1
        "
        aria-label="More information"
      >
        i
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="
            absolute z-50
            top-full left-1/2 -translate-x-1/2
            mt-2
            w-64 sm:w-72
            p-3
            bg-[var(--color-surface)]
            border border-[var(--color-line)]
            rounded-[var(--radius-sm)]
            shadow-lg
            text-xs text-[var(--color-muted)]
            leading-relaxed
          "
        >
          {content}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[var(--color-surface)] border-l border-t border-[var(--color-line)]" />
        </div>
      )}
    </div>
  )
}
