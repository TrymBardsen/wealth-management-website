// Artifact build: the same functions as src/api/client.ts, answered in the
// page instead of over HTTP. They call the API's own service code (bundled
// from /api/src), so every number matches the Express API. Reports are
// written by Claude through the artifact's `sample` capability, on the
// viewer's own Claude account, and fall back to the template report when
// Claude is not available or the viewer declines.
//
// vite.artifact.config.ts swaps this module in for src/api/client.ts.
import { getAccountsFor, getCustomer, getInvestmentsFor, getTransactionsFor, customers } from '../../../api/src/data'
import { deterministicCopilot } from '../../../api/src/services/copilot'
import { suggestImprovements } from '../../../api/src/services/improvements'
import { generateInsights } from '../../../api/src/services/insights'
import { calculatePerformance, calculatePortfolio } from '../../../api/src/services/portfolio'
import {
  REPORT_SYSTEM_PROMPT,
  buildUserMessage,
  parseReportContent,
  reportQuestion,
} from '../../../api/src/services/reportPrompt'
import {
  MAX_QUESTION_LENGTH,
  REPORT_TYPES,
  buildDataPack,
  findReportType,
  finaliseReport,
  type ReportRequest,
} from '../../../api/src/services/reports'
import { templateContent } from '../../../api/src/services/reportTemplates'
import { calculateRisk, calculateRiskContributions, calculateRiskHistory } from '../../../api/src/services/risk'
import type {
  Account,
  CopilotReply,
  CustomerInterest,
  Interaction,
  Customer,
  ImprovementsSummary,
  InsightsSummary,
  Investment,
  PerformanceSummary,
  PortfolioSummary,
  Report,
  ReportTypesResponse,
  RiskContributions,
  RiskHistory,
  RiskSummary,
  Transaction,
} from '../api/types'

// --- Claude via the artifact runtime ---------------------------------------

interface SampleError {
  code: string
  message: string
}
type Sample = {
  json<T = unknown>(input: string, options?: { modelTier?: 'quick' | 'default' | 'complex' }): Promise<T>
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> }
  }
}

let samplePromise: Promise<Sample | null> | null = null
// Resolves null outside a Claude artifact viewer (e.g. on localhost).
function getSample(): Promise<Sample | null> {
  samplePromise ??= window.claude?.use
    ? window.claude.use('sample').then((s) => (s as Sample | null) ?? null, () => null)
    : Promise.resolve(null)
  return samplePromise
}

// The page controls no system prompt, so the rules, the JSON shape and the
// data all go into the one prompt.
const JSON_SHAPE = `Reply with only one JSON object of this shape:
{"title": string, "answers_question": boolean, "summary": string,
 "key_figures": [{"label": string, "value": string, "source": one of "customer" | "portfolio" | "benchmark" | "holdings" | "by_geography" | "by_sector" | "by_asset_type" | "requested_focus" | "risk" | "insights" | "improvement_ideas"}],
 "sections": [{"heading": string, "paragraphs": [string]}],
 "limitations": [string],
 "metrics": [card ids from rule 9]}`

function noteFor(code: string): string {
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      return 'Claude is not allowed to write reports in this view, so a standard report is shown instead.'
    case 'rate_limited':
      return 'Claude is busy or your usage limit is reached. A standard report is shown; try again later.'
    case 'refused':
      return 'Claude declined this request, so a standard report is shown instead.'
    case 'invalid_json':
    case 'empty_completion':
      return 'Claude\'s answer could not be read, so a standard report is shown instead.'
    case 'session_expired':
      return 'Your Claude session has expired. Sign in again to get AI reports; a standard report is shown for now.'
    default:
      return 'Claude is unavailable right now, so a standard report is shown instead.'
  }
}

async function generateReport(customerId: string, request: ReportRequest): Promise<Report> {
  const pack = buildDataPack(customerId, request.question ?? '')
  const template = (note?: string) =>
    finaliseReport(customerId, request, pack, templateContent(pack, request), { kind: 'template', ...(note ? { note } : {}) })

  const sample = await getSample()
  if (!sample || pack.holdings.length === 0) return template() as Report

  try {
    const reply = await sample.json(
      `${REPORT_SYSTEM_PROMPT}\n\n${JSON_SHAPE}\n\n${buildUserMessage(pack, reportQuestion(request))}`,
      { modelTier: 'default' },
    )
    const content = parseReportContent(JSON.stringify(reply))
    if (!content) return template(noteFor('invalid_json')) as Report
    return finaliseReport(customerId, request, pack, content, { kind: 'ai', model: 'Claude' }) as Report
  } catch (error) {
    return template(noteFor((error as SampleError)?.code ?? 'upstream_error')) as Report
  }
}

// --- The client API --------------------------------------------------------

function requireCustomer(customerId: string) {
  const customer = getCustomer(customerId)
  if (!customer) throw new Error('Customer not found')
  return customer
}

export async function fetchHealth(): Promise<{ status: string }> {
  return { status: 'ok' }
}

export async function fetchCustomers(): Promise<{ count: number; customers: Customer[] }> {
  return { count: customers.length, customers }
}

export async function fetchCustomer(customerId: string): Promise<Customer> {
  return requireCustomer(customerId)
}

export async function fetchAccounts(customerId: string): Promise<{ accounts: Account[] }> {
  return { accounts: getAccountsFor(requireCustomer(customerId).customer_id) }
}

export async function fetchTransactions(customerId: string): Promise<{ transactions: Transaction[] }> {
  return { transactions: getTransactionsFor(requireCustomer(customerId).customer_id) as Transaction[] }
}

export async function fetchInvestments(customerId: string): Promise<{ investments: Investment[] }> {
  return { investments: getInvestmentsFor(requireCustomer(customerId).customer_id) }
}

export async function fetchPortfolio(customerId: string): Promise<PortfolioSummary> {
  return calculatePortfolio(requireCustomer(customerId).customer_id)
}

export async function fetchPerformance(customerId: string): Promise<PerformanceSummary> {
  return calculatePerformance(requireCustomer(customerId).customer_id)
}

export async function fetchRisk(customerId: string): Promise<RiskSummary> {
  return calculateRisk(requireCustomer(customerId).customer_id)
}

export async function fetchRiskHistory(customerId: string): Promise<RiskHistory> {
  return calculateRiskHistory(requireCustomer(customerId).customer_id)
}

export async function fetchRiskContributions(customerId: string): Promise<RiskContributions> {
  return calculateRiskContributions(requireCustomer(customerId).customer_id)
}

export async function fetchInsights(customerId: string): Promise<InsightsSummary> {
  return generateInsights(requireCustomer(customerId).customer_id)
}

export async function fetchImprovements(customerId: string): Promise<ImprovementsSummary> {
  return suggestImprovements(requireCustomer(customerId).customer_id)
}

export async function fetchReportTypes(): Promise<ReportTypesResponse> {
  return {
    ai_enabled: (await getSample()) !== null,
    logging_enabled: false,
    max_question_length: MAX_QUESTION_LENGTH,
    report_types: REPORT_TYPES.map(({ id, title, description }) => ({ id, title, description })),
  }
}

export async function createReport(
  customerId: string,
  body: { report_type: string } | { question: string },
): Promise<Report> {
  const customer = requireCustomer(customerId)
  if ('report_type' in body) {
    const type = findReportType(body.report_type)
    if (!type) throw new Error('Unknown report type')
    return generateReport(customer.customer_id, { report_type: type.id })
  }
  const question = body.question.trim()
  if (!question) throw new Error('Write a question first')
  if (question.length > MAX_QUESTION_LENGTH) throw new Error(`Keep the question under ${MAX_QUESTION_LENGTH} characters`)
  return generateReport(customer.customer_id, { question })
}

export async function askCopilot(customerId: string, message: string): Promise<CopilotReply> {
  return deterministicCopilot.answer(requireCustomer(customerId).customer_id, message)
}

// The question log lives in Neon behind the API. An artifact page cannot
// reach other hosts, so the advisor view needs the API version of the app.
const ADVISOR_UNAVAILABLE = 'The advisor view needs the API with the Neon database, so it is not available in this artifact.'

export class AdvisorAuthError extends Error {}

export async function advisorLogin(): Promise<{ token: string; expires_at: string }> {
  throw new Error(ADVISOR_UNAVAILABLE)
}

export async function fetchAdvisorCustomers(): Promise<{ storage: string; customers: CustomerInterest[] }> {
  throw new Error(ADVISOR_UNAVAILABLE)
}

export async function fetchAdvisorInteractions(): Promise<{ storage: string; interactions: Interaction[] }> {
  throw new Error(ADVISOR_UNAVAILABLE)
}

export async function reviewInteraction(): Promise<Interaction> {
  throw new Error(ADVISOR_UNAVAILABLE)
}
