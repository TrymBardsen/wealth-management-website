import { describe, expect, it } from 'vitest'
import { METRICS } from '../../../api/src/services/reports'
import type { Investment } from '../api/types'
import { METRIC_LIBRARY } from '../reports/metrics'
import { STANDARD_REPORTS } from '../reports/standardReports'
import { annualVolatilityPct, dataAgeDays, gainsSincePurchase, maxDrawdown, profileBand, riskBySector, stressTest, worstDay } from '../utils/reportMetrics'

const series = (values: number[]) => values.map((value, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, value }))

describe('metric ids', () => {
  it('match the list the API lets Claude choose from', () => {
    expect(METRIC_LIBRARY.map((m) => m.id).sort()).toEqual(METRICS.map((m) => m.id).sort())
  })

  it('cover every card a standard report uses', () => {
    const ids = new Set(METRIC_LIBRARY.map((m) => m.id))
    for (const report of STANDARD_REPORTS) for (const id of report.metrics) expect(ids.has(id)).toBe(true)
  })
})

describe('annualVolatilityPct', () => {
  it('is zero for a flat series and grows with bigger moves', () => {
    expect(annualVolatilityPct(series([100, 100, 100]))).toBe(0)
    const calm = annualVolatilityPct(series([100, 101, 100, 101, 100]))!
    const wild = annualVolatilityPct(series([100, 105, 100, 105, 100]))!
    expect(wild).toBeGreaterThan(calm * 4)
  })

  it('skips the repeated closes of non-trading days when asked', () => {
    const tradingOnly = annualVolatilityPct(series([100, 101, 101, 101, 100, 101]), { tradingDaysOnly: true })!
    const everyDay = annualVolatilityPct(series([100, 101, 101, 101, 100, 101]))!
    expect(tradingOnly).not.toBeCloseTo(everyDay, 1)
  })

  it('needs at least three points', () => {
    expect(annualVolatilityPct(series([100, 101]))).toBeNull()
  })
})

describe('profileBand', () => {
  it('places a value below, within or above the range', () => {
    expect(profileBand(3, [4, 10])).toBe('below')
    expect(profileBand(10, [4, 10])).toBe('within')
    expect(profileBand(11.9, [4, 10])).toBe('over')
  })
})

describe('maxDrawdown', () => {
  it('finds the biggest fall from a peak', () => {
    const result = maxDrawdown(series([100, 120, 90, 110, 95]))!
    expect(result.pct).toBeCloseTo(-25, 5)
    expect(result.value).toBe(-30)
    expect(result.peakDate).toBe('2026-06-02')
    expect(result.troughDate).toBe('2026-06-03')
  })

  it('is zero when the value never falls', () => {
    expect(maxDrawdown(series([100, 110, 120]))!.pct).toBe(0)
  })
})

const holding = (asset_type: string, value: number, purchase = value): Investment =>
  ({ asset_type, quantity: 1, current_price: value, purchase_price: purchase, name: asset_type, ticker: asset_type }) as Investment

describe('stressTest', () => {
  it('applies each asset type\'s sensitivity to the market fall', () => {
    const [row] = stressTest([holding('Equity', 1000), holding('Bond', 1000), holding('Cash', 1000)], [20])
    // 20% of the shares, 2% of the bonds, nothing on cash
    expect(row.loss).toBeCloseTo(220, 5)
    expect(row.lossPct).toBeCloseTo((220 / 3000) * 100, 5)
  })
})

describe('gainsSincePurchase', () => {
  it('sorts holdings from biggest gain to biggest loss', () => {
    const rows = gainsSincePurchase([holding('Bond', 90, 100), holding('Equity', 150, 100)])
    expect(rows.map((r) => r.gain)).toEqual([50, -10])
    expect(rows[1].gainPct).toBeCloseTo(-10, 5)
  })
})

describe('Risk page helpers', () => {
  it('counts whole days since the latest price', () => {
    expect(dataAgeDays('2026-09-06', new Date('2026-10-01T15:00:00Z'))).toBe(25)
    expect(dataAgeDays('2026-10-01', new Date('2026-10-01T23:00:00Z'))).toBe(0)
  })

  it('finds the worst single day in percent', () => {
    expect(worstDay(series([100, 102, 99.96, 101]))).toEqual({ date: '2026-06-03', pct: expect.closeTo(-2, 5) })
    expect(worstDay(series([100]))).toBeNull()
  })

  it('adds up value and swing shares per sector, biggest risk first', () => {
    const h = (name: string, sector: string, value_pct: number, swing_share_pct: number) => ({ name, ticker: name, sector, value_pct, swing_share_pct })
    const sectors = riskBySector([h('A', 'Technology', 30, 50), h('B', 'Diversified', 60, 30), h('C', 'Technology', 10, 20)])
    expect(sectors.map((s) => s.sector)).toEqual(['Technology', 'Diversified'])
    expect(sectors[0]).toMatchObject({ value_pct: 40, swing_share_pct: 70 })
    expect(sectors[0].holdings.map((x) => x.name)).toEqual(['A', 'C'])
  })
})
