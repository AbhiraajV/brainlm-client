import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ReviewType } from '@prisma/client'
import { ReviewsFeed, ReviewTypeFilter } from '@/components/reviews'
import { getReviewCounts } from '@/server/actions/review.actions'
import { requireUser } from '@/server/auth'
import { prisma } from '@/server/prisma/client'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { baseline: true },
  })

  if (!dbUser?.baseline) {
    redirect('/onboarding')
  }

  const params = await searchParams
  const typeParam = typeof params.type === 'string' ? params.type : undefined
  const type = typeParam as ReviewType | undefined

  const counts = await getReviewCounts()

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
          <Suspense fallback={<div className="h-10" />}>
            <ReviewTypeFilter counts={counts} />
          </Suspense>

          {/* Reviews feed */}
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center py-16 px-5">
                <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
                <p className="text-sm text-[var(--color-muted)] mt-4">
                  Loading reviews...
                </p>
              </div>
            }
          >
            <ReviewsFeed type={type} limit={20} />
          </Suspense>
        </div>
      </main>

      {/* Fixed back button - bottom left */}
      <Link
        href="/"
        className="
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
        "
        aria-label="Go back to home"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--color-text)]" />
      </Link>
    </div>
  )
}
