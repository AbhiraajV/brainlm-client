'use client'

/**
 * Full-page loading spinner for page transitions.
 * Used in loading.tsx files for instant navigation feedback.
 */
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)]">
      <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      <p className="text-sm text-[var(--color-muted)] mt-4">{message}</p>
    </div>
  )
}

/**
 * Inline loading spinner for content areas.
 */
export function ContentLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5">
      <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      <p className="text-sm text-[var(--color-muted)] mt-4">{message}</p>
    </div>
  )
}

/**
 * Skeleton loader for list items.
 */
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-[var(--color-line)] rounded w-3/4 mb-2" />
          <div className="h-3 bg-[var(--color-line)] rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
