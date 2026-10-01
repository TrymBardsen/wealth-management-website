// Deterministic report templates. Used when no LLM is configured, and as
// the fallback whenever the AI generator fails or declines. Every number
// comes straight from the data pack, so these reports are always grounded.
import {
  REPORT_TYPES,
  buildDataPack,
  detectFocus,
  finaliseReport,
  type DataPack,
  type GroupFacts,
  type ReportContent,
  type ReportGenerator,
  type ReportRequest,
} from './reports.js'

const nok = (value: number) => `${Math.round(value).toLocaleString('en-US')} NOK`
const pct = (value: number) => `${value.toFixed(1)}%`
const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const signedNok = (value: number) => `${value >= 0 ? '+' : '-'}${nok(Math.abs(value))}`

const BASE_LIMITATIONS = [
  'Based on synthetic demo data and about 90 days of prices.',
  'Assumes today\'s holdings were held for the whole period.',
]

function noHoldings(pack: DataPack, title: string): ReportContent {
  return {
    title,
    answers_question: false,
    summary: 'You have no investments yet, so there is nothing to report on.',
    key_figures: [],
    sections: [],
    limitations: [],
    metrics: [],
  }
}

function riskProfile(pack: DataPack): ReportContent {
  const r = pack.risk
  const top = [...pack.holdings].sort((a, b) => b.swing_share_pct - a.swing_share_pct)[0]
  const fits = r.alignment === 'Aligned'
    ? `This fits a "${pack.customer.risk_profile}" profile, which typically means "${r.expected_category_for_profile}" risk.`
    : `A "${pack.customer.risk_profile}" profile typically means "${r.expected_category_for_profile}" risk, so your portfolio is ${r.alignment.toLowerCase()}.`
  return {
    title: 'Your risk profile',
    answers_question: true,
    summary: `Your portfolio's risk score is ${r.score} out of 100 ("${r.category}"). ${fits}`,
    key_figures: [
      { label: 'Risk score (0-100)', value: String(r.score), source: 'risk' },
      { label: 'Risk category', value: r.category, source: 'risk' },
      { label: 'Your risk profile', value: pack.customer.risk_profile, source: 'customer' },
      ...(top ? [{ label: `${top.name}: share of the swings`, value: pct(top.swing_share_pct), source: 'holdings' as const }] : []),
    ],
    sections: [
      {
        heading: 'What drives the score',
        paragraphs: [
          `Asset mix scores ${r.factors.asset_allocation_score}, concentration ${r.factors.concentration_score}, geography ${r.factors.geography_score} and volatility ${r.factors.volatility_score} (each 0-100).`,
          top ? `${top.name} is ${pct(top.weight_pct)} of your money but ${pct(top.swing_share_pct)} of the swings.` : '',
        ].filter(Boolean),
      },
      {
        heading: 'How it has changed',
        paragraphs: [`Over the period the score moved between ${r.score_min_in_period} and ${r.score_max_in_period}, starting at ${r.score_at_period_start}.`],
      },
      ...(pack.improvement_ideas.length > 0
        ? [{
          heading: 'What-if simulations',
          paragraphs: pack.improvement_ideas.map((i) => `${i.title}: ${i.what_if} Risk score ${i.score_before} → ${i.score_after}.`),
        }]
        : []),
    ],
    limitations: [...BASE_LIMITATIONS, 'The risk score is a simplified educational model.'],
    metrics: ['profile-fit', 'risk-per-holding', 'score-breakdown'],
  }
}

function performance(pack: DataPack): ReportContent {
  const p = pack.portfolio
  const byChange = [...pack.holdings].sort((a, b) => b.period_change_nok - a.period_change_nok)
  const best = byChange[0]
  const worst = byChange[byChange.length - 1]
  const vs = pack.benchmark
    ? ` Oslo Børs (OSEBX) returned ${signedPct(pack.benchmark.period_return_pct)} over the same period.`
    : ''
  return {
    title: 'Your portfolio performance',
    answers_question: true,
    summary: `Your portfolio returned ${signedPct(p.period_return_pct)} (${signedNok(p.period_change_nok)}) from ${pack.period.start} to ${pack.period.end}.${vs}`,
    key_figures: [
      { label: 'Period return', value: signedPct(p.period_return_pct), source: 'portfolio' },
      { label: 'Change in value', value: signedNok(p.period_change_nok), source: 'portfolio' },
      { label: 'Portfolio value now', value: nok(p.total_value_nok), source: 'portfolio' },
      ...(pack.benchmark ? [{ label: 'OSEBX return', value: signedPct(pack.benchmark.period_return_pct), source: 'benchmark' as const }] : []),
    ],
    sections: [
      {
        heading: 'Biggest contributors',
        paragraphs: [
          best ? `Best: ${best.name}, ${signedNok(best.period_change_nok)} (${signedPct(best.period_return_pct)}).` : '',
          worst && worst !== best ? `Weakest: ${worst.name}, ${signedNok(worst.period_change_nok)} (${signedPct(worst.period_return_pct)}).` : '',
        ].filter(Boolean),
      },
    ],
    limitations: [...BASE_LIMITATIONS, 'Portfolio values are synthetic, so the comparison with the real OSEBX index is illustrative.'],
    metrics: ['vs-osebx', 'gains-since-purchase', 'drawdown'],
  }
}

function groupParagraph(g: GroupFacts) {
  return `${g.label}: ${nok(g.value_nok)} (${pct(g.weight_pct)} of the portfolio), ${signedPct(g.period_return_pct)} over the period.`
}

function regions(pack: DataPack): ReportContent {
  const top = pack.by_geography[0]
  return {
    title: 'Where your money is invested',
    answers_question: true,
    summary: `Your money is spread across ${pack.by_geography.length} regions. The largest is ${top.label} at ${pct(top.weight_pct)}.`,
    key_figures: pack.by_geography.slice(0, 4).map((g) => ({ label: g.label, value: pct(g.weight_pct), source: 'by_geography' as const })),
    sections: [{ heading: 'By region', paragraphs: pack.by_geography.map(groupParagraph) }],
    limitations: [...BASE_LIMITATIONS, '"Global" funds count as one region even though they invest in many countries.'],
    metrics: ['regions', 'holdings-map'],
  }
}

function diversification(pack: DataPack): ReportContent {
  const largest = pack.holdings[0]
  const topSector = pack.by_sector[0]
  return {
    title: 'How diversified your portfolio is',
    answers_question: true,
    summary: `You own ${pack.portfolio.holding_count} investments. The largest, ${largest.name}, is ${pct(largest.weight_pct)} of the portfolio, and the biggest sector label is ${topSector.label} at ${pct(topSector.weight_pct)}.`,
    key_figures: [
      { label: 'Number of investments', value: String(pack.portfolio.holding_count), source: 'portfolio' },
      { label: 'Largest investment', value: pct(largest.weight_pct), source: 'holdings' },
      { label: 'Concentration score (0-100)', value: String(pack.risk.factors.concentration_score), source: 'risk' },
      { label: 'Geography score (0-100)', value: String(pack.risk.factors.geography_score), source: 'risk' },
    ],
    sections: [
      { heading: 'By sector', paragraphs: pack.by_sector.map(groupParagraph) },
      { heading: 'By region', paragraphs: pack.by_geography.map(groupParagraph) },
    ],
    limitations: [...BASE_LIMITATIONS, '"Diversified" and "Global" funds are counted as single labels; their contents are unknown.'],
    metrics: ['concentration', 'holdings-map', 'sectors', 'regions'],
  }
}

function focusReport(pack: DataPack): ReportContent {
  const focus = pack.requested_focus!
  const members = pack.holdings.filter((h) => focus.holdings.includes(h.ticker))
  if (members.length === 0) {
    return {
      title: `Your ${focus.label} investments`,
      answers_question: true,
      summary: `You do not own any investments labelled ${focus.matched.join(', ')}.`,
      key_figures: [],
      sections: [],
      limitations: ['Broad "Global" funds may contain some exposure that is not visible in the data.'],
      metrics: [focus.field === 'geography' ? 'regions' : 'sectors'],
    }
  }
  return {
    title: `Your ${focus.label} investments`,
    answers_question: true,
    summary: `Your ${focus.label} investments are worth ${nok(focus.value_nok)} (${pct(focus.weight_pct)} of the portfolio) and returned ${signedPct(focus.period_return_pct)} (${signedNok(focus.period_change_nok)}) from ${pack.period.start} to ${pack.period.end}.`,
    key_figures: [
      { label: 'Value', value: nok(focus.value_nok), source: 'requested_focus' },
      { label: 'Share of portfolio', value: pct(focus.weight_pct), source: 'requested_focus' },
      { label: 'Period return', value: signedPct(focus.period_return_pct), source: 'requested_focus' },
      { label: 'Whole portfolio return', value: signedPct(pack.portfolio.period_return_pct), source: 'portfolio' },
    ],
    sections: [{
      heading: 'Holdings',
      paragraphs: members.map((h) => `${h.name} (${h.ticker}): ${nok(h.value_nok)}, ${signedPct(h.period_return_pct)} over the period, ${signedPct(h.unrealized_gain_loss_pct)} since purchase.`),
    }],
    limitations: [...BASE_LIMITATIONS, 'Broad "Global" funds may contain some exposure that is not visible in the data.'],
    metrics: [focus.field === 'geography' ? 'regions' : 'sectors', 'gains-since-purchase'],
  }
}

function unsupported(): ReportContent {
  return {
    title: 'This question needs the AI report writer',
    answers_question: false,
    summary: 'Without the AI report writer, free-text questions can only be answered when they mention a region or sector (for example "my Asian stocks"). Try one of the ready-made reports instead.',
    key_figures: [],
    sections: [{ heading: 'Ready-made reports', paragraphs: REPORT_TYPES.map((t) => `${t.title}: ${t.description}`) }],
    limitations: [],
    metrics: [],
  }
}

export function templateContent(pack: DataPack, request: ReportRequest): ReportContent {
  const title = 'Report'
  if (pack.holdings.length === 0) return noHoldings(pack, title)
  switch (request.report_type) {
    case 'risk-profile': return riskProfile(pack)
    case 'performance': return performance(pack)
    case 'regions': return regions(pack)
    case 'diversification': return diversification(pack)
  }
  if (request.question && detectFocus(request.question)) return focusReport(pack)
  return unsupported()
}

export const templateReportGenerator: ReportGenerator = {
  kind: 'template',
  async generate(customerId, request) {
    const pack = buildDataPack(customerId, request.question ?? '')
    return finaliseReport(customerId, request, pack, templateContent(pack, request), { kind: 'template' })
  },
}
