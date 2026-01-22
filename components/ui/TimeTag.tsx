'use client'

type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

function getTimeOfDay(date: Date): { label: TimeOfDay; emoji: string } {
  const hours = date.getHours()
  if (hours >= 5 && hours < 12) return { label: 'Morning', emoji: '🌅' }
  if (hours >= 12 && hours < 17) return { label: 'Afternoon', emoji: '☀️' }
  if (hours >= 17 && hours < 21) return { label: 'Evening', emoji: '🌆' }
  return { label: 'Night', emoji: '🌙' }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatSmartDate(date: Date): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Today: no extra date label needed
  if (diffDays === 0) {
    return ''
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday'
  }

  // This week: show day name
  if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Older: show date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TimeTag({ date }: { date: Date }) {
  const d = new Date(date)
  const { emoji } = getTimeOfDay(d)
  const time = formatTime(d)
  const smartDate = formatSmartDate(d)

  return (
    <span className="text-micro" suppressHydrationWarning>
      {emoji}
      <span className="mx-1.5 text-[var(--color-line)]">·</span>
      {time}
      {smartDate && (
        <>
          <span className="mx-1.5 text-[var(--color-line)]">·</span>
          {smartDate}
        </>
      )}
    </span>
  )
}
