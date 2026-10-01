import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { createReport } from '../api/client'
import type { Report } from '../api/types'
import { useCustomerContext } from '../context/CustomerContext'
import { METRIC_LIBRARY, MetricCard, findMetric, type ReportData } from './metrics'
import { useReports } from './ReportsLayout'
import { STANDARD_REPORTS, findStandardReport } from './standardReports'

const EXAMPLE_QUESTIONS = [
  'How have my Asian stocks performed?',
  'Lag en rapport om risikoprofilen min',
  'Which investment has helped my portfolio the most?',
]

const SOURCE_LABELS: Record<string, string> = {
  customer: 'your profile',
  portfolio: 'portfolio',
  benchmark: 'Oslo Børs',
  holdings: 'holdings',
  by_geography: 'regions',
  by_sector: 'sectors',
  by_asset_type: 'asset types',
  requested_focus: 'your question',
  risk: 'risk model',
  insights: 'insights',
  improvement_ideas: 'what-if ideas',
}

function formatDate(date: string, withTime = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(date))
}

function ReportIcon() {
  return (
    <span className="report-row__icon" aria-hidden="true">
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="3" width="12" height="14" rx="2" />
        <path d="M7 7h6M7 10h6M7 13h4" />
      </svg>
    </span>
  )
}

function ReportRow({ to, title, description }: { to: string; title: string; description: ReactNode }) {
  return (
    <Link to={to} className="report-row">
      <ReportIcon />
      <span className="report-row__text">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="report-row__chevron" aria-hidden="true">›</span>
    </Link>
  )
}

function DataStatus({ children }: { children: (data: ReportData) => ReactNode }) {
  const { data, loading, error } = useReports()
  if (error) return <p className="error-state">Could not load your data: {error}</p>
  if (loading || !data) return <p className="loading-state">Loading your data…</p>
  if (data.investments.length === 0) return <p className="empty-state">You have no investments yet, so there is nothing to report on.</p>
  return <>{children(data)}</>
}

// --- All reports ----------------------------------------------------------------

export function ReportsHome({ tab }: { tab: 'standard' | 'mine' }) {
  const { saved } = useReports()
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Reports</p>
        <h2>All reports</h2>
      </div>
      <nav className="reports-tabs" aria-label="Report lists">
        <NavLink to="/reports" end>Standard reports ({STANDARD_REPORTS.length})</NavLink>
        <NavLink to="/reports/mine">Your reports ({saved.length})</NavLink>
      </nav>
      {tab === 'standard' ? (
        <div className="report-list">
          {STANDARD_REPORTS.map((r) => (
            <ReportRow key={r.id} to={`/reports/standard/${r.id}`} title={r.title} description={r.description} />
          ))}
        </div>
      ) : saved.length > 0 ? (
        <div className="report-list">
          {saved.map((s) => (
            <ReportRow
              key={s.id}
              to={`/reports/mine/${s.id}`}
              title={s.report.title}
              description={`“${s.report.question}” · ${formatDate(s.saved_at, true)}`}
            />
          ))}
        </div>
      ) : (
        <div className="reports-empty">
          <p>You have not asked for any reports yet. Ask a question about your money and Claude writes a report from your own data.</p>
          <Link to="/reports/ask" className="report-ask__submit">✦ Ask AI</Link>
        </div>
      )}
    </>
  )
}

// --- Metric library -----------------------------------------------------------

export function MetricsLibrary() {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Reports</p>
        <h2>Metrics</h2>
      </div>
      <p className="panel__lead">
        Every card a report can show. Standard reports use fixed sets of them; when you ask the AI, it picks the cards
        that best illustrate its answer.
      </p>
      <DataStatus>{(data) => <div className="metric-stack">{METRIC_LIBRARY.map((m) => <MetricCard key={m.id} metric={m} data={data} />)}</div>}</DataStatus>
    </>
  )
}

// --- Standard report ------------------------------------------------------------

function DataAndAssumptions({ data }: { data: ReportData }) {
  const { performance } = data
  const start = performance.series[0]?.date
  const end = performance.series[performance.series.length - 1]?.date
  return (
    <section className="metric-card">
      <header className="metric-card__header"><h3>Where the numbers come from</h3></header>
      <ul className="data-notes">
        <li><strong>Customers, holdings and prices</strong> are synthetic demo data, made up for this workshop.</li>
        {start && end && <li><strong>Price history</strong> covers {performance.series.length} days, from {formatDate(start)} to {formatDate(end)}.</li>}
        {performance.benchmark && <li><strong>Oslo Børs (OSEBX)</strong> uses real closing levels from {performance.benchmark.source}.</li>}
        <li><strong>History assumes today's holdings</strong>: there is no record of purchases or sales, so past values use what you own now.</li>
        <li><strong>The risk score</strong> is a simplified teaching model, not the bank's suitability assessment.</li>
        <li><strong>Funds labelled "Diversified" or "Global"</strong> are treated as single holdings; what they contain is unknown.</li>
        <li><strong>Profile ranges and market sensitivities</strong> in the cards are illustrative assumptions, explained under "Why am I seeing this?".</li>
      </ul>
    </section>
  )
}

export function StandardReportView() {
  const { reportId } = useParams()
  const report = findStandardReport(reportId)
  if (!report) return <p className="error-state">This report does not exist. <Link to="/reports">Back to all reports</Link></p>
  return (
    <>
      <Link to="/reports" className="reports-back">‹ All reports</Link>
      <div className="page-heading">
        <p className="eyebrow">Standard report</p>
        <h2 className="report-title">{report.title}</h2>
      </div>
      <p className="panel__lead">{report.description}</p>
      <DataStatus>
        {(data) => (
          <div className="metric-stack">
            {report.id === 'data' && <DataAndAssumptions data={data} />}
            {report.metrics.map((id) => {
              const metric = findMetric(id)
              return metric ? <MetricCard key={id} metric={metric} data={data} /> : null
            })}
          </div>
        )}
      </DataStatus>
    </>
  )
}

// --- AI report ------------------------------------------------------------------

function AiReportBody({ report, data }: { report: Report; data: ReportData }) {
  const byAi = report.generated_by.kind === 'ai'
  return (
    <div className="metric-stack">
      <section className="metric-card">
        <header className="metric-card__header">
          <h3>The short answer</h3>
          <span className={`report__badge report__badge--${report.generated_by.kind}`}>
            {byAi ? `Written by AI (${report.generated_by.model})` : 'Standard answer'}
          </span>
        </header>
        {report.generated_by.note && <p className="report__note">{report.generated_by.note}</p>}
        <p className={`report__summary${report.answers_question ? '' : ' report__summary--unanswered'}`}>{report.summary}</p>
        {report.key_figures.length > 0 && (
          <dl className="report__figures">
            {report.key_figures.map((figure) => (
              <div key={`${figure.label}-${figure.value}`} className="report__figure">
                <dt>{figure.label}</dt>
                <dd>{figure.value}</dd>
                <dd className={`report__check${figure.verified ? '' : ' report__check--warn'}`}>
                  {figure.verified ? `✓ From ${SOURCE_LABELS[figure.source] ?? figure.source} data` : '⚠ Not found in the data – double-check'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {(report.metrics ?? []).map((id) => {
        const metric = findMetric(id)
        return metric ? <MetricCard key={id} metric={metric} data={data} /> : null
      })}

      {report.sections.map((section) => (
        <section key={section.heading} className="metric-card">
          <header className="metric-card__header"><h3>{section.heading}</h3></header>
          {section.paragraphs.map((paragraph) => <p key={paragraph} className="metric-card__text">{paragraph}</p>)}
        </section>
      ))}

      {report.limitations.length > 0 && (
        <section className="metric-card">
          <header className="metric-card__header"><h3>Good to know</h3></header>
          <ul className="data-notes">{report.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </section>
      )}
      <p className="disclaimer">{report.disclaimer}</p>
    </div>
  )
}

export function SavedReportView() {
  const { savedId } = useParams()
  const { saved, removeSaved } = useReports()
  const navigate = useNavigate()
  const entry = saved.find((s) => s.id === savedId)
  if (!entry) return <p className="error-state">This report is not saved in this browser. <Link to="/reports/mine">Back to your reports</Link></p>
  const { report } = entry
  return (
    <>
      <Link to="/reports/mine" className="reports-back">‹ Your reports</Link>
      <div className="page-heading">
        <p className="eyebrow">Your report · {formatDate(entry.saved_at, true)}</p>
        <h2 className="report-title">{report.title}</h2>
      </div>
      <p className="report__question">“{report.question}”</p>
      <DataStatus>{(data) => <AiReportBody report={report} data={data} />}</DataStatus>
      <button
        type="button"
        className="reports-delete"
        onClick={() => {
          removeSaved(entry.id)
          navigate('/reports/mine')
        }}
      >
        Delete this report
      </button>
    </>
  )
}

// --- Ask AI ---------------------------------------------------------------------

export function AskAi() {
  const { selectedCustomerId } = useCustomerContext()
  const { catalog, addSaved } = useReports()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const maxLength = catalog?.max_question_length ?? 500

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || !selectedCustomerId || pending) return
    setPending(true)
    setError(null)
    try {
      const report = await createReport(selectedCustomerId, { question: trimmed })
      const entry = addSaved(report)
      if (entry) navigate(`/reports/mine/${entry.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Reports</p>
        <h2>Ask AI for a report</h2>
      </div>
      <p className="panel__lead">
        {catalog?.ai_enabled
          ? 'Describe what you want to know. Claude writes the report from your own data, picks the charts that explain it, and every key figure is checked against your data.'
          : 'The AI writer is not switched on here, so only questions about a region or sector (for example "my Asian stocks") get a full answer.'}
      </p>
      <form className="metric-card report-ask" onSubmit={submit}>
        <label htmlFor="ask-ai-question" className="metric-card__chip">Your question</label>
        <textarea
          id="ask-ai-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="For example: How have my Asian stocks performed?"
          maxLength={maxLength}
          rows={3}
          disabled={pending}
        />
        <div className="report-ask__footer">
          <div className="copilot-suggestions">
            {EXAMPLE_QUESTIONS.map((example) => (
              <button key={example} type="button" onClick={() => setQuestion(example)} disabled={pending}>
                {example}
              </button>
            ))}
          </div>
          <span className="report-ask__count">{question.length}/{maxLength}</span>
          <button type="submit" className="report-ask__submit" disabled={pending || !question.trim()}>
            {pending ? 'Writing…' : 'Create report'}
          </button>
        </div>
        {pending && (
          <p className="loading-state" aria-live="polite">
            {catalog?.ai_enabled ? 'Claude is writing your report. This can take up to a minute.' : 'Creating your report…'}
          </p>
        )}
        {error && <p className="error-state">Could not create the report: {error}</p>}
        {catalog?.logging_enabled && <p className="sharing-note">Your questions and the answers are saved and shared with your private banker.</p>}
      </form>
    </>
  )
}
