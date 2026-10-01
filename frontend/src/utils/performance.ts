// Time-period helpers for the performance chart. Pure functions so they are
// easy to unit test.
import type { PerformanceSummary } from '../api/types'

export interface Period {
  id: string
  label: string
  months?: number
  yearToDate?: boolean
  allTime?: boolean
}

export const PERIODS: Period[] = [
  { id: '1M', label: '1M', months: 1 },
  { id: '3M', label: '3M', months: 3 },
  { id: 'YTD', label: 'YTD', yearToDate: true },
  { id: '1Y', label: '1Y', months: 12 },
  { id: '2Y', label: '2Y', months: 24 },
  { id: '3Y', label: '3Y', months: 36 },
  { id: '5Y', label: '5Y', months: 60 },
  { id: '10Y', label: '10Y', months: 120 },
  { id: 'ALL', label: 'All time', allTime: true },
]

// Allow a few days of slack so e.g. "3M" still counts as available when the
// history starts just after the exact 3-month mark (weekends, holidays).
const AVAILABILITY_TOLERANCE_DAYS = 7

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// First date included in the period, or null when it has no lower bound.
export function periodStart(period: Period, endDate: string): string | null {
  if (period.allTime) return null
  const end = toUtcDate(endDate)
  if (period.yearToDate) return `${end.getUTCFullYear()}-01-01`
  const start = new Date(end)
  start.setUTCMonth(start.getUTCMonth() - (period.months ?? 0))
  return toIsoDate(start)
}

export function isPeriodAvailable(period: Period, dates: string[]): boolean {
  if (dates.length < 2) return false
  const start = periodStart(period, dates[dates.length - 1])
  if (start === null) return true
  const latestAllowedStart = toUtcDate(start)
  latestAllowedStart.setUTCDate(latestAllowedStart.getUTCDate() + AVAILABILITY_TOLERANCE_DAYS)
  return toUtcDate(dates[0]) <= latestAllowedStart
}

// The longest fixed-length period the data covers, used as the default
// selection ("All time" is always available, so it is not considered).
export function longestAvailablePeriod(dates: string[]): Period | null {
  return [...PERIODS].reverse().find((period) => !period.allTime && isPeriodAvailable(period, dates)) ?? null
}

export interface ChartPoint {
  date: string
  portfolio: number
  benchmark?: number
}

export interface PeriodView {
  points: ChartPoint[]
  portfolioReturnPct: number
  benchmarkReturnPct: number | null
}

function returnPct(start: number | undefined, end: number | undefined): number | null {
  if (!start || end === undefined) return null
  return Number((((end - start) / start) * 100).toFixed(2))
}

// Cuts the series to the period (or keeps everything when period is null)
// and rebases the benchmark so both lines start at the same point again.
export function sliceToPeriod(performance: PerformanceSummary, period: Period | null): PeriodView {
  const { series, benchmark } = performance
  const start = period && series.length > 0 ? periodStart(period, series[series.length - 1].date) : null
  const window = start === null ? series : series.filter((p) => p.date >= start)

  const benchmarkByDate = new Map(benchmark?.series.map((p) => [p.date, p.value]))
  const firstPortfolio = window[0]?.value
  const firstBenchmark = window[0] ? benchmarkByDate.get(window[0].date) : undefined
  const scale = firstPortfolio && firstBenchmark ? firstPortfolio / firstBenchmark : null

  const points = window.map((p) => {
    const raw = benchmarkByDate.get(p.date)
    return {
      date: p.date,
      portfolio: p.value,
      benchmark: scale && raw !== undefined ? Number((raw * scale).toFixed(2)) : undefined,
    }
  })

  const last = points[points.length - 1]
  return {
    points,
    portfolioReturnPct: returnPct(points[0]?.portfolio, last?.portfolio) ?? 0,
    benchmarkReturnPct: scale ? returnPct(points[0]?.benchmark, last?.benchmark) : null,
  }
}
