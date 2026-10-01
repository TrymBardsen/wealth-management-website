// Ready-made reports: fixed sets of cards from the metric library, drawn
// straight from the API data (no AI call, so they open instantly and cost
// nothing). Ids must exist in METRIC_LIBRARY.
export interface StandardReport {
  id: string
  title: string
  description: string
  metrics: string[]
}

export const STANDARD_REPORTS: StandardReport[] = [
  {
    id: 'risk',
    title: 'Where does your risk come from, and does it fit your profile?',
    description: 'Which investments drive the swings, and how that fits your risk profile.',
    metrics: ['profile-fit', 'risk-per-holding', 'score-breakdown', 'risk-over-time', 'insights'],
  },
  {
    id: 'holdings',
    title: 'What do you actually own?',
    description: 'Your money by investment type, sector and region, and what has gained or lost since you bought.',
    metrics: ['asset-mix', 'holdings-map', 'sectors', 'regions', 'concentration', 'gains-since-purchase'],
  },
  {
    id: 'market-falls',
    title: 'What if the market falls?',
    description: 'Hypothetical falls in NOK, the biggest fall in the period and how much you move in a normal month.',
    metrics: ['stress-test', 'drawdown', 'monthly-swing', 'best-worst-day', 'what-if'],
  },
  {
    id: 'vs-osebx',
    title: 'Your portfolio against Oslo Børs',
    description: 'Return, swings and falls compared with OSEBX over the period.',
    metrics: ['vs-osebx', 'profile-fit', 'drawdown'],
  },
  {
    id: 'data',
    title: 'Data and assumptions',
    description: 'Where the numbers come from, what is made up for the demo and what the calculations assume.',
    metrics: [],
  },
]

export function findStandardReport(id: string | undefined) {
  return STANDARD_REPORTS.find((r) => r.id === id)
}
