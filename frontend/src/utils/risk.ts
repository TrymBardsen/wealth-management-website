// Pure helpers that turn the API's risk numbers into plain-language,
// customer-friendly figures for the Risk page. Kept free of React so they
// are easy to unit test.
import type { AllocationSlice, PerformancePoint, RiskContribution, RiskHistory, RiskSummary } from '../api/types'

type FactorKey = keyof RiskSummary['factors']
type RiskCategory = RiskSummary['risk_category']

// Mirrors the factor weights in api/src/services/risk.ts - keep in sync.
export const RISK_FACTORS: Array<{ key: FactorKey; label: string; weight: number; color: string }> = [
  { key: 'asset_allocation_score', label: 'What you own', weight: 0.4, color: '#1d4ed8' },
  { key: 'concentration_score', label: 'How big your bets are', weight: 0.25, color: '#7c3aed' },
  { key: 'geography_score', label: 'Where in the world', weight: 0.15, color: '#0891b2' },
  { key: 'volatility_score', label: 'How much it moves', weight: 0.2, color: '#d97706' },
]

// Mirrors the category thresholds and profile mapping in risk.ts.
export const CATEGORY_BANDS: Array<{ category: RiskCategory; from: number; to: number }> = [
  { category: 'Low', from: 0, to: 35 },
  { category: 'Medium', from: 35, to: 65 },
  { category: 'High', from: 65, to: 100 },
]
export const EXPECTED_CATEGORY: Record<string, RiskCategory> = {
  Conservative: 'Low',
  Moderate: 'Low',
  Balanced: 'Medium',
  Growth: 'Medium',
  Aggressive: 'High',
}

// Asset types ordered from calm to volatile, coloured cool to warm.
export const ASSET_TYPES: Array<{ label: string; color: string }> = [
  { label: 'Cash', color: '#94a3b8' },
  { label: 'Bond', color: '#0ea5e9' },
  { label: 'Mutual Fund', color: '#6366f1' },
  { label: 'ETF', color: '#f59e0b' },
  { label: 'Equity', color: '#ea580c' },
]
export const VOLATILE_ASSET_TYPES = ['Mutual Fund', 'ETF', 'Equity']

export function assetTypeColor(assetType: string): string {
  return ASSET_TYPES.find((t) => t.label === assetType)?.color ?? '#64748b'
}

export function sortByCalmness(slices: AllocationSlice[]): AllocationSlice[] {
  const rank = (label: string) => {
    const index = ASSET_TYPES.findIndex((t) => t.label === label)
    return index === -1 ? ASSET_TYPES.length : index
  }
  return [...slices].sort((a, b) => rank(a.label) - rank(b.label))
}

export function scoreContributions(factors: RiskSummary['factors']) {
  return RISK_FACTORS.map((factor) => ({ ...factor, points: factors[factor.key] * factor.weight }))
}

// The concentration and geography scores are Herfindahl indices x 100. Its
// inverse is the number of equally sized positions that would give the same
// concentration - far easier to grasp than the index itself.
export function effectiveCount(herfindahlScore: number): number | null {
  return herfindahlScore > 0 ? 100 / herfindahlScore : null
}

export interface DayChange {
  date: string
  change: number
}

export interface SwingSummary {
  monthlySwingPct: number
  monthlySwingValue: number
  worstDay: DayChange
  bestDay: DayChange
}

export function summariseSwings(series: PerformancePoint[]): SwingSummary | null {
  const changes = series
    .slice(1)
    .map((point, i) => ({ date: point.date, change: point.value - series[i].value, pct: point.value / series[i].value - 1 }))
    .filter((c) => Number.isFinite(c.pct))
  if (changes.length < 2) return null

  const mean = changes.reduce((sum, c) => sum + c.pct, 0) / changes.length
  const dailyStdDev = Math.sqrt(changes.reduce((sum, c) => sum + (c.pct - mean) ** 2, 0) / changes.length)
  // The synthetic series has one point per calendar day, so a month is ~30
  // steps. Square-root-of-time scaling assumes days move independently.
  const monthlySwingPct = dailyStdDev * Math.sqrt(30) * 100
  const latestValue = series[series.length - 1].value

  const byChange = [...changes].sort((a, b) => a.change - b.change)
  const toDay = ({ date, change }: DayChange) => ({ date, change })
  return {
    monthlySwingPct,
    monthlySwingValue: (latestValue * monthlySwingPct) / 100,
    worstDay: toDay(byChange[0]),
    bestDay: toDay(byChange[byChange.length - 1]),
  }
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(date))
}

// Scores within this many points of each other count as "about the same".
const STABLE_SCORE_RANGE = 1
// Sector shifts smaller than this (in percentage points) are not mentioned.
const MIN_SECTOR_SHIFT_PP = 1

export function describeRiskTrend(series: RiskHistory['series']): string | null {
  if (series.length < 2) return null
  const first = series[0]
  const last = series[series.length - 1]
  const since = formatShortDate(first.date)
  const change = last.risk_score - first.risk_score
  if (Math.abs(change) <= STABLE_SCORE_RANGE) return `Your risk score has stayed around ${last.risk_score} since ${since}.`
  return `Your risk score has gone ${change > 0 ? 'up' : 'down'} from ${first.risk_score} to ${last.risk_score} since ${since}.`
}

export function describeSectorShift(shift: RiskHistory['biggest_sector_shift']): string | null {
  if (!shift || Math.abs(shift.to_pct - shift.from_pct) < MIN_SECTOR_SHIFT_PP) return null
  const grew = shift.to_pct > shift.from_pct
  return `${shift.label} ${grew ? 'grew' : 'shrank'} from ${shift.from_pct.toFixed(0)}% to ${shift.to_pct.toFixed(0)}% of your portfolio, only because prices moved. You did not buy or sell anything.`
}

// The holding whose share of the swings exceeds its share of the money by
// the most, i.e. the one that "punches above its weight".
export function biggestOutsizedHolding(holdings: RiskContribution[]): RiskContribution | null {
  const outsized = holdings
    .filter((h) => h.swing_share_pct > h.value_pct)
    .sort((a, b) => b.swing_share_pct - b.value_pct - (a.swing_share_pct - a.value_pct))
  return outsized[0] ?? null
}
