import { create } from 'zustand'
import type { AnalysisContent } from '@/server/actions/analysis.actions'

type AnalysisCacheState = {
  // Only cache COMPLETED analysis
  completedAnalysis: Map<string, AnalysisContent>
  setCompleted: (eventId: string, content: AnalysisContent) => void
  getCompleted: (eventId: string) => AnalysisContent | undefined
}

export const useAnalysisCache = create<AnalysisCacheState>((set, get) => ({
  completedAnalysis: new Map(),
  setCompleted: (eventId, content) =>
    set(state => {
      const newMap = new Map(state.completedAnalysis)
      newMap.set(eventId, content)
      return { completedAnalysis: newMap }
    }),
  getCompleted: (eventId) => get().completedAnalysis.get(eventId)
}))
