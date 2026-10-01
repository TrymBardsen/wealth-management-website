// Rule-based "ideas to explore" for a customer's portfolio.
//
// Each idea is a deterministic WHAT-IF simulation: a rule spots something
// in the portfolio, builds a hypothetical version of it with one simple
// change, and re-scores both with the same demo risk model. The output
// explains the effect and the trade-off instead of telling the customer
// what to buy or sell, and never names specific products.
//
// IMPORTANT: Educational demo only. Not investment advice.
import { getAllInstruments, getCustomer, getInvestmentsFor } from '../data.js'
import {
  alignmentFor,
  dailyReturnStd,
  expectedCategoryFor,
  positionsFor,
  scorePositions,
  type RiskAlignment,
  type RiskPosition,
  type RiskScore,
} from './risk.js'

const LARGEST_HOLDING_THRESHOLD_PCT = 20
const LARGEST_HOLDING_TARGET_PCT = 15
const SECTOR_THRESHOLD_PCT = 40
const SECTOR_TARGET_PCT = 30
const GEOGRAPHY_THRESHOLD_PCT = 55
const GEOGRAPHY_TARGET_PCT = 40
const SHIFT_STEPS_PCT = [10, 20, 30, 40, 50, 60]
// Labels that describe a spread-out fund rather than one sector/region.
const BROAD_LABELS = ['Diversified', 'Global']

export interface ImprovementIdea {
  id: string
  title: string
  why: string
  what_if: string
  trade_off: string
  amount_moved: number
  before: RiskScore & { alignment: RiskAlignment }
  after: RiskScore & { alignment: RiskAlignment }
}

export interface ImprovementsSummary {
  customer_id: string
  ideas: ImprovementIdea[]
  assumptions: string[]
  disclaimer: string
}

interface TaggedPosition extends RiskPosition {
  name: string
  sector: string
}

function pct(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0
}

function nok(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} NOK`
}

// Typical daily volatility for an asset type, averaged over the instruments
// of that type in the synthetic universe. Used for the generic positions.
function typicalVolatility(assetType: string): number {
  const stds = getAllInstruments()
    .filter((i) => i.asset_type === assetType)
    .map((i) => dailyReturnStd(i.ticker))
  return stds.length > 0 ? stds.reduce((a, b) => a + b, 0) / stds.length : 0
}

// Generic, product-neutral destinations for money in a simulation.
function broadFund(value: number): TaggedPosition {
  return { name: 'Broad global fund', value, asset_type: 'ETF', geography: 'Global', sector: 'Diversified', daily_return_std: typicalVolatility('ETF'), diversified: true }
}
function broadBonds(value: number): TaggedPosition {
  return { name: 'Broad bond allocation', value, asset_type: 'Bond', geography: 'Global', sector: 'Bonds', daily_return_std: typicalVolatility('Bond'), diversified: true }
}

// Takes `amount` proportionally out of the positions matching `from` and
// adds it as one new position.
function moveAmount(
  positions: TaggedPosition[],
  from: (p: TaggedPosition) => boolean,
  amount: number,
  to: (value: number) => TaggedPosition,
): TaggedPosition[] {
  const sourceTotal = positions.filter(from).reduce((sum, p) => sum + p.value, 0)
  if (sourceTotal <= 0 || amount <= 0) return positions
  const share = Math.min(1, amount / sourceTotal)
  return [...positions.map((p) => (from(p) ? { ...p, value: p.value * (1 - share) } : p)), to(Math.min(amount, sourceTotal))]
}

// Like moveAmount, but keeps each asset class where it is so that spreading
// out never sneaks in more risk: bonds go into the broad bond allocation and
// everything else into the broad global fund. Cash is never moved.
function spreadOut(
  positions: TaggedPosition[],
  from: (p: TaggedPosition) => boolean,
  amount: number,
): { positions: TaggedPosition[]; destination: string } {
  const isBond = (p: TaggedPosition) => p.asset_type === 'Bond'
  const source = (p: TaggedPosition) => p.asset_type !== 'Cash' && from(p)
  const sourceTotal = positions.filter(source).reduce((sum, p) => sum + p.value, 0)
  if (sourceTotal <= 0 || amount <= 0) return { positions, destination: '' }
  const share = Math.min(1, amount / sourceTotal)
  const bondAmount = positions.filter((p) => source(p) && isBond(p)).reduce((sum, p) => sum + p.value * share, 0)
  const otherAmount = positions.filter((p) => source(p) && !isBond(p)).reduce((sum, p) => sum + p.value * share, 0)

  const destinations: TaggedPosition[] = []
  if (otherAmount > 0) destinations.push(broadFund(otherAmount))
  if (bondAmount > 0) destinations.push(broadBonds(bondAmount))
  const destination = bondAmount > 0 && otherAmount > 0
    ? 'broad funds of the same type (a broad global fund for shares and funds, a broad bond allocation for bonds)'
    : bondAmount > 0 ? 'a broad bond allocation' : 'a broad global fund'

  return {
    positions: [...positions.map((p) => (source(p) ? { ...p, value: p.value * (1 - share) } : p)), ...destinations],
    destination,
  }
}

export function suggestImprovements(customerId: string): ImprovementsSummary {
  const customer = getCustomer(customerId)
  const holdings = getInvestmentsFor(customerId)
  const positions: TaggedPosition[] = positionsFor(customerId).map((p, i) => ({
    ...p,
    name: holdings[i].name,
    sector: holdings[i].sector,
  }))
  const total = positions.reduce((sum, p) => sum + p.value, 0)

  const scoreWithAlignment = (ps: RiskPosition[]) => {
    const score = scorePositions(ps)
    return { ...score, alignment: alignmentFor(score.risk_category, customer?.risk_profile) }
  }
  const before = scoreWithAlignment(positions)
  const ideas: ImprovementIdea[] = []
  const addIdea = (idea: Omit<ImprovementIdea, 'before' | 'after'>, simulated: TaggedPosition[]) =>
    ideas.push({ ...idea, amount_moved: Math.round(idea.amount_moved), before, after: scoreWithAlignment(simulated) })

  if (total <= 0) {
    return { customer_id: customerId, ideas, assumptions: [], disclaimer: DISCLAIMER }
  }

  // 1) Risk level vs. the customer's own profile: find the smallest shift
  // (in 10% steps) that brings the risk category in line with the profile.
  const expected = expectedCategoryFor(customer?.risk_profile)
  const profile = customer?.risk_profile ?? 'Unknown'
  if (before.alignment !== 'Aligned') {
    const lowerRisk = before.alignment === 'More aggressive than profile'
    const from = lowerRisk
      ? (p: TaggedPosition) => p.asset_type !== 'Bond' && p.asset_type !== 'Cash'
      : (p: TaggedPosition) => p.asset_type === 'Cash' || p.asset_type === 'Bond'
    const to = lowerRisk ? broadBonds : broadFund
    const step = SHIFT_STEPS_PCT.find((s) => {
      const simulated = moveAmount(positions, from, (total * s) / 100, to)
      return scoreWithAlignment(simulated).alignment === 'Aligned'
    })
    if (step !== undefined) {
      const amount = (total * step) / 100
      addIdea(
        lowerRisk
          ? {
            id: 'align-with-profile',
            title: 'Bring your risk closer to your profile',
            why: `Your portfolio's risk is "${before.risk_category}", while a "${profile}" profile typically means "${expected}".`,
            what_if: `Move ${step}% of the portfolio (about ${nok(amount)}) from shares and funds into a broad bond allocation.`,
            trade_off: 'Bonds usually move less, but also tend to grow less than shares over long periods.',
            amount_moved: amount,
          }
          : {
            id: 'align-with-profile',
            title: 'Your portfolio is more cautious than your profile',
            why: `Your portfolio's risk is "${before.risk_category}", while a "${profile}" profile typically means "${expected}".`,
            what_if: `Move ${step}% of the portfolio (about ${nok(amount)}) from cash and bonds into a broad global fund.`,
            trade_off: 'This means bigger ups and downs along the way, and only makes sense if the money can stay invested for years.',
            amount_moved: amount,
          },
        moveAmount(positions, from, amount, to),
      )
    }
  }

  // 2) One holding dominates the portfolio.
  const largest = positions.filter((p) => p.asset_type !== 'Cash').sort((a, b) => b.value - a.value)[0]
  const largestPct = largest ? pct(largest.value, total) : 0
  if (largest && largestPct > LARGEST_HOLDING_THRESHOLD_PCT) {
    const amount = largest.value - (total * LARGEST_HOLDING_TARGET_PCT) / 100
    const simulated = spreadOut(positions, (p) => p === largest, amount)
    addIdea(
      {
        id: 'trim-largest-holding',
        title: 'Lean less on one investment',
        why: `${largest.name} makes up ${largestPct.toFixed(0)}% of your portfolio, so its ups and downs dominate.`,
        what_if: `Reduce it to ${LARGEST_HOLDING_TARGET_PCT}% of the portfolio by moving about ${nok(amount)} into ${simulated.destination}.`,
        trade_off: 'Selling may trigger tax on gains and trading costs, and you would gain less if this investment does very well.',
        amount_moved: amount,
      },
      simulated.positions,
    )
  }

  // 3) One sector or 4) one region dominates. Broad funds are skipped since
  // "Diversified"/"Global" says nothing about what they actually contain.
  const concentrationRule = (
    key: 'sector' | 'geography',
    threshold: number,
    target: number,
    id: string,
    title: string,
  ) => {
    const totals = new Map<string, number>()
    for (const p of positions) {
      if (p.asset_type !== 'Cash') totals.set(p[key], (totals.get(p[key]) ?? 0) + p.value)
    }
    const [label, value] = [...totals.entries()]
      .filter(([l]) => !BROAD_LABELS.includes(l))
      .sort((a, b) => b[1] - a[1])[0] ?? []
    if (!label || value === undefined || pct(value, total) < threshold) return
    const amount = value - (total * target) / 100
    const simulated = spreadOut(positions, (p) => p[key] === label, amount)
    addIdea(
      {
        id,
        title,
        why: `${pct(value, total).toFixed(0)}% of your portfolio is in ${label}, so news that hits ${label} hits a large part of your money.`,
        what_if: `Bring ${label} down to ${target}% by moving about ${nok(amount)} into ${simulated.destination}.`,
        trade_off: `You would benefit less if ${label} does better than the rest of the market.`,
        amount_moved: amount,
      },
      simulated.positions,
    )
  }
  concentrationRule('sector', SECTOR_THRESHOLD_PCT, SECTOR_TARGET_PCT, 'reduce-sector-concentration', 'Spread across more sectors')
  concentrationRule('geography', GEOGRAPHY_THRESHOLD_PCT, GEOGRAPHY_TARGET_PCT, 'reduce-geography-concentration', 'Spread across more regions')

  return {
    customer_id: customerId,
    ideas,
    assumptions: [
      'Each idea changes one thing and keeps everything else as it is today.',
      '"Broad global fund" and "broad bond allocation" are generic placeholders, not specific products. Their volatility is the average for that asset type in the demo data.',
      'The placeholders are treated as spread over many holdings and regions, so they do not add concentration risk. Funds you already own are still scored as single holdings, which may overstate their concentration.',
      'Risk scores use the same simplified demo model as the rest of the app, based on about 90 days of synthetic prices.',
      'Taxes, fees and the customer\'s wider situation are not taken into account.',
    ],
    disclaimer: DISCLAIMER,
  }
}

const DISCLAIMER =
  'Educational what-if simulations, not investment advice. Discuss any changes with an advisor before acting.'
