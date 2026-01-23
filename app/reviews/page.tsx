'use client'

import { useState } from 'react'
import { ReviewType } from '@prisma/client'
import { ReviewsFeed, ReviewTypeFilter } from '@/components/reviews'
import { BackButton } from '@/components/ui/BackButton'

// Client page with local state for type filter (no useSearchParams = no Suspense needed)
export default function ReviewsPage() {
  const [type, setType] = useState<ReviewType | undefined>(undefined)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="
        sticky top-0 z-10
        h-14
        flex items-center justify-between
        px-5 sm:px-7
        bg-[var(--color-surface)]
        border-b border-[var(--color-line)]
      ">
        <div className="font-serif font-semibold text-lg text-[var(--color-text)]">
          Reviews
        </div>
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-60" />
      </header>

      {/* Main content */}
      <main className="flex-1 py-6 sm:py-8 pb-24 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Subtitle */}
          <p className="text-sm text-[var(--color-muted)]">
            Your daily, weekly, and monthly reviews
          </p>
          <p className="text-sm font-semibold italic text-[var(--color-muted)]">
            Internal notes our AI uses to understand you — here if you're curious!
          </p>

          {/* Type filter */}
          <ReviewTypeFilter value={type} onChange={setType} />

          {/* Reviews feed */}
          <ReviewsFeed type={type} limit={20} />
        </div>
      </main>

      {/* Fixed back button - bottom left (uses browser history for instant nav) */}
      <BackButton />
    </div>
  )
}
