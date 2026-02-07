'use client'

import { useEffect, useState } from 'react'
import { useFilterStore } from '@/store/filter.store'
import { getAnalysisStats } from '@/server/actions/analysis.actions'

const filterLabels: Record<string, string> = {
  all: 'all time',
  today: 'today',
  yesterday: 'yesterday',
  week: 'this week',
  month: 'this month',
  '30days': 'in the last 30 days'
}

type Stats = {
  patterns: number
  interpretations: number
  insights: number
  aiCommittees: number
}

export function AnalysisStats() {
  const { dateFilter, filterValue } = useFilterStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getAnalysisStats(dateFilter).then((result) => {
      if (!cancelled) {
        setStats(result)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [dateFilter])

  if (loading || !stats) {
    return null
  }

  if (stats.interpretations === 0 && stats.patterns === 0 && stats.insights === 0) {
    return null
  }

  const filterLabel = filterLabels[filterValue] || 'today'

  return null
  // return (
  //   <p className="-mt-4 text-[10px] text-[var(--color-muted)]/50 italic text-center leading-relaxed">
  //     <span className="font-semibold">{stats.patterns}</span> patterns
  //     {' · '}
  //     <span className="font-semibold">{stats.interpretations}</span> bias-free interpretations
  //     {' · '}
  //     <span className="font-semibold">{stats.insights}</span> deep insights
  //     {' · '}
  //     <span className="font-semibold">{stats.aiCommittees}</span> AI Consortiums {filterLabel}
  //   </p>
  // )
}
