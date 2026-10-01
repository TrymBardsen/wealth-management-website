// Calculations behind the report cards (src/reports/metrics.tsx). Pure
// functions so they are easy to test and explain.
import type { Investment, PerformancePoint } from '../api/types'

// Typical yearly swings (standard deviation, %) per risk profile. An
// illustrative assumption for the demo, shown under "Why am I seeing this?".
export const PROFILE_VOLATILITY: Record<string, [number, number]> = {
  Conservative: [2, 6],
  Moderate: [4, 10],
  Balanced: [8, 14],
  Growth: [12, 18],
  Aggressive: [16, 25],
}

// Yearly swings from a daily value series. The synthetic portfolio moves
// every calendar day (365 a year); the real OSEBX only on trading days,
// and its series repeats the last close on other days, so those flat days
// are skipped and 252 trading days are used instead.
export function annualVolatilityPct(series: PerformancePoint[], { tradingDaysOnly = false } = {}): number | null {
  const returns = series
    .slice(1)
    .map((p, i) => p.value / series[i].value - 1)
    .filter((r) => Number.isFinite(r) && (!tradingDaysOnly || r !== 0))
  if (returns.length < 2) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const std = Math.sqrt(returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length)
  return std * Math.sqrt(tradingDaysOnly ? 252 : 365) * 100
}

export type ProfileBand = 'below' | 'within' | 'over'

export function profileBand(volatilityPct: number, range: [number, number]): ProfileBand {
  if (volatilityPct < range[0]) return 'below'
  return volatilityPct > range[1] ? 'over' : 'within'
}

// Biggest fall from a running peak, as a negative percentage and in value.
export function maxDrawdown(series: PerformancePoint[]): { pct: number; value: number; peakDate: string; troughDate: string } | null {
  if (series.length < 2) return null
  let peak = series[0]
  let worst = { pct: 0, value: 0, peakDate: series[0].date, troughDate: series[0].date }
  for (const point of series) {
    if (point.value > peak.value) peak = point
    const pct = (point.value / peak.value - 1) * 100
    if (pct < worst.pct) worst = { pct, value: point.value - peak.value, peakDate: peak.date, troughDate: point.date }
  }
  return worst
}

// How much each asset type is assumed to fall when the stock market falls
// by 1%. Illustrative, shown under "Why am I seeing this?".
export const MARKET_SENSITIVITY: Record<string, number> = {
  Equity: 1,
  ETF: 1,
  'Mutual Fund': 0.6,
  Bond: 0.1,
  Cash: 0,
}

export function stressTest(investments: Investment[], marketFallsPct: number[]) {
  const total = investments.reduce((sum, inv) => sum + inv.quantity * inv.current_price, 0)
  return marketFallsPct.map((fall) => {
    const loss = investments.reduce(
      (sum, inv) => sum + inv.quantity * inv.current_price * (MARKET_SENSITIVITY[inv.asset_type] ?? 1) * (fall / 100),
      0,
    )
    return { fallPct: fall, loss, lossPct: total > 0 ? (loss / total) * 100 : 0 }
  })
}

export function gainsSincePurchase(investments: Investment[]) {
  return investments
    .map((inv) => {
      const value = inv.quantity * inv.current_price
      const cost = inv.quantity * inv.purchase_price
      return { name: inv.name, ticker: inv.ticker, gain: value - cost, gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 }
    })
    .sort((a, b) => b.gain - a.gain)
}

// Share of the portfolio in stocks that is typical at most per profile.
// Illustrative assumption, shown on the Risk page.
export const PROFILE_MAX_STOCK_SHARE: Record<string, number> = {
  Conservative: 25,
  Moderate: 50,
  Balanced: 65,
  Growth: 85,
  Aggressive: 100,
}
export const STOCK_ASSET_TYPES = ['Equity', 'ETF']

// Whole days between the latest price and today (UTC dates).
export function dataAgeDays(latestDate: string, today = new Date()): number {
  const latest = Date.parse(`${latestDate}T00:00:00Z`)
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.max(0, Math.round((now - latest) / 86_400_000))
}

export function worstDay(series: PerformancePoint[]): { date: string; pct: number } | null {
  let worst: { date: string; pct: number } | null = null
  for (let i = 1; i < series.length; i += 1) {
    const pct = (series[i].value / series[i - 1].value - 1) * 100
    if (Number.isFinite(pct) && (!worst || pct < worst.pct)) worst = { date: series[i].date, pct }
  }
  return worst
}

export interface SectorRisk {
  sector: string
  value_pct: number
  swing_share_pct: number
  holdings: Array<{ name: string; ticker: string; value_pct: number; swing_share_pct: number }>
}

// Holdings' shares of value and of swings, added up per sector.
export function riskBySector(
  holdings: Array<{ name: string; ticker: string; sector: string; value_pct: number; swing_share_pct: number }>,
): SectorRisk[] {
  const groups = new Map<string, SectorRisk>()
  for (const h of holdings) {
    const group = groups.get(h.sector) ?? { sector: h.sector, value_pct: 0, swing_share_pct: 0, holdings: [] }
    group.value_pct += h.value_pct
    group.swing_share_pct += h.swing_share_pct
    group.holdings.push({ name: h.name, ticker: h.ticker, value_pct: h.value_pct, swing_share_pct: h.swing_share_pct })
    groups.set(h.sector, group)
  }
  return [...groups.values()].sort((a, b) => b.swing_share_pct - a.swing_share_pct)
}
