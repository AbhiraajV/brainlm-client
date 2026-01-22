import { getAnalysisStats } from '@/server/actions/analysis.actions'

type Props = {
    dateFilter?: {
        from?: string
        to?: string
    }
    filterLabel?: string
}

export async function AnalysisStats({ dateFilter, filterLabel = 'today' }: Props) {
    const stats = await getAnalysisStats(dateFilter)

    // Don't show anything if there's no activity
    if (stats.interpretations === 0 && stats.patterns === 0 && stats.insights === 0) {
        return null
    }

    return (
        <p className="-mt-4 text-[10px] text-[var(--color-muted)]/50 italic text-center leading-relaxed">
            <span className="font-semibold">{stats.patterns}</span> patterns
            {' · '}
            <span className="font-semibold">{stats.interpretations}</span> bias-free interpretations
            {' · '}
            <span className="font-semibold">{stats.insights}</span> deep insights
            {' · '}
            <span className="font-semibold">{stats.aiCommittees}</span> AI Consortiums {filterLabel}
        </p>
    )
}
