'use client';

import { useState, useMemo } from 'react';
import { useHydrated } from '@/hooks/useHydrated';
import { useDietStats } from '@/hooks/useDietStats';
import { useDietGoalProfile, useWeightTrend, useBodyFatTrend } from '@/store/diet-goals.store';
import { BackButton } from '@/components/ui/BackButton';
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Line,
  XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { mergeTimeseriesData } from '@/lib/diet/stats-utils';
import type { DietStatDay } from '@/server/actions/diet-stats.actions';

// Hardcoded hex — CSS vars don't work in SVG fill/stroke
const COLORS = {
  calories: '#06d6a0',
  protein: '#ef476f',
  carbs: '#3de8b8',
  fat: '#8a8a94',
  weight: '#a78bfa',
  bodyFat: '#f59e0b',
  deficit: '#fbbf24',
  grid: '#35353d',
};

const UNITS: Record<string, string> = {
  calories: ' cal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  weight: ' kg',
  bodyFatPercent: '%',
  deficit: ' cal',
};

type RangeKey = '3d' | '7d' | '14d' | '30d' | '90d' | 'all';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '3d', label: '3D', days: 3 },
  { key: '7d', label: '1W', days: 7 },
  { key: '14d', label: '2W', days: 14 },
  { key: '30d', label: '1M', days: 30 },
  { key: '90d', label: '3M', days: 90 },
  { key: 'all', label: 'All', days: 9999 },
];

// ============================================================================
// COLLAPSIBLE CHART SECTION
// ============================================================================

function ChartSection({
  title,
  right,
  defaultOpen = true,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full mb-2"
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown className="w-3 h-3 text-[var(--color-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--color-muted)]" />}
          <span className="text-[11px] text-[var(--color-muted)] uppercase tracking-wider">{title}</span>
        </div>
        {right && <div>{right}</div>}
      </button>
      {open && children}
    </section>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function DietStatsPage() {
  const hydrated = useHydrated();
  const { days, loading, error, refresh } = useDietStats();
  const profile = useDietGoalProfile();
  const weightTrend = useWeightTrend();
  const bodyFatTrend = useBodyFatTrend();
  const [range, setRange] = useState<RangeKey>('7d');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const r = RANGES.find(r => r.key === range)!;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - r.days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return days
      .filter(d => r.key === 'all' || d.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [days, range]);

  const targets = profile?.targets;

  const chartData = useMemo(() =>
    filtered.map(d => ({
      date: d.date.slice(5), // MM-DD
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
    })),
  [filtered]);

  // Merged data for correlation charts
  const mergedData = useMemo(() => {
    if (filtered.length === 0) return [];
    return mergeTimeseriesData(
      filtered,
      weightTrend,
      bodyFatTrend,
      targets?.calories ?? 0,
    );
  }, [filtered, weightTrend, bodyFatTrend, targets?.calories]);

  const hasWeightCorrelation = mergedData.some(d => d.weight != null);
  const hasBodyFatCorrelation = mergedData.some(d => d.bodyFatPercent != null);

  const weightChartData = useMemo(() =>
    weightTrend.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: d.weight,
    })),
  [weightTrend]);

  const bodyFatChartData = useMemo(() =>
    bodyFatTrend.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bodyFatPercent: d.bodyFatPercent,
    })),
  [bodyFatTrend]);

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-muted)]" />
      </div>
    );
  }

  const xInterval = chartData.length > 14 ? Math.floor(chartData.length / 7) : 0;
  const mergedXInterval = mergedData.length > 14 ? Math.floor(mergedData.length / 7) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <span className="text-sm font-medium text-[var(--color-text)]">Diet Stats</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 px-4 py-4 space-y-5">
        {/* Range filter */}
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`flex-1 py-1.5 text-xs text-center border transition-colors ${
                range === r.key
                  ? 'border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]'
                  : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && days.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-muted)]" />
          </div>
        )}

        {error && (
          <div className="text-sm text-[var(--color-error)] text-center py-8">{error}</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-sm text-[var(--color-muted)] text-center py-16">
            No diet data for this period
          </div>
        )}

        {filtered.length > 0 && (
          <>
            {/* Summary row */}
            <SummaryRow days={filtered} targets={targets} />

            {/* Calories area chart */}
            <ChartSection
              title="Calories"
              right={targets?.calories ? <span className="text-[10px] text-[var(--color-muted)]">target: {targets.calories}</span> : undefined}
            >
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.calories} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.calories} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.fat }} interval={xInterval} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.fat }} />
                  <Tooltip content={<ChartTooltip />} />
                  {targets?.calories && (
                    <ReferenceLine y={targets.calories} stroke={COLORS.calories} strokeDasharray="6 3" strokeOpacity={0.5} />
                  )}
                  <Area
                    type="monotone"
                    dataKey="calories"
                    stroke={COLORS.calories}
                    fill="url(#calGrad)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: COLORS.calories, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS.calories }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartSection>

            {/* Macros grouped bar chart */}
            <ChartSection
              title="Macros"
              right={
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[9px]">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.protein }} />
                    <span className="text-[var(--color-muted)]">P</span>
                  </span>
                  <span className="flex items-center gap-1 text-[9px]">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.carbs }} />
                    <span className="text-[var(--color-muted)]">C</span>
                  </span>
                  <span className="flex items-center gap-1 text-[9px]">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.fat }} />
                    <span className="text-[var(--color-muted)]">F</span>
                  </span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.fat }} interval={xInterval} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.fat }} />
                  <Tooltip content={<ChartTooltip />} />
                  {targets?.protein && (
                    <ReferenceLine y={targets.protein} stroke={COLORS.protein} strokeDasharray="6 3" strokeOpacity={0.35} />
                  )}
                  {targets?.carbs && (
                    <ReferenceLine y={targets.carbs} stroke={COLORS.carbs} strokeDasharray="6 3" strokeOpacity={0.35} />
                  )}
                  {targets?.fat && (
                    <ReferenceLine y={targets.fat} stroke={COLORS.fat} strokeDasharray="6 3" strokeOpacity={0.35} />
                  )}
                  <Bar dataKey="protein" fill={COLORS.protein} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="carbs" fill={COLORS.carbs} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="fat" fill={COLORS.fat} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartSection>

            {/* CORRELATION CHARTS */}

            {/* Chart 1: Weight vs Deficit */}
            {hasWeightCorrelation && targets?.calories && (
              <ChartSection title="Weight vs Deficit" defaultOpen={false}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={mergedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="deficitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.deficit} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLORS.deficit} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: COLORS.fat }} interval={mergedXInterval} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: COLORS.deficit }} label={{ value: 'cal', angle: -90, position: 'insideLeft', fontSize: 9, fill: COLORS.fat }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: COLORS.weight }} domain={['dataMin - 1', 'dataMax + 1']} label={{ value: 'kg', angle: 90, position: 'insideRight', fontSize: 9, fill: COLORS.fat }} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine yAxisId="left" y={0} stroke={COLORS.grid} strokeDasharray="3 3" />
                    <Area yAxisId="left" type="monotone" dataKey="deficit" stroke={COLORS.deficit} fill="url(#deficitGrad)" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="weight" stroke={COLORS.weight} strokeWidth={2} dot={{ r: 2, fill: COLORS.weight, strokeWidth: 0 }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartSection>
            )}

            {/* Chart 2: Weight vs Calories */}
            {hasWeightCorrelation && (
              <ChartSection title="Weight vs Calories" defaultOpen={false}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={mergedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="calCorrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.calories} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.calories} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: COLORS.fat }} interval={mergedXInterval} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: COLORS.calories }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: COLORS.weight }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip content={<ChartTooltip />} />
                    {targets?.calories && (
                      <ReferenceLine yAxisId="left" y={targets.calories} stroke={COLORS.calories} strokeDasharray="6 3" strokeOpacity={0.5} />
                    )}
                    <Area yAxisId="left" type="monotone" dataKey="calories" stroke={COLORS.calories} fill="url(#calCorrGrad)" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="weight" stroke={COLORS.weight} strokeWidth={2} dot={{ r: 2, fill: COLORS.weight, strokeWidth: 0 }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartSection>
            )}

            {/* Chart 3: Body Fat % vs Protein & Calories */}
            {hasBodyFatCorrelation && (
              <ChartSection title="Fat% vs Protein & Calories" defaultOpen={false}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={mergedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="calBfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.calories} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.calories} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: COLORS.fat }} interval={mergedXInterval} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: COLORS.calories }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: COLORS.bodyFat }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area yAxisId="left" type="monotone" dataKey="calories" stroke={COLORS.calories} fill="url(#calBfGrad)" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="protein" stroke={COLORS.protein} strokeWidth={1.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="bodyFatPercent" stroke={COLORS.bodyFat} strokeWidth={2} dot={{ r: 2, fill: COLORS.bodyFat, strokeWidth: 0 }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartSection>
            )}
          </>
        )}

        {/* Weight trend (from profile versions, independent of diet event range) */}
        {weightChartData.length >= 2 && (
          <ChartSection title="Weight" defaultOpen={false} right={
            <span className="text-[10px] text-[var(--color-muted)]">
              latest: {weightChartData[weightChartData.length - 1].weight} kg
            </span>
          }>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={weightChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.weight} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.weight} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.fat }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.fat }} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke={COLORS.weight}
                  fill="url(#weightGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.weight, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.weight }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        )}

        {/* Body Fat % trend (from profile versions) */}
        {bodyFatChartData.length >= 2 && (
          <ChartSection title="Body Fat %" defaultOpen={false} right={
            <span className="text-[10px] text-[var(--color-muted)]">
              latest: {bodyFatChartData[bodyFatChartData.length - 1].bodyFatPercent}%
            </span>
          }>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={bodyFatChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.bodyFat} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.bodyFat} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.fat }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.fat }} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="bodyFatPercent"
                  stroke={COLORS.bodyFat}
                  fill="url(#bfGrad)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.bodyFat, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: COLORS.bodyFat }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        )}
      </main>
      <BackButton />
    </div>
  );
}

// ============================================================================
// CUSTOM TOOLTIP (extended with units)
// ============================================================================

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="px-3 py-2 border border-[var(--color-line)] bg-[var(--color-surface)]" style={{ borderRadius: 4 }}>
      <div className="text-[10px] text-[var(--color-muted)] mb-1">{label}</div>
      {payload.map(entry => {
        if (entry.value == null) return null;
        const unit = UNITS[entry.dataKey] ?? '';
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[var(--color-text)]">{entry.dataKey}: {entry.value}{unit}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// SUMMARY ROW
// ============================================================================

function SummaryRow({ days, targets }: { days: DietStatDay[]; targets?: { calories: number; protein: number; carbs: number; fat: number } | null }) {
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const avgCal = avg(days.map(d => d.calories));
  const avgP = avg(days.map(d => d.protein));
  const avgC = avg(days.map(d => d.carbs));
  const avgF = avg(days.map(d => d.fat));

  return (
    <div className="grid grid-cols-4 gap-2">
      <StatCell label="Avg Cal" value={avgCal} target={targets?.calories} />
      <StatCell label="Avg P" value={avgP} unit="g" target={targets?.protein} />
      <StatCell label="Avg C" value={avgC} unit="g" target={targets?.carbs} />
      <StatCell label="Avg F" value={avgF} unit="g" target={targets?.fat} />
    </div>
  );
}

function StatCell({ label, value, unit, target }: { label: string; value: number; unit?: string; target?: number }) {
  const diff = target ? value - target : 0;
  const diffStr = target ? (diff > 0 ? `+${diff}` : `${diff}`) : null;
  const diffColor = target
    ? Math.abs(diff) < target * 0.05 ? 'text-[var(--color-lime)]' : 'text-[var(--color-muted)]'
    : '';

  return (
    <div className="p-2 border border-[var(--color-line)] text-center">
      <div className="text-[9px] text-[var(--color-muted)] uppercase">{label}</div>
      <div className="text-sm font-medium text-[var(--color-text)]">{value}{unit}</div>
      {diffStr && <div className={`text-[10px] ${diffColor}`}>{diffStr}</div>}
    </div>
  );
}
