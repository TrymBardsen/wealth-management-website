import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import {
  fetchImprovements,
  fetchInsights,
  fetchInvestments,
  fetchPerformance,
  fetchPortfolio,
  fetchReportTypes,
  fetchRisk,
  fetchRiskContributions,
  fetchRiskHistory,
} from '../api/client'
import type { Report, ReportTypesResponse } from '../api/types'
import { useCustomerContext } from '../context/CustomerContext'
import { RISK_INSIGHT_IDS } from '../utils/risk'
import { METRIC_LIBRARY, type ReportData } from './metrics'
import { deleteSavedReport, loadSavedReports, saveReport, type SavedReport } from './savedReports'
import { STANDARD_REPORTS } from './standardReports'

export interface ReportsContext {
  data: ReportData | null
  loading: boolean
  error: string | null
  catalog: ReportTypesResponse | null
  saved: SavedReport[]
  addSaved: (report: Report) => SavedReport | null
  removeSaved: (id: string) => void
}

export function useReports() {
  return useOutletContext<ReportsContext>()
}

export default function ReportsLayout() {
  const { selectedCustomerId, selectedCustomer } = useCustomerContext()
  const location = useLocation()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<ReportTypesResponse | null>(null)
  const [saved, setSaved] = useState<SavedReport[]>([])

  useEffect(() => {
    fetchReportTypes().then(setCatalog).catch(() => setCatalog(null))
  }, [])

  useEffect(() => {
    if (!selectedCustomerId || !selectedCustomer) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSaved(loadSavedReports(selectedCustomerId))
    Promise.all([
      fetchPortfolio(selectedCustomerId),
      fetchPerformance(selectedCustomerId),
      fetchRisk(selectedCustomerId),
      fetchRiskHistory(selectedCustomerId),
      fetchRiskContributions(selectedCustomerId),
      fetchInvestments(selectedCustomerId),
      fetchInsights(selectedCustomerId),
      fetchImprovements(selectedCustomerId),
    ])
      .then(([portfolio, performance, risk, history, contributions, investments, insights, improvements]) => {
        if (cancelled) return
        setData({
          customer: selectedCustomer,
          portfolio,
          performance,
          risk,
          history,
          contributions,
          investments: investments.investments,
          insights: insights.insights.filter((i) => RISK_INSIGHT_IDS.includes(i.id)),
          improvements,
        })
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedCustomerId, selectedCustomer])

  const addSaved = useCallback(
    (report: Report) => {
      if (!selectedCustomerId) return null
      const { saved: entry, all } = saveReport(selectedCustomerId, report)
      setSaved(all)
      return entry
    },
    [selectedCustomerId],
  )
  const removeSaved = useCallback(
    (id: string) => selectedCustomerId && setSaved(deleteSavedReport(selectedCustomerId, id)),
    [selectedCustomerId],
  )

  const onReportsHome = location.pathname === '/reports' || location.pathname === '/reports/mine'

  return (
    <div className="reports-shell">
      <aside className="reports-sidebar">
        <NavLink to="/reports/ask" className="reports-ask-button">
          <span aria-hidden="true">✦</span> Ask AI
        </NavLink>
        <nav className="reports-nav" aria-label="Reports">
          <NavLink to="/reports" end className={() => `reports-nav__item${onReportsHome ? ' active' : ''}`}>
            All reports
          </NavLink>
          <NavLink to="/reports" end className="reports-nav__item reports-nav__item--sub">
            Standard reports <span>{STANDARD_REPORTS.length}</span>
          </NavLink>
          <NavLink to="/reports/mine" className="reports-nav__item reports-nav__item--sub">
            Your reports <span>{saved.length}</span>
          </NavLink>
          <NavLink to="/reports/metrics" className="reports-nav__item">
            Metrics <span>{METRIC_LIBRARY.length}</span>
          </NavLink>
        </nav>
      </aside>
      <div className="reports-main">
        <Outlet context={{ data, loading, error, catalog, saved, addSaved, removeSaved } satisfies ReportsContext} />
      </div>
    </div>
  )
}
