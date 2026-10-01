// Illustrative, deterministic "risk score" for the workshop demo.
//
// IMPORTANT: This is a simplified EDUCATIONAL model built purely to make
// the Wealth Copilot demo feel realistic. It is NOT a real investment
// suitability or risk assessment methodology, has not been validated by
// any risk/compliance function, and must never be used for actual
// financial advice.
import { getInvestmentsFor, getMarketDataFor, getCustomer } from '../data.js'

const ASSET_TYPE_RISK_WEIGHT: Record<string, number> = {
  Cash: 2,
  Bond: 20,
  'Mutual Fund': 45,
  ETF: 55,
  Equity: 80,
}

function herfindahlIndex(percentages: number[]): number {
  // Sum of squared weights (0-1 scale). 1.0 = fully concentrated in one
  // bucket, close to 0 = very spread out.
  return percentages.reduce((sum, pct) => sum + (pct / 100) ** 2, 0)
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export type RiskCategory = 'Low' | 'Medium' | 'High'
export type RiskAlignment = 'Aligned' | 'More conservative than profile' | 'More aggressive than profile'

export interface RiskFactors {
  asset_allocation_score: number
  concentration_score: number
  geography_score: number
  volatility_score: number
}

export interface RiskSummary {
  customer_id: string
  risk_score: number
  risk_category: RiskCategory
  factors: RiskFactors
  customer_risk_profile: string
  risk_profile_alignment: RiskAlignment
  disclaimer: string
}

// Minimal description of a position the risk model needs. Real holdings
// are converted to this shape, and the improvements service builds
// hypothetical portfolios from it to run "what if" simulations.
export interface RiskPosition {
  value: number
  asset_type: string
  geography: string
  // Standard deviation of daily returns, in percent.
  daily_return_std: number
  // A broad fund spread over many underlying holdings and regions. It still
  // counts for asset mix and volatility, but adds (almost) nothing to the
  // concentration and geography scores. Only set for the generic positions
  // in what-if simulations; real holdings are scored as single positions.
  diversified?: boolean
}

export interface RiskScore {
  risk_score: number
  risk_category: RiskCategory
  factors: RiskFactors
}

// Same rounding as calculatePortfolio's allocation percentages, so the
// score is identical whichever way the positions were built.
function allocationPercentages(positions: RiskPosition[], key: 'asset_type' | 'geography', total: number) {
  const totals = new Map<string, number>()
  for (const p of positions) {
    if (key === 'geography' && p.diversified) continue
    totals.set(p[key], (totals.get(p[key]) ?? 0) + p.value)
  }
  return [...totals.entries()].map(([label, value]) => ({
    label,
    percentage: total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0,
  }))
}

export function scorePositions(positions: RiskPosition[]): RiskScore {
  const total = positions.reduce((sum, p) => sum + p.value, 0)
  const roundedTotal = Number(total.toFixed(2))

  // 1) Asset allocation score: weighted average of each asset type's
  // illustrative risk weight.
  const assetAllocationScore = roundedTotal > 0
    ? allocationPercentages(positions, 'asset_type', total).reduce((sum, slice) => {
      const weight = ASSET_TYPE_RISK_WEIGHT[slice.label] ?? 50
      return sum + (slice.percentage / 100) * weight
    }, 0)
    : 0

  // 2) Concentration score: Herfindahl index across individual holdings,
  // scaled to 0-100. A single holding with 100% weight scores 100.
  const holdingWeights = positions
    .filter((p) => !p.diversified)
    .map((p) => (roundedTotal > 0 ? (p.value / roundedTotal) * 100 : 0))
  const concentrationScore = Math.min(100, herfindahlIndex(holdingWeights) * 100)

  // 3) Geography score: same HHI approach applied to geographic allocation.
  const geographyScore = Math.min(
    100,
    herfindahlIndex(allocationPercentages(positions, 'geography', total).map((s) => s.percentage)) * 100,
  )

  // 4) Volatility score: weighted average of each holding's historical
  // daily-return standard deviation, scaled up to a 0-100-ish range.
  const volatilities = positions.map((p) => p.daily_return_std * (roundedTotal > 0 ? p.value / roundedTotal : 0))
  const volatilityScore = Math.min(100, volatilities.reduce((a, b) => a + b, 0) * 25)

  const riskScore = Math.round(
    assetAllocationScore * 0.4 +
    concentrationScore * 0.25 +
    geographyScore * 0.15 +
    volatilityScore * 0.2,
  )

  return {
    risk_score: Math.max(0, Math.min(100, riskScore)),
    risk_category: riskScore < 35 ? 'Low' : riskScore < 65 ? 'Medium' : 'High',
    factors: {
      asset_allocation_score: Number(assetAllocationScore.toFixed(1)),
      concentration_score: Number(concentrationScore.toFixed(1)),
      geography_score: Number(geographyScore.toFixed(1)),
      volatility_score: Number(volatilityScore.toFixed(1)),
    },
  }
}

const PROFILE_TO_EXPECTED_CATEGORY: Record<string, RiskCategory> = {
  Conservative: 'Low',
  Moderate: 'Low',
  Balanced: 'Medium',
  Growth: 'Medium',
  Aggressive: 'High',
}

export function expectedCategoryFor(riskProfile: string | undefined): RiskCategory {
  return riskProfile ? PROFILE_TO_EXPECTED_CATEGORY[riskProfile] ?? 'Medium' : 'Medium'
}

export function alignmentFor(category: RiskCategory, riskProfile: string | undefined): RiskAlignment {
  const categoryOrder = { Low: 0, Medium: 1, High: 2 }
  const expected = expectedCategoryFor(riskProfile)
  if (categoryOrder[category] > categoryOrder[expected]) return 'More aggressive than profile'
  if (categoryOrder[category] < categoryOrder[expected]) return 'More conservative than profile'
  return 'Aligned'
}

export function dailyReturnStd(ticker: string): number {
  return standardDeviation(getMarketDataFor(ticker).map((p) => p.daily_return))
}

export function positionsFor(customerId: string): RiskPosition[] {
  return getInvestmentsFor(customerId).map((h) => ({
    value: h.quantity * h.current_price,
    asset_type: h.asset_type,
    geography: h.geography,
    daily_return_std: dailyReturnStd(h.ticker),
  }))
}

export function calculateRisk(customerId: string): RiskSummary {
  const customer = getCustomer(customerId)
  const score = scorePositions(positionsFor(customerId))

  return {
    customer_id: customerId,
    ...score,
    customer_risk_profile: customer?.risk_profile ?? 'Unknown',
    risk_profile_alignment: alignmentFor(score.risk_category, customer?.risk_profile),
    disclaimer: 'Educational/demo risk model only. Not a real investment suitability assessment.',
  }
}

// ---------------------------------------------------------------------------
// Risk over time
// ---------------------------------------------------------------------------

export interface RiskHistoryPoint {
  date: string
  risk_score: number
  risk_category: RiskCategory
}

export interface SectorWeight {
  label: string
  percentage: number
}

export interface RiskHistory {
  customer_id: string
  series: RiskHistoryPoint[]
  start_sector_weights: SectorWeight[]
  end_sector_weights: SectorWeight[]
  // The sector whose share of the portfolio changed the most. "Diversified"
  // funds and cash are skipped since they are not really sectors.
  biggest_sector_shift: { label: string; from_pct: number; to_pct: number } | null
  note: string
}

function sectorWeights(values: number[], sectors: string[]): SectorWeight[] {
  const total = values.reduce((a, b) => a + b, 0)
  const totals = new Map<string, number>()
  values.forEach((value, i) => totals.set(sectors[i], (totals.get(sectors[i]) ?? 0) + value))
  return [...totals.entries()]
    .map(([label, value]) => ({ label, percentage: total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0 }))
    .sort((a, b) => b.percentage - a.percentage)
}

// Re-scores the portfolio for every day in the price history, keeping
// today's quantities fixed. The score then only moves because prices move:
// investments that rise grow into a bigger share of the portfolio, which is
// how risk can creep up without the customer buying or selling anything.
export function calculateRiskHistory(customerId: string): RiskHistory {
  const holdings = getInvestmentsFor(customerId)
  const stds = holdings.map((h) => dailyReturnStd(h.ticker))
  const sectors = holdings.map((h) => h.sector)
  const priceByTicker = new Map(
    holdings.map((h) => [h.ticker, new Map(getMarketDataFor(h.ticker).map((p) => [p.date, p.price]))]),
  )
  const dates = [...new Set([...priceByTicker.values()].flatMap((m) => [...m.keys()]))].sort()
  const lastDate = dates[dates.length - 1]

  // The latest point uses current prices so it matches /risk exactly.
  const valuesOn = (date: string) =>
    holdings.map((h) => h.quantity * (date === lastDate ? h.current_price : priceByTicker.get(h.ticker)?.get(date) ?? h.current_price))

  const series = dates.map((date) => {
    const values = valuesOn(date)
    const score = scorePositions(
      holdings.map((h, i) => ({ value: values[i], asset_type: h.asset_type, geography: h.geography, daily_return_std: stds[i] })),
    )
    return { date, risk_score: score.risk_score, risk_category: score.risk_category }
  })

  const start = dates.length > 0 ? sectorWeights(valuesOn(dates[0]), sectors) : []
  const end = dates.length > 0 ? sectorWeights(valuesOn(lastDate), sectors) : []
  const shift = end
    .filter((e) => e.label !== 'Diversified' && e.label !== 'Cash')
    .map((e) => ({ label: e.label, from_pct: start.find((s) => s.label === e.label)?.percentage ?? 0, to_pct: e.percentage }))
    .sort((a, b) => Math.abs(b.to_pct - b.from_pct) - Math.abs(a.to_pct - a.from_pct))[0]

  return {
    customer_id: customerId,
    series,
    start_sector_weights: start,
    end_sector_weights: end,
    biggest_sector_shift: shift ?? null,
    note: 'Holdings are kept as they are today; the score only changes because prices move.',
  }
}

// ---------------------------------------------------------------------------
// Risk contribution per holding
// ---------------------------------------------------------------------------

export interface RiskContribution {
  investment_id: string
  ticker: string
  name: string
  asset_type: string
  sector: string
  value_pct: number
  daily_volatility_pct: number
  swing_share_pct: number
}

// Each holding's share of the portfolio's swings, measured the same way as
// the volatility factor: value weight x the holding's own daily volatility.
// This ignores how holdings move together, which keeps it easy to explain.
export function calculateRiskContributions(customerId: string): { customer_id: string; holdings: RiskContribution[]; method: string } {
  const holdings = getInvestmentsFor(customerId)
  const values = holdings.map((h) => h.quantity * h.current_price)
  const total = values.reduce((a, b) => a + b, 0)
  const stds = holdings.map((h) => dailyReturnStd(h.ticker))
  const swings = values.map((v, i) => (total > 0 ? (v / total) * stds[i] : 0))
  const totalSwing = swings.reduce((a, b) => a + b, 0)

  return {
    customer_id: customerId,
    holdings: holdings
      .map((h, i) => ({
        investment_id: h.investment_id,
        ticker: h.ticker,
        name: h.name,
        asset_type: h.asset_type,
        sector: h.sector,
        value_pct: total > 0 ? Number(((values[i] / total) * 100).toFixed(2)) : 0,
        daily_volatility_pct: Number(stds[i].toFixed(2)),
        swing_share_pct: totalSwing > 0 ? Number(((swings[i] / totalSwing) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.swing_share_pct - a.swing_share_pct),
    method: 'Share of swings = share of value x the holding\'s own daily volatility, scaled to 100%. It ignores how holdings move together.',
  }
}
