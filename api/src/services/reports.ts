// Customer reports: shared types, the report catalog, the grounded "data
// pack" every report is built from, and checks that keep reports honest.
//
// Facts are computed deterministically here. A report generator (template
// or LLM, see reportTemplates.ts / reportAi.ts) only turns the data pack
// into a readable answer, and every key figure it states is checked
// against the numbers in the data pack.
import { getCustomer, getInvestmentsFor, getMarketDataFor } from '../data.js'
import { suggestImprovements } from './improvements.js'
import { generateInsights } from './insights.js'
import { calculatePerformance, calculatePortfolio } from './portfolio.js'
import { calculateRisk, calculateRiskContributions, calculateRiskHistory, expectedCategoryFor } from './risk.js'

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const REPORT_TYPES = [
  {
    id: 'risk-profile',
    title: 'Risk profile report',
    description: 'How much risk you take, where it comes from, and whether it fits your risk profile.',
    question: 'Create a report on my risk profile: how much risk my portfolio has, what drives it, and whether it fits my stated risk profile.',
  },
  {
    id: 'performance',
    title: 'Performance report',
    description: 'How your portfolio has developed over the period, compared with Oslo Børs.',
    question: 'Create a report on how my portfolio has performed over the period, which investments contributed most, and how it compares with Oslo Børs (OSEBX).',
  },
  {
    id: 'regions',
    title: 'Regional exposure report',
    description: 'Where in the world your money is invested, and how each region has done.',
    question: 'Create a report on where in the world my money is invested and how each region has performed over the period.',
  },
  {
    id: 'diversification',
    title: 'Diversification report',
    description: 'How spread out your investments are across holdings, sectors and regions.',
    question: 'Create a report on how well diversified my portfolio is across individual holdings, sectors and regions.',
  },
] as const

export type ReportTypeId = (typeof REPORT_TYPES)[number]['id']

export function findReportType(id: string) {
  return REPORT_TYPES.find((t) => t.id === id)
}

export const MAX_QUESTION_LENGTH = 500

export interface ReportRequest {
  report_type?: ReportTypeId
  question?: string
}

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

// Visual cards a report can show. The frontend draws each one from the same
// API data (frontend/src/reports/metrics.tsx); keep the ids in sync.
export const METRICS = [
  { id: 'profile-fit', description: 'Yearly swings of the portfolio and OSEBX against the typical range for the risk profile.' },
  { id: 'risk-score', description: 'The 0-100 risk score against the band that fits the risk profile.' },
  { id: 'score-breakdown', description: 'How asset mix, concentration, geography and volatility add up to the risk score.' },
  { id: 'risk-per-holding', description: 'Each holding\'s share of the money next to its share of the swings.' },
  { id: 'risk-over-time', description: 'The daily risk score over the period with today\'s holdings.' },
  { id: 'asset-mix', description: 'Shares, funds, bonds and cash, from calm to volatile.' },
  { id: 'holdings-map', description: 'Every holding as a box sized by its value.' },
  { id: 'sectors', description: 'Share of the portfolio per sector.' },
  { id: 'regions', description: 'Share of the portfolio per region.' },
  { id: 'concentration', description: 'How many equally sized holdings the portfolio behaves like, and the top three\'s share.' },
  { id: 'gains-since-purchase', description: 'Gain or loss since purchase for each holding.' },
  { id: 'vs-osebx', description: 'Portfolio value against Oslo Børs (OSEBX) over the period.' },
  { id: 'drawdown', description: 'The biggest fall from a peak during the period, for the portfolio and OSEBX.' },
  { id: 'stress-test', description: 'What hypothetical market falls of 10, 20 and 30% would cost in NOK.' },
  { id: 'monthly-swing', description: 'How much the portfolio can move in a normal month, in NOK.' },
  { id: 'best-worst-day', description: 'The best and worst single day in the period, in NOK.' },
  { id: 'insights', description: 'Rule-based warnings about concentration and profile fit.' },
  { id: 'what-if', description: 'What-if simulations of simple changes and their effect on the risk score.' },
] as const
export type MetricId = (typeof METRICS)[number]['id']
export const METRIC_IDS: string[] = METRICS.map((m) => m.id)
export const MAX_REPORT_METRICS = 4

export const DATA_SOURCES = [
  'customer',
  'portfolio',
  'benchmark',
  'holdings',
  'by_geography',
  'by_sector',
  'by_asset_type',
  'requested_focus',
  'risk',
  'insights',
  'improvement_ideas',
] as const
export type DataSource = (typeof DATA_SOURCES)[number]

// What a generator produces.
export interface ReportContent {
  title: string
  answers_question: boolean
  summary: string
  key_figures: Array<{ label: string; value: string; source: DataSource }>
  sections: Array<{ heading: string; paragraphs: string[] }>
  limitations: string[]
  // Up to MAX_REPORT_METRICS cards that illustrate the answer, in order.
  metrics: MetricId[]
}

// What the API returns: the content plus provenance added by the server.
export interface Report extends Omit<ReportContent, 'key_figures'> {
  customer_id: string
  report_type: ReportTypeId | null
  question: string
  key_figures: Array<{ label: string; value: string; source: DataSource; verified: boolean }>
  generated_by: { kind: 'ai' | 'template'; model?: string; note?: string }
  data_as_of: string
  data_period: { start: string; end: string }
  disclaimer: string
}

export const REPORT_DISCLAIMER =
  'Generated from fictional demo data for educational purposes. Not investment advice. Discuss any decisions with an advisor.'

// ---------------------------------------------------------------------------
// Scope detection (which region/sector a free-text question is about)
// ---------------------------------------------------------------------------

const NORDIC_LABELS = ['Nordics', 'Norway', 'Sweden', 'Denmark', 'Finland']
const FOCUS_RULES: Array<{ label: string; field: 'geography' | 'sector'; values: string[]; pattern: RegExp }> = [
  { label: 'Asia Pacific', field: 'geography', values: ['Asia Pacific'], pattern: /\b(asia\w*|asiat\w*|apac)\b/i },
  { label: 'Nordics', field: 'geography', values: NORDIC_LABELS, pattern: /\b(nordic\w*|nordisk\w*|norden)\b/i },
  { label: 'Norway', field: 'geography', values: ['Norway'], pattern: /\b(norway|norwegian|norsk\w*|norge)\b/i },
  { label: 'United States', field: 'geography', values: ['United States'], pattern: /\b(usa|u\.s\.|united states|american\w*|amerikansk\w*)\b/i },
  { label: 'Europe', field: 'geography', values: ['Europe'], pattern: /\b(europe\w*|europa|europeisk\w*)\b/i },
  { label: 'Emerging Markets', field: 'geography', values: ['Emerging Markets'], pattern: /\b(emerging|fremvoksende)\b/i },
  { label: 'Technology', field: 'sector', values: ['Technology'], pattern: /\b(tech\w*|teknologi\w*)\b/i },
  { label: 'Energy', field: 'sector', values: ['Energy'], pattern: /\b(energy|energi\w*)\b/i },
  { label: 'Healthcare', field: 'sector', values: ['Healthcare'], pattern: /\b(health\w*|helse\w*|pharma\w*)\b/i },
  { label: 'Financials', field: 'sector', values: ['Financials'], pattern: /\b(financ\w*|finans\w*|bank\w*)\b/i },
  { label: 'Industrials', field: 'sector', values: ['Industrials'], pattern: /\b(industr\w*)\b/i },
]

export interface Focus {
  label: string
  field: 'geography' | 'sector'
  values: string[]
}

export function detectFocus(question: string): Focus | null {
  const rule = FOCUS_RULES.find((r) => r.pattern.test(question))
  return rule ? { label: rule.label, field: rule.field, values: rule.values } : null
}

// ---------------------------------------------------------------------------
// Data pack
// ---------------------------------------------------------------------------

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))

export interface HoldingFacts {
  ticker: string
  name: string
  asset_type: string
  sector: string
  geography: string
  value_nok: number
  weight_pct: number
  unrealized_gain_loss_nok: number
  unrealized_gain_loss_pct: number
  period_start_value_nok: number
  period_change_nok: number
  period_return_pct: number
  daily_volatility_pct: number
  swing_share_pct: number
}

export interface GroupFacts {
  label: string
  value_nok: number
  weight_pct: number
  period_change_nok: number
  period_return_pct: number
  holdings: string[]
}

export interface DataPack {
  as_of: string
  period: { start: string; end: string; days: number }
  customer: { age: number; risk_profile: string; investment_horizon: string }
  portfolio: {
    total_value_nok: number
    holding_count: number
    cash_pct: number
    unrealized_gain_loss_nok: number
    unrealized_gain_loss_pct: number
    period_start_value_nok: number
    period_change_nok: number
    period_return_pct: number
  }
  benchmark: { name: string; source: string; period_return_pct: number } | null
  holdings: HoldingFacts[]
  by_geography: GroupFacts[]
  by_sector: GroupFacts[]
  by_asset_type: GroupFacts[]
  requested_focus: (GroupFacts & { matched: string[]; field: 'geography' | 'sector' }) | null
  risk: {
    score: number
    category: string
    expected_category_for_profile: string
    alignment: string
    factors: Record<string, number>
    score_at_period_start: number
    score_min_in_period: number
    score_max_in_period: number
    biggest_sector_shift: { label: string; from_pct: number; to_pct: number } | null
    model_note: string
  }
  insights: Array<{ title: string; detail: string }>
  improvement_ideas: Array<{ title: string; what_if: string; score_before: number; score_after: number }>
  notes: string[]
}

function groupBy(holdings: HoldingFacts[], key: 'geography' | 'sector' | 'asset_type', total: number): GroupFacts[] {
  const groups = new Map<string, HoldingFacts[]>()
  for (const h of holdings) groups.set(h[key], [...(groups.get(h[key]) ?? []), h])
  return [...groups.entries()].map(([label, members]) => summarise(label, members, total)).sort((a, b) => b.value_nok - a.value_nok)
}

function summarise(label: string, members: HoldingFacts[], total: number): GroupFacts {
  const value = members.reduce((sum, h) => sum + h.value_nok, 0)
  const start = members.reduce((sum, h) => sum + h.period_start_value_nok, 0)
  const change = members.reduce((sum, h) => sum + h.period_change_nok, 0)
  return {
    label,
    value_nok: round(value, 0),
    weight_pct: total > 0 ? round((value / total) * 100) : 0,
    period_change_nok: round(change, 0),
    period_return_pct: start > 0 ? round((change / start) * 100) : 0,
    holdings: members.map((h) => h.ticker),
  }
}

export function buildDataPack(customerId: string, question = ''): DataPack {
  const customer = getCustomer(customerId)
  const investments = getInvestmentsFor(customerId)
  const portfolio = calculatePortfolio(customerId)
  const performance = calculatePerformance(customerId)
  const risk = calculateRisk(customerId)
  const contributions = calculateRiskContributions(customerId)
  const history = calculateRiskHistory(customerId)
  const total = portfolio.total_value

  const holdings: HoldingFacts[] = investments.map((inv) => {
    const value = inv.quantity * inv.current_price
    const cost = inv.quantity * inv.purchase_price
    const startPrice = getMarketDataFor(inv.ticker)[0]?.price ?? inv.current_price
    const startValue = inv.quantity * startPrice
    const contribution = contributions.holdings.find((c) => c.investment_id === inv.investment_id)
    return {
      ticker: inv.ticker,
      name: inv.name,
      asset_type: inv.asset_type,
      sector: inv.sector,
      geography: inv.geography,
      value_nok: round(value, 0),
      weight_pct: total > 0 ? round((value / total) * 100) : 0,
      unrealized_gain_loss_nok: round(value - cost, 0),
      unrealized_gain_loss_pct: cost > 0 ? round(((value - cost) / cost) * 100) : 0,
      period_start_value_nok: round(startValue, 0),
      period_change_nok: round(value - startValue, 0),
      period_return_pct: startValue > 0 ? round(((value - startValue) / startValue) * 100) : 0,
      daily_volatility_pct: contribution?.daily_volatility_pct ?? 0,
      swing_share_pct: contribution?.swing_share_pct ?? 0,
    }
  }).sort((a, b) => b.value_nok - a.value_nok)

  const focus = detectFocus(question)
  const focusMembers = focus ? holdings.filter((h) => focus.values.includes(h[focus.field])) : []
  const scores = history.series.map((p) => p.risk_score)
  const dates = performance.series.map((p) => p.date)
  const insights = generateInsights(customerId).insights

  return {
    as_of: dates[dates.length - 1] ?? '',
    period: { start: dates[0] ?? '', end: dates[dates.length - 1] ?? '', days: dates.length },
    customer: {
      age: customer?.age ?? 0,
      risk_profile: customer?.risk_profile ?? 'Unknown',
      investment_horizon: customer?.investment_horizon ?? 'Unknown',
    },
    portfolio: {
      total_value_nok: round(total, 0),
      holding_count: portfolio.holding_count,
      cash_pct: portfolio.cash_percentage,
      unrealized_gain_loss_nok: round(portfolio.unrealized_gain_loss, 0),
      unrealized_gain_loss_pct: portfolio.unrealized_gain_loss_pct,
      period_start_value_nok: round(performance.start_value, 0),
      period_change_nok: round(performance.end_value - performance.start_value, 0),
      period_return_pct: performance.period_return_pct,
    },
    benchmark: performance.benchmark
      ? { name: performance.benchmark.name, source: performance.benchmark.source, period_return_pct: performance.benchmark.period_return_pct }
      : null,
    holdings,
    by_geography: groupBy(holdings, 'geography', total),
    by_sector: groupBy(holdings, 'sector', total),
    by_asset_type: groupBy(holdings, 'asset_type', total),
    requested_focus: focus ? { ...summarise(focus.label, focusMembers, total), matched: focus.values, field: focus.field } : null,
    risk: {
      score: risk.risk_score,
      category: risk.risk_category,
      expected_category_for_profile: expectedCategoryFor(customer?.risk_profile),
      alignment: risk.risk_profile_alignment,
      factors: { ...risk.factors },
      score_at_period_start: scores[0] ?? risk.risk_score,
      score_min_in_period: scores.length ? Math.min(...scores) : risk.risk_score,
      score_max_in_period: scores.length ? Math.max(...scores) : risk.risk_score,
      biggest_sector_shift: history.biggest_sector_shift,
      model_note: risk.disclaimer,
    },
    insights: insights.map((i) => ({ title: i.title, detail: i.detail })),
    improvement_ideas: suggestImprovements(customerId).ideas.map((idea) => ({
      title: idea.title,
      what_if: idea.what_if,
      score_before: idea.before.risk_score,
      score_after: idea.after.risk_score,
    })),
    notes: [
      'All customer and price data is synthetic (fictional). The OSEBX benchmark uses real index levels.',
      `Price history covers ${dates.length} days (${dates[0] ?? '?'} to ${dates[dates.length - 1] ?? '?'}).`,
      'Period figures assume today\'s holdings were held for the whole period (no purchase/sale history exists).',
      '"Diversified" and "Global" labels describe broad funds; what those funds contain is unknown.',
    ],
  }
}

// ---------------------------------------------------------------------------
// Grounding check
// ---------------------------------------------------------------------------

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectNumbers(v, out))
  return out
}

// A key figure counts as verified when every number in it matches a number
// in the data pack, allowing for rounding (e.g. 24.51 shown as "25%" or
// 86024 shown as "86,024 NOK"). Derived numbers (sums, differences the
// writer calculated) are flagged so readers know to double-check them.
export function isFigureGrounded(value: string, pack: DataPack): boolean {
  const figures = [...value.replace(/(\d),(?=\d{3}\b)/g, '$1').matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
  if (figures.length === 0) return true
  const known = collectNumbers(pack)
  return figures.every((x) =>
    known.some((n) => Math.abs(Math.abs(n) - Math.abs(x)) <= Math.max(0.51, Math.abs(n) * 0.006)),
  )
}

export function finaliseReport(
  customerId: string,
  request: ReportRequest,
  pack: DataPack,
  content: ReportContent,
  generatedBy: Report['generated_by'],
): Report {
  const type = request.report_type ? findReportType(request.report_type) : undefined
  return {
    customer_id: customerId,
    report_type: type?.id ?? null,
    question: type?.question ?? request.question ?? '',
    title: content.title,
    answers_question: content.answers_question,
    summary: content.summary,
    key_figures: content.key_figures.map((f) => ({ ...f, verified: isFigureGrounded(f.value, pack) })),
    sections: content.sections,
    limitations: content.limitations,
    metrics: content.metrics.slice(0, MAX_REPORT_METRICS),
    generated_by: generatedBy,
    data_as_of: pack.as_of,
    data_period: { start: pack.period.start, end: pack.period.end },
    disclaimer: REPORT_DISCLAIMER,
  }
}

// ---------------------------------------------------------------------------
// Generator seam
// ---------------------------------------------------------------------------

export interface ReportGenerator {
  kind: 'ai' | 'template'
  generate(customerId: string, request: ReportRequest): Promise<Report>
}
