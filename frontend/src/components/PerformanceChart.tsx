import { useState } from 'react'
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PerformanceSummary } from '../api/types'
import { PERIODS, isPeriodAvailable, longestAvailablePeriod, sliceToPeriod } from '../utils/performance'

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(date))
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

function formatReturn(pct: number) {
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

interface PerformanceChartProps {
  performance: PerformanceSummary
  showPeriodSelector?: boolean
}

export default function PerformanceChart({ performance, showPeriodSelector = false }: PerformanceChartProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const { series, benchmark } = performance
  if (series.length === 0) {
    return <p className="empty-state">No performance history available yet.</p>
  }

  const dates = series.map((p) => p.date)
  const available = new Set(PERIODS.filter((p) => isPeriodAvailable(p, dates)).map((p) => p.id))
  // Fall back to the longest available period, e.g. after switching to a
  // customer whose history does not cover the previous selection.
  const period = showPeriodSelector
    ? PERIODS.find((p) => p.id === selectedPeriodId && available.has(p.id)) ?? longestAvailablePeriod(dates)
    : null
  const view = sliceToPeriod(performance, period)

  const portfolioLabel = `Your portfolio (${formatReturn(view.portfolioReturnPct)})`
  const benchmarkLabel =
    benchmark && view.benchmarkReturnPct !== null ? `${benchmark.ticker} (${formatReturn(view.benchmarkReturnPct)})` : ''

  return (
    <>
      {showPeriodSelector && (
        <div className="period-selector" role="group" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`period-selector__button${p.id === period?.id ? ' period-selector__button--active' : ''}`}
              onClick={() => setSelectedPeriodId(p.id)}
              disabled={!available.has(p.id)}
              aria-pressed={p.id === period?.id}
              title={available.has(p.id) ? undefined : `Not enough history - data starts ${formatLongDate(dates[0])}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={view.points}>
          <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={40} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} width={50} />
          <Tooltip
            labelFormatter={(label: string) => formatDate(label)}
            formatter={(value: number, name: string) => [`${value.toLocaleString('en-US')} NOK`, name]}
          />
          <Legend />
          <Line type="monotone" dataKey="portfolio" name={portfolioLabel} stroke="#2563eb" strokeWidth={2} dot={false} />
          {benchmarkLabel && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmarkLabel}
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {benchmarkLabel && (
        <p className="chart-footnote">
          {benchmark?.ticker} is rebased to start at your portfolio value. Index data: {benchmark?.source}. Portfolio
          values are synthetic, so the comparison is illustrative only.
        </p>
      )}
      {showPeriodSelector && available.size < PERIODS.length && (
        <p className="chart-footnote">
          Greyed-out periods need more history than the demo has (data from {formatLongDate(dates[0])}).
        </p>
      )}
    </>
  )
}
