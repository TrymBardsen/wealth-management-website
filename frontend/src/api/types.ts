// Shared frontend/API contract types. Intentionally simple, hand-written
// copies of the shapes returned by /api - kept close to the source of
// truth in api/src/types.ts and api/src/services/*.ts for readability
// during the workshop rather than sharing a build-time package.

export interface Customer {
  customer_id: string
  first_name: string
  last_name: string
  age: number
  country: string
  risk_profile: string
  investment_horizon: string
  annual_income: number
  customer_since: string
}

export interface Account {
  account_id: string
  customer_id: string
  account_type: string
  currency: string
  balance: number
}

export interface Transaction {
  transaction_id: string
  customer_id: string
  account_id: string
  date: string
  type: 'credit' | 'debit' | 'transfer'
  category: string
  description: string
  amount: number
  currency: string
}

export interface Investment {
  investment_id: string
  customer_id: string
  account_id: string
  asset_type: string
  ticker: string
  name: string
  quantity: number
  purchase_price: number
  current_price: number
  currency: string
  sector: string
  geography: string
}

export interface AllocationSlice {
  label: string
  value: number
  percentage: number
}

export interface HoldingSummary {
  investment_id: string
  account_id: string
  ticker: string
  name: string
  asset_type: string
  quantity: number
  current_price: number
  market_value: number
  unrealized_gain_loss: number
  unrealized_gain_loss_pct: number
  weight_pct: number
}

export interface PortfolioSummary {
  customer_id: string
  total_value: number
  cash_value: number
  cash_percentage: number
  unrealized_gain_loss: number
  unrealized_gain_loss_pct: number
  allocation_by_asset_type: AllocationSlice[]
  allocation_by_geography: AllocationSlice[]
  allocation_by_sector: AllocationSlice[]
  largest_holdings: HoldingSummary[]
  holding_count: number
}

export interface PerformancePoint {
  date: string
  value: number
}

export interface BenchmarkComparison {
  ticker: string
  name: string
  source: string
  fetched_at: string
  series: PerformancePoint[]
  period_return_pct: number
  disclaimer: string
}

export interface PerformanceSummary {
  customer_id: string
  series: PerformancePoint[]
  period_return_pct: number
  start_value: number
  end_value: number
  benchmark: BenchmarkComparison | null
}

export interface RiskSummary {
  customer_id: string
  risk_score: number
  risk_category: 'Low' | 'Medium' | 'High'
  factors: {
    asset_allocation_score: number
    concentration_score: number
    geography_score: number
    volatility_score: number
  }
  customer_risk_profile: string
  risk_profile_alignment: string
  disclaimer: string
}

export interface RiskHistory {
  customer_id: string
  series: Array<{ date: string; risk_score: number; risk_category: RiskSummary['risk_category'] }>
  start_sector_weights: Array<{ label: string; percentage: number }>
  end_sector_weights: Array<{ label: string; percentage: number }>
  biggest_sector_shift: { label: string; from_pct: number; to_pct: number } | null
  note: string
}

export interface RiskContribution {
  investment_id: string
  ticker: string
  name: string
  asset_type: string
  sector: string
  value_pct: number
  daily_volatility_pct: number
  swing_share_pct: number
}

export interface RiskContributions {
  customer_id: string
  holdings: RiskContribution[]
  method: string
}

export interface RiskScoreSnapshot {
  risk_score: number
  risk_category: RiskSummary['risk_category']
  factors: RiskSummary['factors']
  alignment: string
}

export interface ImprovementIdea {
  id: string
  title: string
  why: string
  what_if: string
  trade_off: string
  amount_moved: number
  before: RiskScoreSnapshot
  after: RiskScoreSnapshot
}

export interface ImprovementsSummary {
  customer_id: string
  ideas: ImprovementIdea[]
  assumptions: string[]
  disclaimer: string
}

export interface Insight {
  id: string
  severity: 'info' | 'notice' | 'warning'
  title: string
  detail: string
}

export interface InsightsSummary {
  customer_id: string
  insights: Insight[]
  savings: {
    averageMonthlyIncome: number
    averageMonthlyExpenses: number
    averageMonthlySavings: number
    savingsRatePct: number
  }
}

export interface CopilotReply {
  answer: string
  matched_intent: string
}

export interface ReportType {
  id: string
  title: string
  description: string
}

export interface ReportTypesResponse {
  ai_enabled: boolean
  max_question_length: number
  report_types: ReportType[]
}

export interface Report {
  customer_id: string
  report_type: string | null
  question: string
  title: string
  answers_question: boolean
  summary: string
  key_figures: Array<{ label: string; value: string; source: string; verified: boolean }>
  sections: Array<{ heading: string; paragraphs: string[] }>
  limitations: string[]
  generated_by: { kind: 'ai' | 'template'; model?: string; note?: string }
  data_as_of: string
  data_period: { start: string; end: string }
  disclaimer: string
}
