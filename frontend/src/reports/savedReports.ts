// "Your reports": AI reports the viewer asked for, kept in this browser per
// customer. A convenience only - the question log for advisors lives in
// the API's database.
import type { Report } from '../api/types'

export interface SavedReport {
  id: string
  saved_at: string
  report: Report
}

const MAX_SAVED = 20
const key = (customerId: string) => `wealth-copilot:reports:${customerId}`

export function loadSavedReports(customerId: string): SavedReport[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(customerId)) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as SavedReport[]).filter((r) => r && r.id && r.report?.title) : []
  } catch {
    return []
  }
}

function store(customerId: string, reports: SavedReport[]) {
  try {
    localStorage.setItem(key(customerId), JSON.stringify(reports))
  } catch {
    // Storage blocked or full: the report is still shown, just not kept.
  }
}

export function saveReport(customerId: string, report: Report): { saved: SavedReport; all: SavedReport[] } {
  const saved = { id: crypto.randomUUID(), saved_at: new Date().toISOString(), report }
  const all = [saved, ...loadSavedReports(customerId)].slice(0, MAX_SAVED)
  store(customerId, all)
  return { saved, all }
}

export function deleteSavedReport(customerId: string, id: string): SavedReport[] {
  const all = loadSavedReports(customerId).filter((r) => r.id !== id)
  store(customerId, all)
  return all
}
