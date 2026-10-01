// The library of report cards. Standard reports are fixed lists of these
// ids; AI reports get the ids Claude picks (validated by the API against
// METRICS in api/src/services/reports.ts - keep the two lists in sync).
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type {
  Customer,
  ImprovementsSummary,
  Insight,
  Investment,
  PerformanceSummary,
  PortfolioSummary,
  RiskContributions,
  RiskHistory,
  RiskSummary,
} from '../api/types'
import InsightCard from '../components/InsightCard'
import PerformanceChart from '../components/PerformanceChart'
import { BarList, HoldingsTreemap, RiskHistoryChart, RiskScale, StackedBar } from '../components/RiskVisuals'
import { formatCurrency } from '../utils/format'
import {
  PROFILE_VOLATILITY,
  annualVolatilityPct,
  gainsSincePurchase,
  maxDrawdown,
  profileBand,
  stressTest,
  type ProfileBand,
} from '../utils/reportMetrics'
import {
  EXPECTED_CATEGORY,
  assetTypeColor,
  biggestOutsizedHolding,
  describeRiskTrend,
  effectiveCount,
  scoreContributions,
  sortByCalmness,
  summariseSwings,
} from '../utils/risk'

export interface ReportData {
  customer: Customer
  portfolio: PortfolioSummary
  performance: PerformanceSummary
  risk: RiskSummary
  history: RiskHistory
  contributions: RiskContributions
  investments: Investment[]
  insights: Insight[]
  improvements: ImprovementsSummary
}

export interface MetricDefinition {
  id: string
  title: string
  description: string
  // 'period' metrics use the price history; 'today' ones are a snapshot.
  timeframe: 'period' | 'today'
  render(data: ReportData): ReactNode
  explain(data: ReportData): string | null
  why: string
}

const pct = (value: number, digits = 1) => `${value.toFixed(digits)}%`
const signed = (value: number, digits = 1) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(date))
const MARKET_FALLS = [10, 20, 30]

// --- Small visuals only used here -------------------------------------------

const BAND_LABELS: Record<ProfileBand, string> = { below: 'Below your profile', within: 'Within your profile', over: 'Above your profile' }

function ProfileFitScale({ value, benchmark, range }: { value: number; benchmark: number | null; range: [number, number] }) {
  const max = Math.ceil(Math.max(range[1] * 1.6, value + 4, (benchmark ?? 0) + 4))
  const position = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  const active = profileBand(value, range)
  const bands: Array<{ band: ProfileBand; from: number; to: number }> = [
    { band: 'below', from: 0, to: range[0] },
    { band: 'within', from: range[0], to: range[1] },
    { band: 'over', from: range[1], to: max },
  ]
  return (
    <div className="fit-scale">
      <div className="fit-scale__markers">
        <span className="fit-scale__marker fit-scale__marker--you" style={{ left: position(value) }}>
          ±{value.toFixed(1)}% a year
        </span>
      </div>
      <div className="fit-scale__track">
        {bands.map((b) => (
          <div
            key={b.band}
            className={`fit-scale__band${b.band === active ? ` fit-scale__band--active fit-scale__band--${b.band}` : ''}`}
            style={{ width: `${((b.to - b.from) / max) * 100}%` }}
          >
            <span>{BAND_LABELS[b.band]}</span>
          </div>
        ))}
      </div>
      {benchmark !== null && (
        <div className="fit-scale__markers">
          <span className="fit-scale__marker fit-scale__marker--benchmark" style={{ left: position(benchmark) }}>
            OSEBX: ±{benchmark.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}

function HoldingRiskBars({ data }: { data: ReportData }) {
  const rows = data.contributions.holdings.map((h) => ({
    name: h.name.replace(' (Fictional)', ''),
    value: h.value_pct,
    swings: h.swing_share_pct,
  }))
  return (
    <div className="holding-risk">
      <ul className="legend-list">
        <li><span className="legend-list__swatch" style={{ background: 'var(--color-primary)' }} />Share of your money</li>
        <li><span className="legend-list__swatch" style={{ background: '#ea580c' }} />Share of the swings</li>
      </ul>
      <ResponsiveContainer width="100%" height={rows.length * 58 + 20}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 0 }} barGap={3}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={(v: number) => pct(v, 0)} fontSize={12} />
          </Bar>
          <Bar dataKey="swings" fill="#ea580c" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}>
            <LabelList dataKey="swings" position="right" formatter={(v: number) => pct(v)} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GainBars({ investments }: { investments: Investment[] }) {
  const rows = gainsSincePurchase(investments)
  const max = Math.max(...rows.map((r) => Math.abs(r.gain)), 1)
  return (
    <ul className="gain-bars">
      {rows.map((r) => (
        <li key={r.ticker}>
          <span className="gain-bars__name">{r.name.replace(' (Fictional)', '')}</span>
          <span className="gain-bars__track">
            <span
              className={`gain-bars__fill ${r.gain >= 0 ? 'gain-bars__fill--up' : 'gain-bars__fill--down'}`}
              style={{ width: `${(Math.abs(r.gain) / max) * 50}%` }}
            />
          </span>
          <span className={`gain-bars__value ${r.gain >= 0 ? 'positive' : 'negative'}`}>
            {r.gain >= 0 ? '+' : ''}{formatCurrency(r.gain)} ({signed(r.gainPct)})
          </span>
        </li>
      ))}
    </ul>
  )
}

function BigFigure({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="big-figure">
      <span className="big-figure__value">{value}</span>
      <span className="big-figure__caption">{caption}</span>
    </div>
  )
}

// --- Helpers shared by several metrics ----------------------------------------

function volatilities(data: ReportData) {
  const portfolio = annualVolatilityPct(data.performance.series)
  const benchmark = data.performance.benchmark ? annualVolatilityPct(data.performance.benchmark.series, { tradingDaysOnly: true }) : null
  const range = PROFILE_VOLATILITY[data.customer.risk_profile] ?? PROFILE_VOLATILITY.Balanced
  return { portfolio, benchmark, range }
}

// --- The library ---------------------------------------------------------------

export const METRIC_LIBRARY: MetricDefinition[] = [
  {
    id: 'profile-fit',
    title: 'Do the swings fit your risk profile?',
    description: 'Your yearly swings and Oslo Børs against the typical range for your profile.',
    timeframe: 'period',
    render: (data) => {
      const { portfolio, benchmark, range } = volatilities(data)
      return portfolio === null ? <p className="empty-state">Not enough price history.</p> : <ProfileFitScale value={portfolio} benchmark={benchmark} range={range} />
    },
    explain: (data) => {
      const { portfolio, range } = volatilities(data)
      if (portfolio === null) return null
      return `For a ${data.customer.risk_profile.toLowerCase()} profile, yearly swings of ${range[0]}-${range[1]}% are typical. Your portfolio is at ±${portfolio.toFixed(1)}%.`
    },
    why: 'Yearly swings are the standard deviation of your portfolio\'s daily changes over the period, scaled to a year. The typical range per profile is a simplified assumption for this demo, not a bank policy.',
  },
  {
    id: 'risk-score',
    title: 'Your risk score',
    description: 'The 0-100 risk score against the band that fits your profile.',
    timeframe: 'today',
    render: (data) => (
      <RiskScale score={data.risk.risk_score} expected={EXPECTED_CATEGORY[data.risk.customer_risk_profile] ?? 'Medium'} profile={data.risk.customer_risk_profile} />
    ),
    explain: (data) => `Your score is ${data.risk.risk_score} out of 100 ("${data.risk.risk_category}"). ${data.risk.risk_profile_alignment === 'Aligned' ? 'That fits your profile.' : `That is ${data.risk.risk_profile_alignment.toLowerCase()}.`}`,
    why: 'The score combines four things: what you own, how big your single bets are, how spread out you are geographically, and how much your holdings have moved. It is a simplified teaching model.',
  },
  {
    id: 'score-breakdown',
    title: 'What makes up your risk score',
    description: 'How the four parts add up to the score.',
    timeframe: 'today',
    render: (data) => (
      <StackedBar
        segments={scoreContributions(data.risk.factors).map((c) => ({ label: c.label, value: c.points, color: c.color, detail: `${Math.round(c.points)} pts` }))}
      />
    ),
    explain: (data) => {
      const top = [...scoreContributions(data.risk.factors)].sort((a, b) => b.points - a.points)[0]
      return `The biggest part of your score comes from "${top.label.toLowerCase()}".`
    },
    why: 'Each part is scored 0-100 and weighted: what you own 40%, single bets 25%, regions 15% and movements 20%.',
  },
  {
    id: 'risk-per-holding',
    title: 'Risk per investment you own',
    description: 'Each holding\'s share of your money next to its share of the swings.',
    timeframe: 'period',
    render: (data) => <HoldingRiskBars data={data} />,
    explain: (data) => {
      const top = biggestOutsizedHolding(data.contributions.holdings)
      return top ? `${top.name.replace(' (Fictional)', '')} is ${pct(top.value_pct, 0)} of your money but ${pct(top.swing_share_pct, 0)} of the swings.` : 'Your holdings contribute to the swings roughly in line with their size.'
    },
    why: 'Share of the swings = each holding\'s share of the money times how much it has moved day to day, scaled to 100%. It ignores how holdings move together.',
  },
  {
    id: 'risk-over-time',
    title: 'How your risk has changed',
    description: 'The daily risk score over the period with today\'s holdings.',
    timeframe: 'period',
    render: (data) => <RiskHistoryChart series={data.history.series} expected={EXPECTED_CATEGORY[data.risk.customer_risk_profile] ?? 'Medium'} />,
    explain: (data) => describeRiskTrend(data.history.series),
    why: 'Your holdings are kept as they are today and only prices move, so the score changes when some investments grow faster than others.',
  },
  {
    id: 'asset-mix',
    title: 'What kind of investments you own',
    description: 'Shares, funds, bonds and cash, from calm to volatile.',
    timeframe: 'today',
    render: (data) => (
      <StackedBar
        segments={sortByCalmness(data.portfolio.allocation_by_asset_type).map((s) => ({ label: s.label, value: s.percentage, color: assetTypeColor(s.label), detail: pct(s.percentage, 0) }))}
      />
    ),
    explain: (data) => {
      const top = data.portfolio.allocation_by_asset_type[0]
      return top ? `The largest part, ${pct(top.percentage, 0)}, is in ${top.label.toLowerCase()}.` : null
    },
    why: 'Value per asset type today. Shares usually move the most, then funds, bonds and cash.',
  },
  {
    id: 'holdings-map',
    title: 'Where your money is, holding by holding',
    description: 'Every holding as a box sized by its value.',
    timeframe: 'today',
    render: (data) => <HoldingsTreemap investments={data.investments} />,
    explain: (data) => `${data.investments.length} holdings. Big boxes are big bets.`,
    why: 'Box size is today\'s value (quantity times price). Colour shows the asset type.',
  },
  {
    id: 'sectors',
    title: 'Which sectors you are in',
    description: 'Share of the portfolio per sector.',
    timeframe: 'today',
    render: (data) => <BarList items={data.portfolio.allocation_by_sector.slice(0, 8)} />,
    explain: (data) => {
      const top = data.portfolio.allocation_by_sector[0]
      return top ? `${top.label} is the largest at ${pct(top.percentage, 0)}.` : null
    },
    why: 'Value per sector label. Funds labelled "Diversified" invest in many sectors, but the data does not say which.',
  },
  {
    id: 'regions',
    title: 'Where in the world your money is',
    description: 'Share of the portfolio per region.',
    timeframe: 'today',
    render: (data) => <BarList items={data.portfolio.allocation_by_geography.slice(0, 8)} />,
    explain: (data) => {
      const top = data.portfolio.allocation_by_geography[0]
      return top ? `${top.label} is the largest at ${pct(top.percentage, 0)}.` : null
    },
    why: 'Value per region label. "Global" funds count as one region even though they invest in many countries.',
  },
  {
    id: 'concentration',
    title: 'How spread out you are',
    description: 'How many equally sized holdings your portfolio behaves like.',
    timeframe: 'today',
    render: (data) => {
      const n = effectiveCount(data.risk.factors.concentration_score)
      return <BigFigure value={n ? `≈ ${n.toFixed(0)}` : '–'} caption={`equally sized holdings (you own ${data.investments.length})`} />
    },
    explain: (data) => {
      const total = data.investments.reduce((sum, i) => sum + i.quantity * i.current_price, 0)
      const top3 = [...data.investments]
        .map((i) => i.quantity * i.current_price)
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((a, b) => a + b, 0)
      return total > 0 ? `Your three largest holdings make up ${pct((top3 / total) * 100, 0)} of the portfolio.` : null
    },
    why: 'Based on the Herfindahl index: the sum of each holding\'s squared share. Its inverse is the number of equal holdings that would be just as concentrated.',
  },
  {
    id: 'gains-since-purchase',
    title: 'Gain or loss since you bought',
    description: 'Unrealised gain or loss per holding.',
    timeframe: 'today',
    render: (data) => <GainBars investments={data.investments} />,
    explain: (data) => `In total ${data.portfolio.unrealized_gain_loss >= 0 ? 'up' : 'down'} ${formatCurrency(Math.abs(data.portfolio.unrealized_gain_loss))} (${signed(data.portfolio.unrealized_gain_loss_pct)}) since purchase.`,
    why: 'Today\'s value minus what you paid (quantity times purchase price). Not taxed or realised until you sell.',
  },
  {
    id: 'vs-osebx',
    title: 'Your portfolio against Oslo Børs',
    description: 'Portfolio value against OSEBX over the period.',
    timeframe: 'period',
    render: (data) => <PerformanceChart performance={data.performance} />,
    explain: (data) =>
      data.performance.benchmark
        ? `Your portfolio returned ${signed(data.performance.period_return_pct)}; Oslo Børs returned ${signed(data.performance.benchmark.period_return_pct)} over the same days.`
        : `Your portfolio returned ${signed(data.performance.period_return_pct)}.`,
    why: 'OSEBX uses real closing levels from Yahoo Finance and starts at your portfolio value. Your portfolio is synthetic demo data, so the comparison is illustrative.',
  },
  {
    id: 'drawdown',
    title: 'The biggest fall in the period',
    description: 'The largest drop from a peak, for you and Oslo Børs.',
    timeframe: 'period',
    render: (data) => {
      const you = maxDrawdown(data.performance.series)
      const osebx = data.performance.benchmark ? maxDrawdown(data.performance.benchmark.series) : null
      return (
        <dl className="day-extremes">
          <div>
            <dt>Your portfolio</dt>
            <dd className="negative">{you ? pct(you.pct) : '–'}</dd>
            <dd>{you ? `${formatCurrency(you.value)} · ${shortDate(you.peakDate)}–${shortDate(you.troughDate)}` : ''}</dd>
          </div>
          <div>
            <dt>Oslo Børs (OSEBX)</dt>
            <dd className="negative">{osebx ? pct(osebx.pct) : '–'}</dd>
            <dd>{osebx ? `${shortDate(osebx.peakDate)}–${shortDate(osebx.troughDate)}` : ''}</dd>
          </div>
        </dl>
      )
    },
    explain: () => 'A fall from a peak shows how much you could have lost if you had sold at the worst moment.',
    why: 'Largest drop from the highest value so far to a later low, within the period. Longer history would usually show bigger falls.',
  },
  {
    id: 'stress-test',
    title: 'What if the market falls?',
    description: 'What hypothetical market falls would cost in NOK.',
    timeframe: 'today',
    render: (data) => (
      <table className="stress-table">
        <thead>
          <tr><th>If the stock market falls</th><th>You could lose about</th></tr>
        </thead>
        <tbody>
          {stressTest(data.investments, MARKET_FALLS).map((row) => (
            <tr key={row.fallPct}>
              <td>{row.fallPct}%</td>
              <td className="negative">{formatCurrency(row.loss)} ({pct(row.lossPct)})</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    explain: () => 'These are made-up scenarios to show the size of the risk, not forecasts.',
    why: 'Shares and ETFs are assumed to fall as much as the market, mutual funds 60% as much, bonds 10% and cash not at all. Real falls hit holdings differently.',
  },
  {
    id: 'monthly-swing',
    title: 'How much it moves in a normal month',
    description: 'A typical monthly up-or-down move, in NOK.',
    timeframe: 'period',
    render: (data) => {
      const swings = summariseSwings(data.performance.series)
      return <BigFigure value={swings ? `± ${formatCurrency(swings.monthlySwingValue)}` : '–'} caption={swings ? `±${swings.monthlySwingPct.toFixed(1)}% in a normal month` : 'not enough history'} />
    },
    explain: () => 'Bigger moves can happen; this is a typical month, not the worst one.',
    why: 'Standard deviation of daily changes, scaled to 30 days, times today\'s value. Assumes days move independently.',
  },
  {
    id: 'best-worst-day',
    title: 'Best and worst day',
    description: 'The single best and worst day in the period, in NOK.',
    timeframe: 'period',
    render: (data) => {
      const swings = summariseSwings(data.performance.series)
      if (!swings) return <p className="empty-state">Not enough history.</p>
      return (
        <dl className="day-extremes">
          <div><dt>Worst day</dt><dd className="negative">{formatCurrency(swings.worstDay.change)}</dd><dd>{shortDate(swings.worstDay.date)}</dd></div>
          <div><dt>Best day</dt><dd className="positive">+{formatCurrency(swings.bestDay.change)}</dd><dd>{shortDate(swings.bestDay.date)}</dd></div>
        </dl>
      )
    },
    explain: () => null,
    why: 'Day-to-day change in the value of today\'s holdings over the period.',
  },
  {
    id: 'insights',
    title: 'Things to be aware of',
    description: 'Warnings about concentration and profile fit.',
    timeframe: 'today',
    render: (data) =>
      data.insights.length > 0 ? (
        <div className="insight-grid">{data.insights.map((i) => <InsightCard key={i.id} insight={i} />)}</div>
      ) : (
        <p className="empty-state">No warnings right now.</p>
      ),
    explain: () => null,
    why: 'Fixed rules: one sector over 40%, one region over 55%, cash over 25%, or a risk level that differs from your profile.',
  },
  {
    id: 'what-if',
    title: 'What if you changed something?',
    description: 'Simulations of simple changes and their effect on your risk score.',
    timeframe: 'today',
    render: (data) =>
      data.improvements.ideas.length > 0 ? (
        <ul className="what-if-list">
          {data.improvements.ideas.map((idea) => (
            <li key={idea.id}>
              <strong>{idea.title}</strong>
              <span>{idea.what_if}</span>
              <span className="what-if-list__score">Risk score {idea.before.risk_score} → <strong>{idea.after.risk_score}</strong></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No simulations to show: your portfolio fits your profile and is not heavily concentrated.</p>
      ),
    explain: () => 'Examples to understand your risk, not recommendations.',
    why: 'Each idea changes one thing (for example moving part of the money into a broad fund) and re-scores the portfolio with the same risk model. Taxes and fees are not included.',
  },
]

export function findMetric(id: string) {
  return METRIC_LIBRARY.find((m) => m.id === id)
}

export function MetricCard({ metric, data }: { metric: MetricDefinition; data: ReportData }) {
  const [showWhy, setShowWhy] = useState(false)
  const explanation = metric.explain(data)
  const chip = metric.timeframe === 'period' ? `${data.performance.series.length} days` : 'Today'
  return (
    <section className="metric-card">
      <header className="metric-card__header">
        <h3>{metric.title}</h3>
        <span className="metric-card__chip">{chip}</span>
      </header>
      <div className="metric-card__body">{metric.render(data)}</div>
      {explanation && <p className="metric-card__explain">{explanation}</p>}
      <button type="button" className="metric-card__why" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
        Why am I seeing this?
      </button>
      {showWhy && <p className="metric-card__why-text">{metric.why}</p>}
    </section>
  )
}
