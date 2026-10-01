import { describe, expect, it } from 'vitest'
import type { PerformanceSummary } from '../api/types'
import { PERIODS, isPeriodAvailable, longestAvailablePeriod, periodStart, sliceToPeriod } from '../utils/performance'

const period = (id: string) => PERIODS.find((p) => p.id === id)!

describe('periodStart', () => {
  it('counts whole months back from the end date', () => {
    expect(periodStart(period('1M'), '2026-09-06')).toBe('2026-08-06')
    expect(periodStart(period('1Y'), '2026-09-06')).toBe('2025-09-06')
  })

  it('starts YTD on 1 January of the end year', () => {
    expect(periodStart(period('YTD'), '2026-09-06')).toBe('2026-01-01')
  })

  it('has no start date for all time', () => {
    expect(periodStart(period('ALL'), '2026-09-06')).toBeNull()
  })
})

describe('isPeriodAvailable', () => {
  const dates = ['2026-06-09', '2026-09-06']

  it('accepts periods the history covers, with a few days of slack', () => {
    expect(isPeriodAvailable(period('1M'), dates)).toBe(true)
    expect(isPeriodAvailable(period('3M'), dates)).toBe(true)
  })

  it('rejects periods that reach further back than the history', () => {
    expect(isPeriodAvailable(period('YTD'), dates)).toBe(false)
    expect(isPeriodAvailable(period('1Y'), dates)).toBe(false)
  })

  it('always offers all time when there is any history', () => {
    expect(isPeriodAvailable(period('ALL'), dates)).toBe(true)
    expect(isPeriodAvailable(period('ALL'), ['2026-09-06'])).toBe(false)
  })

  it('picks the longest available period as default', () => {
    expect(longestAvailablePeriod(dates)?.id).toBe('3M')
    expect(longestAvailablePeriod(['2026-09-06'])).toBeNull()
  })
})

describe('sliceToPeriod', () => {
  const performance: PerformanceSummary = {
    customer_id: 'CUST-1',
    series: [
      { date: '2026-07-01', value: 100 },
      { date: '2026-08-10', value: 110 },
      { date: '2026-09-06', value: 121 },
    ],
    period_return_pct: 21,
    start_value: 100,
    end_value: 121,
    benchmark: {
      ticker: 'OSEBX',
      name: 'Index',
      source: 'test',
      fetched_at: '2026-10-01',
      series: [
        { date: '2026-07-01', value: 100 },
        { date: '2026-08-10', value: 100 },
        { date: '2026-09-06', value: 105 },
      ],
      period_return_pct: 5,
      disclaimer: '',
    },
  }

  it('keeps only points inside the period and recalculates returns', () => {
    const view = sliceToPeriod(performance, period('1M'))
    expect(view.points.map((p) => p.date)).toEqual(['2026-08-10', '2026-09-06'])
    expect(view.portfolioReturnPct).toBe(10)
    expect(view.benchmarkReturnPct).toBe(5)
  })

  it('rebases the benchmark to the portfolio value at the period start', () => {
    const view = sliceToPeriod(performance, period('1M'))
    expect(view.points[0].benchmark).toBe(110)
    expect(view.points[1].benchmark).toBeCloseTo(115.5, 2)
  })

  it('keeps the whole series without a period or for all time', () => {
    expect(sliceToPeriod(performance, null).points).toHaveLength(3)
    const allTime = sliceToPeriod(performance, period('ALL'))
    expect(allTime.points).toHaveLength(3)
    expect(allTime.portfolioReturnPct).toBe(21)
  })
})
