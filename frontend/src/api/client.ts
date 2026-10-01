// Thin fetch wrapper for the Wealth Copilot API.
//
// The API base URL is configurable via VITE_API_URL so the same frontend
// build can point at a local dev server or a deployed API without code
// changes. Defaults to localhost:3000 for local development.
import type {
  Account,
  Customer,
  CopilotReply,
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
} from './types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`)
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export async function fetchHealth(): Promise<{ status: string }> {
  return getJson('/health')
}

export async function fetchCustomers(): Promise<{ count: number; customers: Customer[] }> {
  return getJson('/customers')
}

export async function fetchCustomer(customerId: string): Promise<Customer> {
  return getJson(`/customers/${customerId}`)
}

export async function fetchAccounts(customerId: string): Promise<{ accounts: Account[] }> {
  return getJson(`/customers/${customerId}/accounts`)
}

export async function fetchTransactions(customerId: string): Promise<{ transactions: Transaction[] }> {
  return getJson(`/customers/${customerId}/transactions`)
}

export async function fetchInvestments(customerId: string): Promise<{ investments: Investment[] }> {
  return getJson(`/customers/${customerId}/investments`)
}

export async function fetchPortfolio(customerId: string): Promise<PortfolioSummary> {
  return getJson(`/customers/${customerId}/portfolio`)
}

export async function fetchPerformance(customerId: string): Promise<PerformanceSummary> {
  return getJson(`/customers/${customerId}/performance`)
}

export async function fetchRisk(customerId: string): Promise<RiskSummary> {
  return getJson(`/customers/${customerId}/risk`)
}

export async function fetchRiskHistory(customerId: string): Promise<RiskHistory> {
  return getJson(`/customers/${customerId}/risk/history`)
}

export async function fetchRiskContributions(customerId: string): Promise<RiskContributions> {
  return getJson(`/customers/${customerId}/risk/contributions`)
}

export async function fetchInsights(customerId: string): Promise<InsightsSummary> {
  return getJson(`/customers/${customerId}/insights`)
}

export async function fetchImprovements(customerId: string): Promise<ImprovementsSummary> {
  return getJson(`/customers/${customerId}/improvements`)
}

export async function fetchReportTypes(): Promise<ReportTypesResponse> {
  return getJson('/report-types')
}

export async function createReport(
  customerId: string,
  body: { report_type: string } | { question: string },
): Promise<Report> {
  const response = await fetch(`${API_URL}/customers/${customerId}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? `Report request failed with status ${response.status}`)
  }
  return (await response.json()) as Report
}

export async function askCopilot(customerId: string, message: string): Promise<CopilotReply> {
  const response = await fetch(`${API_URL}/customers/${customerId}/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!response.ok) {
    throw new Error(`Copilot request failed with status ${response.status}`)
  }
  return (await response.json()) as CopilotReply
}
