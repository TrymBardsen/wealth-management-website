import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerContext } from '../context/CustomerContext'
import {
  fetchImprovements,
  fetchInsights,
  fetchInvestments,
  fetchPerformance,
  fetchPortfolio,
  fetchRisk,
  fetchRiskContributions,
  fetchRiskHistory,
} from '../api/client'
import type {
  ImprovementsSummary,
  Insight,
  Investment,
  PerformanceSummary,
  PortfolioSummary,
  RiskContributions,
  RiskHistory,
  RiskSummary,
} from '../api/types'
import ImprovementIdeas from '../components/ImprovementIdeas'
import InsightCard from '../components/InsightCard'
import { KeyRiskFacts, SectorRiskBars, SwingCard } from '../components/RiskOverview'
import { BarList, HoldingsTreemap, RiskHistoryChart, RiskScale, StackedBar } from '../components/RiskVisuals'
import { formatCurrency } from '../utils/format'
import { PROFILE_VOLATILITY, annualVolatilityPct, dataAgeDays } from '../utils/reportMetrics'
import {
  EXPECTED_CATEGORY,
  RISK_FACTORS,
  RISK_INSIGHT_IDS,
  VOLATILE_ASSET_TYPES,
  assetTypeColor,
  biggestOutsizedHolding,
  describeRiskTrend,
  describeSectorShift,
  effectiveCount,
  scoreContributions,
  sortByCalmness,
  summariseSwings,
} from '../utils/risk'

const STRESS_DROP_PCT = 30
// Warn when the latest prices are older than this.
const STALE_AFTER_DAYS = 3
const COPILOT_QUESTION = 'What are the largest risks in my portfolio?'


function formatDay(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(date))
}

function alignmentSentence(risk: RiskSummary) {
  const profile = `“${risk.customer_risk_profile}”`
  if (risk.risk_profile_alignment === 'Aligned') return `That fits your ${profile} risk profile.`
  if (risk.risk_profile_alignment === 'More aggressive than profile') {
    return `That is higher than what is typical for your ${profile} risk profile.`
  }
  return `That is lower than what is typical for your ${profile} risk profile.`
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
}

function FactorCard({ factorKey, title, children }: { factorKey: string; title: string; children: React.ReactNode }) {
  const color = RISK_FACTORS.find((f) => f.key === factorKey)?.color
  return (
    <section className="factor-card" style={{ borderTopColor: color }}>
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default function Risk() {
  const { selectedCustomerId, selectedCustomer } = useCustomerContext()
  const navigate = useNavigate()
  const [risk, setRisk] = useState<RiskSummary | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [improvements, setImprovements] = useState<ImprovementsSummary | null>(null)
  const [history, setHistory] = useState<RiskHistory | null>(null)
  const [holdingContributions, setHoldingContributions] = useState<RiskContributions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCustomerId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRisk(selectedCustomerId),
      fetchPortfolio(selectedCustomerId),
      fetchInvestments(selectedCustomerId),
      fetchPerformance(selectedCustomerId),
      fetchInsights(selectedCustomerId),
      fetchImprovements(selectedCustomerId),
      fetchRiskHistory(selectedCustomerId),
      fetchRiskContributions(selectedCustomerId),
    ])
      .then(([riskRes, portfolioRes, investmentsRes, performanceRes, insightsRes, improvementsRes, historyRes, contributionsRes]) => {
        if (cancelled) return
        setRisk(riskRes)
        setPortfolio(portfolioRes)
        setInvestments(investmentsRes.investments)
        setPerformance(performanceRes)
        setInsights(insightsRes.insights.filter((insight) => RISK_INSIGHT_IDS.includes(insight.id)))
        setImprovements(improvementsRes)
        setHistory(historyRes)
        setHoldingContributions(contributionsRes)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedCustomerId])

  if (loading) return <p className="loading-state">Loading risk overview...</p>
  if (error) return <p className="error-state">Could not load risk data: {error}</p>
  if (!risk || !portfolio || !performance) return null

  const heading = (
    <div className="risk-heading">
      <div className="page-heading">
        <p className="eyebrow">Risk and insight</p>
        <h2>Where does your risk come from?</h2>
        <p className="risk-heading__lead">
          {selectedCustomer ? `${selectedCustomer.first_name}, here` : 'Here'} you can see how much your portfolio can
          swing, which investments account for the swings, and whether that fits your risk profile.
        </p>
      </div>
      <button
        type="button"
        className="risk-heading__ask"
        onClick={() => navigate('/copilot', { state: { question: COPILOT_QUESTION } })}
      >
        Ask Copilot about your risk
      </button>
    </div>
  )

  if (portfolio.total_value <= 0) {
    return (
      <div className="page">
        {heading}
        <p className="empty-state">You have no investments yet, so there is no investment risk to show.</p>
      </div>
    )
  }

  const expected = EXPECTED_CATEGORY[risk.customer_risk_profile] ?? 'Medium'
  const contributions = scoreContributions(risk.factors)
  const biggestDriver = [...contributions].sort((a, b) => b.points - a.points)[0]

  const assetMix = sortByCalmness(portfolio.allocation_by_asset_type)
  const volatileShare = assetMix
    .filter((s) => VOLATILE_ASSET_TYPES.includes(s.label))
    .reduce((sum, s) => sum + s.percentage, 0)

  const effectiveHoldings = effectiveCount(risk.factors.concentration_score)
  const holdingsBySize = [...investments].sort(
    (a, b) => b.quantity * b.current_price - a.quantity * a.current_price,
  )
  const largest = holdingsBySize[0]
  const largestValue = largest ? largest.quantity * largest.current_price : 0
  const topThreeShare = holdingsBySize
    .slice(0, 3)
    .reduce((sum, inv) => sum + (inv.quantity * inv.current_price) / portfolio.total_value, 0) * 100

  const effectiveRegions = effectiveCount(risk.factors.geography_score)
  const topRegion = portfolio.allocation_by_geography[0]
  const hasGlobalFunds = portfolio.allocation_by_geography.some((s) => s.label === 'Global')

  const swings = summariseSwings(performance.series)
  const volatility = annualVolatilityPct(performance.series)
  const profileRange = PROFILE_VOLATILITY[risk.customer_risk_profile] ?? PROFILE_VOLATILITY.Balanced
  const latestPriceDate = performance.series[performance.series.length - 1]?.date
  const ageDays = latestPriceDate ? dataAgeDays(latestPriceDate) : 0
  const riskTrend = history ? describeRiskTrend(history.series) : null
  const sectorShift = history ? describeSectorShift(history.biggest_sector_shift) : null
  const outsized = holdingContributions ? biggestOutsizedHolding(holdingContributions.holdings) : null

  return (
    <div className="page">
      {heading}

      {latestPriceDate && ageDays > STALE_AFTER_DAYS && (
        <p className="stale-banner" role="status">
          <span aria-hidden="true">⚠</span> The latest prices are from {formatShortDate(latestPriceDate)} ({ageDays} days
          old). Your actual risk may have changed since.
        </p>
      )}

      <div className="risk-hero">
        {volatility !== null ? (
          <SwingCard
            volatility={volatility}
            totalValue={portfolio.total_value}
            range={profileRange}
            profile={risk.customer_risk_profile}
          />
        ) : (
          <section className="swing-card"><p className="empty-state">Not enough price history to measure the swings.</p></section>
        )}
        {holdingContributions && (
          <KeyRiskFacts
            holdings={holdingContributions.holdings}
            assetMix={portfolio.allocation_by_asset_type}
            performance={performance}
            profile={risk.customer_risk_profile}
          />
        )}
      </div>

      <section className="risk-insights">
        <div className="risk-insights__heading">
          <div>
            <p className="eyebrow">Insight</p>
            <h3>What you should know about your finances</h3>
          </div>
          <span className="risk-insights__chip">Rule-based from your data</span>
        </div>
        {insights.length > 0 ? (
          <div className="insight-grid">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <p className="empty-state">Nothing to flag right now: your portfolio is not heavily concentrated and fits your profile.</p>
        )}
      </section>

      {history && riskTrend && (
        <section className="panel">
          <h3>How your risk has changed</h3>
          <p className="panel__lead">
            {riskTrend} {sectorShift}
          </p>
          <RiskHistoryChart series={history.series} expected={expected} />
          <p className="factor-card__note">{history.note}</p>
        </section>
      )}

      {holdingContributions && holdingContributions.holdings.length > 0 && (
        <section className="panel">
          <h3>Which investments drive the swings</h3>
          <p className="panel__lead">
            {outsized ? (
              <>
                <strong>{outsized.name}</strong> is {outsized.value_pct.toFixed(0)}% of your money, but{' '}
                <strong>{outsized.swing_share_pct.toFixed(0)}%</strong> of the swings.{' '}
              </>
            ) : (
              'Your investments contribute to the swings roughly in line with their size. '
            )}
            Click a sector to see the investments behind it.
          </p>
          <SectorRiskBars holdings={holdingContributions.holdings} />
          <p className="factor-card__note">{holdingContributions.method}</p>
        </section>
      )}

      <section className="panel">
        <h3>What makes up your score</h3>
        <p className="panel__lead">
          Your risk score is <strong>{risk.risk_score} of 100</strong> ({risk.risk_category.toLowerCase()}).{' '}
          {alignmentSentence(risk)} The score adds up four things; the biggest driver for you is{' '}
          <strong>{biggestDriver.label.toLowerCase()}</strong>.
        </p>
        <RiskScale score={risk.risk_score} expected={expected} profile={risk.customer_risk_profile} />
        <StackedBar
          segments={contributions.map((c) => ({
            label: c.label,
            value: c.points,
            color: c.color,
            detail: `${Math.round(c.points)} pts`,
          }))}
        />
      </section>

      <div className="factor-grid">
        <FactorCard factorKey="asset_allocation_score" title="What you own">
          <p className="factor-card__headline">{volatileShare.toFixed(0)}%</p>
          <p>
            of your money is in shares, ETFs and funds, the parts that tend to move the most.{' '}
            {volatileShare >= 99.5
              ? 'You have no bonds or cash to steady it.'
              : 'The rest is in bonds and cash, which move the least.'}
          </p>
          <StackedBar
            segments={assetMix.map((s) => ({
              label: s.label,
              value: s.percentage,
              color: assetTypeColor(s.label),
              detail: `${s.percentage.toFixed(0)}%`,
            }))}
          />
          <p className="factor-card__note">Ordered from calm (left) to volatile (right).</p>
        </FactorCard>

        <FactorCard factorKey="concentration_score" title="How big your bets are">
          <p className="factor-card__headline">≈ {effectiveHoldings?.toFixed(0) ?? '–'}</p>
          <p>
            You own {investments.length} investments, but your portfolio behaves as if you owned about{' '}
            {effectiveHoldings?.toFixed(0)} equally sized ones. Your three largest make up {topThreeShare.toFixed(0)}%.
          </p>
          <HoldingsTreemap investments={investments} />
          {largest && (
            <p className="factor-card__note">
              If {largest.name} fell {STRESS_DROP_PCT}%, your portfolio would lose about{' '}
              <strong>{formatCurrency((largestValue * STRESS_DROP_PCT) / 100)}</strong>. This is an example, not a
              forecast.
            </p>
          )}
        </FactorCard>

        <FactorCard factorKey="geography_score" title="Where in the world">
          <p className="factor-card__headline">≈ {effectiveRegions ? Number(effectiveRegions.toFixed(1)) : '–'} regions</p>
          <p>
            In practice your money is spread across about {effectiveRegions ? Number(effectiveRegions.toFixed(1)) : '–'} regions.
            {topRegion && ` The largest is ${topRegion.label} at ${topRegion.percentage.toFixed(0)}%.`}
          </p>
          <BarList items={portfolio.allocation_by_geography.slice(0, 6)} />
          {hasGlobalFunds && (
            <p className="factor-card__note">
              “Global” funds count as one region here, even though they invest in many countries.
            </p>
          )}
        </FactorCard>

        <FactorCard factorKey="volatility_score" title="How much it moves">
          {swings ? (
            <>
              <p className="factor-card__headline">± {formatCurrency(swings.monthlySwingValue)}</p>
              <p>
                In a normal month, your portfolio can move up or down by around{' '}
                {formatCurrency(swings.monthlySwingValue)} (±{swings.monthlySwingPct.toFixed(1)}%). Bigger moves can
                happen.
              </p>
              <dl className="day-extremes">
                <div>
                  <dt>Worst day</dt>
                  <dd className="negative">{formatCurrency(swings.worstDay.change)}</dd>
                  <dd>{formatDay(swings.worstDay.date)}</dd>
                </div>
                <div>
                  <dt>Best day</dt>
                  <dd className="positive">+{formatCurrency(swings.bestDay.change)}</dd>
                  <dd>{formatDay(swings.bestDay.date)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="empty-state">Not enough price history to show how much your portfolio moves.</p>
          )}
        </FactorCard>
      </div>

      {improvements && <ImprovementIdeas summary={improvements} />}

      <p className="disclaimer">
        Based on today’s holdings and about 90 days of synthetic prices. {risk.disclaimer}
      </p>
    </div>
  )
}
