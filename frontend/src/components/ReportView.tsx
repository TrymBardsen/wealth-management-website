import type { Report } from '../api/types'

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
}

export default function ReportView({ report }: { report: Report }) {
  const byAi = report.generated_by.kind === 'ai'
  return (
    <article className="report">
      <header className="report__header">
        <div className="report__meta">
          <span className={`report__badge report__badge--${report.generated_by.kind}`}>
            {byAi ? `Written by AI (${report.generated_by.model})` : 'Standard report'}
          </span>
          <span>
            Data from {formatDate(report.data_period.start)} to {formatDate(report.data_period.end)}
          </span>
        </div>
        <h3>{report.title}</h3>
        {report.question && <p className="report__question">“{report.question}”</p>}
        {report.generated_by.note && <p className="report__note">{report.generated_by.note}</p>}
        <button type="button" className="report__print" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </header>

      <p className={`report__summary${report.answers_question ? '' : ' report__summary--unanswered'}`}>{report.summary}</p>

      {report.key_figures.length > 0 && (
        <dl className="report__figures">
          {report.key_figures.map((figure) => (
            <div key={`${figure.label}-${figure.value}`} className="report__figure">
              <dt>{figure.label}</dt>
              <dd>{figure.value}</dd>
              <dd className={`report__check${figure.verified ? '' : ' report__check--warn'}`}>
                {figure.verified
                  ? `✓ From ${SOURCE_LABELS[figure.source] ?? figure.source} data`
                  : '⚠ Not found in the data – double-check'}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {report.sections.map((section) => (
        <section key={section.heading} className="report__section">
          <h4>{section.heading}</h4>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      {report.limitations.length > 0 && (
        <section className="report__section report__limitations">
          <h4>Good to know</h4>
          <ul>
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="disclaimer">{report.disclaimer}</p>
    </article>
  )
}
