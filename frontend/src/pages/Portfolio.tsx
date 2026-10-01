import { useEffect, useRef, useState } from 'react'
import { useCustomerContext } from '../context/CustomerContext'
import { fetchInvestments, fetchPerformance, fetchPortfolio } from '../api/client'
import type { Investment, PerformanceSummary, PortfolioSummary } from '../api/types'
import AllocationPieChart from '../components/AllocationPieChart'
import PerformanceChart from '../components/PerformanceChart'
import { formatCurrency } from '../utils/format'

type AllocationDimension = 'asset_type' | 'geography' | 'sector'

const DIMENSION_LABELS: Record<AllocationDimension, string> = {
  asset_type: 'asset type',
  geography: 'geography',
  sector: 'sector',
}

interface AllocationSelection {
  dimension: AllocationDimension
  label: string
}

function HoldingsInSlice({
  selection,
  investments,
  totalValue,
  onClose,
}: {
  selection: AllocationSelection
  investments: Investment[]
  totalValue: number
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selection])

  const holdings = investments
    .filter((inv) => inv[selection.dimension] === selection.label)
    .map((inv) => {
      const value = inv.quantity * inv.current_price
      const cost = inv.quantity * inv.purchase_price
      return { ...inv, value, gain: value - cost, gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 }
    })
    .sort((a, b) => b.value - a.value)
  const sliceValue = holdings.reduce((sum, h) => sum + h.value, 0)

  return (
    <section className="panel slice-holdings" ref={ref} aria-live="polite">
      <div className="slice-holdings__header">
        <div>
          <p className="eyebrow">By {DIMENSION_LABELS[selection.dimension]}</p>
          <h3>
            {selection.label} · {formatCurrency(sliceValue)}
          </h3>
        </div>
        <button type="button" className="slice-holdings__close" onClick={onClose}>
          Close
        </button>
      </div>
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Sector</th>
            <th>Geography</th>
            <th>Value</th>
            <th>Weight</th>
            <th>Unrealized gain/loss</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.investment_id}>
              <td>
                <div className="holdings-table__name">{h.name}</div>
                <div className="holdings-table__ticker">{h.ticker}</div>
              </td>
              <td>{h.asset_type}</td>
              <td>{h.sector}</td>
              <td>{h.geography}</td>
              <td>{formatCurrency(h.value)}</td>
              <td>{totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(1) : 0}%</td>
              <td className={h.gain >= 0 ? 'positive' : 'negative'}>
                {h.gain >= 0 ? '+' : ''}
                {formatCurrency(h.gain)} ({h.gainPct.toFixed(1)}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function Portfolio() {
  const { selectedCustomerId } = useCustomerContext()
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [selection, setSelection] = useState<AllocationSelection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCustomerId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelection(null)
    Promise.all([
      fetchPortfolio(selectedCustomerId),
      fetchPerformance(selectedCustomerId),
      fetchInvestments(selectedCustomerId),
    ])
      .then(([portfolioRes, performanceRes, investmentsRes]) => {
        if (cancelled) return
        setPortfolio(portfolioRes)
        setPerformance(performanceRes)
        setInvestments(investmentsRes.investments)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedCustomerId])

  if (loading) return <p className="loading-state">Loading portfolio...</p>
  if (error) return <p className="error-state">Could not load portfolio data: {error}</p>
  if (!portfolio || !performance) return null

  const selectFor = (dimension: AllocationDimension) => (label: string | null) =>
    setSelection(label ? { dimension, label } : null)
  const selectedIn = (dimension: AllocationDimension) => (selection?.dimension === dimension ? selection.label : null)

  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">Your investments</p>
        <h2>Portfolio</h2>
      </div>

      <section className="panel">
        <h3>Performance</h3>
        <PerformanceChart performance={performance} />
      </section>

      <div className="chart-grid">
        <AllocationPieChart
          data={portfolio.allocation_by_asset_type}
          title="Allocation by asset type"
          selected={selectedIn('asset_type')}
          onSelect={selectFor('asset_type')}
        />
        <AllocationPieChart
          data={portfolio.allocation_by_geography}
          title="Allocation by geography"
          selected={selectedIn('geography')}
          onSelect={selectFor('geography')}
        />
        <AllocationPieChart
          data={portfolio.allocation_by_sector}
          title="Allocation by sector"
          selected={selectedIn('sector')}
          onSelect={selectFor('sector')}
        />
      </div>
      {selection ? (
        <HoldingsInSlice
          selection={selection}
          investments={investments}
          totalValue={portfolio.total_value}
          onClose={() => setSelection(null)}
        />
      ) : (
        portfolio.holding_count > 0 && (
          <p className="chart-hint">Click a slice or a label to see which holdings are in it.</p>
        )
      )}

      <section className="panel">
        <h3>Largest holdings</h3>
        {portfolio.largest_holdings.length === 0 ? (
          <p className="empty-state">No holdings to display.</p>
        ) : (
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Weight</th>
                <th>Unrealized gain/loss</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.largest_holdings.map((holding) => (
                <tr key={holding.investment_id}>
                  <td>
                    <div className="holdings-table__name">{holding.name}</div>
                    <div className="holdings-table__ticker">{holding.ticker}</div>
                  </td>
                  <td>{holding.asset_type}</td>
                  <td>{formatCurrency(holding.market_value)}</td>
                  <td>{holding.weight_pct}%</td>
                  <td className={holding.unrealized_gain_loss >= 0 ? 'positive' : 'negative'}>
                    {holding.unrealized_gain_loss >= 0 ? '+' : ''}
                    {formatCurrency(holding.unrealized_gain_loss)} ({holding.unrealized_gain_loss_pct}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel panel--muted">
        <h3>Portfolio summary</h3>
        <p>Total value: {formatCurrency(portfolio.total_value)}</p>
        <p>Cash: {formatCurrency(portfolio.cash_value)} ({portfolio.cash_percentage}%)</p>
        <p>
          Unrealized gain/loss: {formatCurrency(portfolio.unrealized_gain_loss)} ({portfolio.unrealized_gain_loss_pct}%)
        </p>
      </section>
    </div>
  )
}
