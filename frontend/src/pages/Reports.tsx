import { useEffect, useState, type FormEvent } from 'react'
import { useCustomerContext } from '../context/CustomerContext'
import { createReport, fetchReportTypes } from '../api/client'
import type { Report, ReportTypesResponse } from '../api/types'
import ReportView from '../components/ReportView'

const EXAMPLE_QUESTIONS = [
  'How have my Asian stocks performed?',
  'Lag en rapport om risikoprofilen min',
  'Which investment has helped my portfolio the most?',
]

type Pending = { label: string } | null

export default function Reports() {
  const { selectedCustomerId } = useCustomerContext()
  const [catalog, setCatalog] = useState<ReportTypesResponse | null>(null)
  const [question, setQuestion] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReportTypes()
      .then(setCatalog)
      .catch((err: Error) => setError(err.message))
  }, [])

  // A report belongs to one customer; clear it when the customer changes.
  useEffect(() => {
    setReport(null)
    setError(null)
  }, [selectedCustomerId])

  const run = async (body: { report_type: string } | { question: string }, label: string) => {
    if (!selectedCustomerId || pending) return
    setPending({ label })
    setError(null)
    try {
      const result = await createReport(selectedCustomerId, body)
      setReport(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(null)
    }
  }

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = question.trim()
    if (trimmed) run({ question: trimmed }, trimmed)
  }

  const maxLength = catalog?.max_question_length ?? 500

  return (
    <div className="page">
      <div className="page-heading">
        <p className="eyebrow">Built from your own data</p>
        <h2>Reports</h2>
      </div>

      <section className="panel">
        <h3>Ready-made reports</h3>
        <div className="report-catalog">
          {catalog?.report_types.map((type) => (
            <button
              key={type.id}
              type="button"
              className="report-catalog__item"
              onClick={() => run({ report_type: type.id }, type.title)}
              disabled={!!pending}
            >
              <strong>{type.title}</strong>
              <span>{type.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Ask for a report</h3>
        <p className="panel__lead">
          {catalog?.ai_enabled
            ? 'Describe the report you want. It is written by AI using only your data, and every key figure is checked against it.'
            : 'AI reports are not switched on yet, so only questions about a region or sector (for example "my Asian stocks") can be answered.'}
        </p>
        <form className="report-ask" onSubmit={submitQuestion}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: How have my Asian stocks performed?"
            maxLength={maxLength}
            rows={2}
            aria-label="Report question"
          />
          <div className="report-ask__footer">
            <div className="copilot-suggestions">
              {EXAMPLE_QUESTIONS.map((example) => (
                <button key={example} type="button" onClick={() => setQuestion(example)} disabled={!!pending}>
                  {example}
                </button>
              ))}
            </div>
            <span className="report-ask__count">
              {question.length}/{maxLength}
            </span>
            <button type="submit" className="report-ask__submit" disabled={!!pending || !question.trim()}>
              Create report
            </button>
          </div>
        </form>
      </section>

      {pending && (
        <p className="loading-state" aria-live="polite">
          Creating “{pending.label}”…{catalog?.ai_enabled ? ' AI reports can take up to a minute.' : ''}
        </p>
      )}
      {error && <p className="error-state">Could not create the report: {error}</p>}
      {report && !pending && <ReportView report={report} />}
    </div>
  )
}
