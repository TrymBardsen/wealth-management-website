import type { ImprovementIdea, ImprovementsSummary } from '../api/types'
import { RISK_FACTORS } from '../utils/risk'

// Factors whose score moves by less than this are not worth listing.
const MIN_FACTOR_CHANGE = 0.5

function FactorChanges({ idea }: { idea: ImprovementIdea }) {
  const changes = RISK_FACTORS.map((factor) => ({
    ...factor,
    before: idea.before.factors[factor.key],
    after: idea.after.factors[factor.key],
  })).filter((c) => Math.abs(c.after - c.before) >= MIN_FACTOR_CHANGE)
  if (changes.length === 0) return null

  return (
    <ul className="idea-card__factors">
      {changes.map((c) => (
        <li key={c.key}>
          <span className="legend-list__swatch" style={{ background: c.color }} />
          {c.label}: {Math.round(c.before)} → <strong>{Math.round(c.after)}</strong>
        </li>
      ))}
    </ul>
  )
}

function IdeaCard({ idea }: { idea: ImprovementIdea }) {
  const delta = idea.after.risk_score - idea.before.risk_score
  const nowAligned = idea.before.alignment !== 'Aligned' && idea.after.alignment === 'Aligned'

  return (
    <article className="idea-card">
      <h4>{idea.title}</h4>
      <p className="idea-card__why">{idea.why}</p>
      <p>
        <strong>What if:</strong> {idea.what_if}
      </p>
      <div className="idea-card__effect">
        <span>Risk score</span>
        <span className="idea-card__score">
          {idea.before.risk_score} → <strong>{idea.after.risk_score}</strong>
        </span>
        <span className="idea-card__delta">
          ({delta > 0 ? '+' : ''}
          {delta}, {idea.after.risk_category.toLowerCase()})
        </span>
        {nowAligned && <span className="idea-card__badge">Would match your profile</span>}
      </div>
      <FactorChanges idea={idea} />
      <p className="idea-card__tradeoff">
        <strong>Trade-off:</strong> {idea.trade_off}
      </p>
    </article>
  )
}

export default function ImprovementIdeas({ summary }: { summary: ImprovementsSummary }) {
  return (
    <section className="panel">
      <h3>Ideas to explore</h3>
      <p className="panel__lead">
        Each idea simulates one simple change and shows what it would do to your risk score. They are examples to
        understand your risk better, not recommendations.
      </p>
      {summary.ideas.length === 0 ? (
        <p className="empty-state">
          No ideas right now: your portfolio is in line with your profile and not heavily concentrated.
        </p>
      ) : (
        <div className="idea-grid">
          {summary.ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
      <details className="idea-assumptions">
        <summary>Assumptions behind these ideas</summary>
        <ul>
          {summary.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
      <p className="disclaimer">{summary.disclaimer}</p>
    </section>
  )
}
