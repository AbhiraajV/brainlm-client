export function ThinkingIndicator({
  message,
  isPolling
}: {
  message: string
  isPolling: boolean
}) {
  if (!isPolling) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-line)]" />
        <p className="text-sm text-[var(--color-muted)] italic">
          Waiting...
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Animated dots */}
      <div className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
          style={{ animation: 'pulse-subtle 1.4s ease-in-out infinite' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
          style={{ animation: 'pulse-subtle 1.4s ease-in-out 0.2s infinite' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
          style={{ animation: 'pulse-subtle 1.4s ease-in-out 0.4s infinite' }}
        />
      </div>

      {/* Thinking message */}
      <p className="text-sm text-[var(--color-muted)]">
        {message}
      </p>
    </div>
  )
}
