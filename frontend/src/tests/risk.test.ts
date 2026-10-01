import { describe, expect, it } from 'vitest'
import type { RiskContribution } from '../api/types'
import {
  biggestOutsizedHolding,
  describeRiskTrend,
  describeSectorShift,
  effectiveCount,
  scoreContributions,
  sortByCalmness,
  summariseSwings,
} from '../utils/risk'

describe('scoreContributions', () => {
  it('weights each factor so the points add up to the risk score', () => {
    const points = scoreContributions({
      asset_allocation_score: 58.6,
      concentration_score: 32.5,
      geography_score: 51.9,
      volatility_score: 30.7,
    }).map((c) => c.points)
    expect(points.reduce((a, b) => a + b, 0)).toBeCloseTo(45.49, 2)
  })
})

describe('effectiveCount', () => {
  it('turns a Herfindahl score into an equivalent number of equal positions', () => {
    expect(effectiveCount(100)).toBe(1)
    expect(effectiveCount(25)).toBe(4)
  })

  it('returns null when there is nothing to measure', () => {
    expect(effectiveCount(0)).toBeNull()
  })
})

describe('sortByCalmness', () => {
  it('orders asset types from calm to volatile and puts unknown types last', () => {
    const sorted = sortByCalmness([
      { label: 'Equity', value: 1, percentage: 1 },
      { label: 'Crypto', value: 1, percentage: 1 },
      { label: 'Cash', value: 1, percentage: 1 },
      { label: 'ETF', value: 1, percentage: 1 },
    ])
    expect(sorted.map((s) => s.label)).toEqual(['Cash', 'ETF', 'Equity', 'Crypto'])
  })
})

describe('summariseSwings', () => {
  it('finds the worst and best day in NOK', () => {
    const swings = summariseSwings([
      { date: '2026-06-01', value: 1000 },
      { date: '2026-06-02', value: 1010 },
      { date: '2026-06-03', value: 980 },
      { date: '2026-06-04', value: 1000 },
    ])
    expect(swings?.worstDay).toEqual({ date: '2026-06-03', change: -30 })
    expect(swings?.bestDay).toEqual({ date: '2026-06-04', change: 20 })
    expect(swings?.monthlySwingValue).toBeGreaterThan(0)
  })

  it('returns null without enough history', () => {
    expect(summariseSwings([{ date: '2026-06-01', value: 1000 }])).toBeNull()
  })

  it('reports no swing for a flat series', () => {
    const flat = summariseSwings([
      { date: '2026-06-01', value: 1000 },
      { date: '2026-06-02', value: 1000 },
      { date: '2026-06-03', value: 1000 },
    ])
    expect(flat?.monthlySwingValue).toBe(0)
  })
})

describe('describeRiskTrend', () => {
  const point = (date: string, risk_score: number) => ({ date, risk_score, risk_category: 'Medium' as const })

  it('describes a rising score', () => {
    expect(describeRiskTrend([point('2026-06-09', 38), point('2026-09-06', 45)])).toBe(
      'Your risk score has gone up from 38 to 45 since 9 June.',
    )
  })

  it('treats a one-point change as stable', () => {
    expect(describeRiskTrend([point('2026-06-09', 44), point('2026-09-06', 45)])).toBe(
      'Your risk score has stayed around 45 since 9 June.',
    )
  })

  it('needs at least two points', () => {
    expect(describeRiskTrend([point('2026-06-09', 44)])).toBeNull()
  })
})

describe('describeSectorShift', () => {
  it('explains a sector that grew because of prices', () => {
    expect(describeSectorShift({ label: 'Technology', from_pct: 30.2, to_pct: 41.4 })).toMatch(
      /^Technology grew from 30% to 41% of your portfolio, only because prices moved/,
    )
  })

  it('skips shifts below one percentage point', () => {
    expect(describeSectorShift({ label: 'Technology', from_pct: 30.2, to_pct: 30.9 })).toBeNull()
    expect(describeSectorShift(null)).toBeNull()
  })
})

describe('biggestOutsizedHolding', () => {
  const holding = (name: string, value_pct: number, swing_share_pct: number) =>
    ({ name, value_pct, swing_share_pct }) as RiskContribution

  it('picks the holding whose share of swings most exceeds its share of money', () => {
    const result = biggestOutsizedHolding([holding('Fund', 46, 16), holding('Tech', 25, 49), holding('Small', 8, 16)])
    expect(result?.name).toBe('Tech')
  })

  it('returns null when nothing punches above its weight', () => {
    expect(biggestOutsizedHolding([holding('A', 50, 50), holding('B', 50, 50)])).toBeNull()
  })
})
