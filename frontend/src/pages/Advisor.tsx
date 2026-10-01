import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AdvisorAuthError, advisorLogin, fetchAdvisorCustomers, fetchAdvisorInteractions, reviewInteraction } from '../api/client'
import type { CustomerInterest, Interaction } from '../api/types'

// Tags are stored in the shared Norwegian vocabulary of ai_interactions;
// show readable labels and keep the raw tag as a tooltip.
const TOPIC_LABELS: Record<string, string> = {
  teknologieksponering: 'Tech exposure',
  markedsfall: 'Market falls',
  'profil-match': 'Profile fit',
  fondsinnhold: 'Fund contents',
  risikokilder: 'Risk sources',
  datagrunnlag: 'Data coverage',
  avkastning: 'Returns',
  geografi: 'Regions',
  spredning: 'Diversification',
  sparing: 'Savings',
  sektor: 'Sectors',
  annet: 'Other',
}
const FLAG_LABELS: Record<string, string> = {
  ønsker_råd: 'Wants advice',
  bekymring: 'Worried',
  mangler_data: 'Mentions holdings elsewhere',
  utenfor_tema: 'Off topic',
  ubesvart: 'Not answered',
}
// Flags that call for the advisor to get in touch.
const URGENT_FLAGS = ['ønsker_råd', 'bekymring']
const CHANNEL_LABELS: Record<string, string> = { report: 'Report', copilot: 'Copilot' }

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

function Tags({ topics, flags }: { topics: string[]; flags: string[] }) {
  return (
    <ul className="advisor-tags">
      {flags.map((flag) => (
        <li key={flag} title={flag} className={`advisor-tag advisor-tag--flag${URGENT_FLAGS.includes(flag) ? ' advisor-tag--urgent' : ''}`}>
          {FLAG_LABELS[flag] ?? flag}
        </li>
      ))}
      {topics.map((topic) => (
        <li key={topic} title={topic} className="advisor-tag">
          {TOPIC_LABELS[topic] ?? topic}
        </li>
      ))}
    </ul>
  )
}

// The session token lives only in this tab: closing it logs the advisor out.
const SESSION_KEY = 'advisor-session'
function readSession(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const session = raw ? (JSON.parse(raw) as { token: string; expires_at: string }) : null
    return session && new Date(session.expires_at).getTime() > Date.now() ? session.token : null
  } catch {
    return null
  }
}
function writeSession(session: { token: string; expires_at: string } | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: the advisor simply logs in again next time.
  }
}

function AdvisorLogin({ onLogin, message }: { onLogin: (token: string) => void; message: string | null }) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const session = await advisorLogin(password)
      writeSession(session)
      onLogin(session.token)
    } catch (err) {
      setError((err as Error).message)
      setPassword('')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="panel advisor-login" onSubmit={submit}>
      <h3>Log in as advisor</h3>
      <p className="panel__lead">This page shows what customers have asked the AI. It is for private bankers only.</p>
      {message && <p className="report__note">{message}</p>}
      <label htmlFor="advisor-password">Password</label>
      <input
        id="advisor-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button type="submit" className="report-ask__submit" disabled={pending || !password}>
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      {error && <p className="error-state">{error}</p>}
    </form>
  )
}

function InteractionCard({
  interaction,
  token,
  showCustomer,
  onChange,
  onAuthError,
}: {
  interaction: Interaction
  token: string
  showCustomer: boolean
  onChange: (updated: Interaction) => void
  onAuthError: () => void
}) {
  const [note, setNote] = useState(interaction.advisor_note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channel = interaction.spec?.channel
  const reviewed = !!interaction.reviewed_at

  const save = async (body: { reviewed: boolean; advisor_note?: string | null }) => {
    setSaving(true)
    setError(null)
    try {
      onChange({ ...(await reviewInteraction(token, interaction.id, body)), customer_name: interaction.customer_name })
    } catch (err) {
      if (err instanceof AdvisorAuthError) onAuthError()
      else setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={`advisor-question${reviewed ? ' advisor-question--reviewed' : ''}`}>
      <header className="advisor-question__meta">
        {showCustomer && <strong>{interaction.customer_name ?? interaction.customer_id}</strong>}
        <span>{formatTime(interaction.created_at)}</span>
        <span className="advisor-badge">{channel ? CHANNEL_LABELS[channel] ?? channel : 'Other app'}</span>
        {interaction.status !== 'ok' && <span className="advisor-badge advisor-badge--status">{interaction.status}</span>}
        {reviewed && <span className="advisor-badge advisor-badge--done">Reviewed</span>}
      </header>
      <p className="advisor-question__prompt">“{interaction.prompt}”</p>
      <Tags topics={interaction.topics} flags={interaction.flags} />
      <div className="advisor-question__answer">
        {interaction.report_title && <h4>{interaction.report_title}</h4>}
        {interaction.summary && <p>{interaction.summary}</p>}
        {interaction.customer_notice && <p className="advisor-question__notice">Shown to customer: {interaction.customer_notice}</p>}
      </div>
      <footer className="advisor-question__review">
        <label htmlFor={`note-${interaction.id}`}>Advisor note</label>
        <textarea
          id={`note-${interaction.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="For example: call the customer about their tech exposure"
        />
        <div className="advisor-question__actions">
          <button type="button" disabled={saving} onClick={() => save({ reviewed: !reviewed, advisor_note: note })}>
            {reviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
          </button>
          {note !== (interaction.advisor_note ?? '') && (
            <button type="button" disabled={saving} onClick={() => save({ reviewed, advisor_note: note })}>
              Save note
            </button>
          )}
          <span className="advisor-question__tech">
            {interaction.model ?? 'unknown model'} · {(interaction.latency_ms / 1000).toFixed(1)} s
          </span>
        </div>
        {error && <p className="error-state">{error}</p>}
      </footer>
    </article>
  )
}

export default function Advisor() {
  const [token, setToken] = useState<string | null>(readSession)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerInterest[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false)
  const [storage, setStorage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const logOut = useCallback((message: string | null = null) => {
    writeSession(null)
    setToken(null)
    setAuthMessage(message)
    setStorage(null)
  }, [])
  const expired = useCallback(() => logOut('Your session has ended. Log in again.'), [logOut])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [overview, list] = await Promise.all([
        fetchAdvisorCustomers(token),
        fetchAdvisorInteractions(token, selected ?? undefined),
      ])
      setCustomers(overview.customers)
      setInteractions(list.interactions)
      setStorage(overview.storage)
    } catch (err) {
      if (err instanceof AdvisorAuthError) expired()
      else setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [selected, token, expired])

  useEffect(() => {
    load()
  }, [load])

  const updateInteraction = (updated: Interaction) => {
    setInteractions((current) => current.map((i) => (i.id === updated.id ? updated : i)))
    setCustomers((current) =>
      current.map((c) => {
        if (c.customer_id !== updated.customer_id) return c
        const before = interactions.find((i) => i.id === updated.id)
        const delta = (before?.reviewed_at ? 0 : 1) - (updated.reviewed_at ? 0 : 1)
        return { ...c, unreviewed_count: c.unreviewed_count - delta }
      }),
    )
  }

  const visible = onlyUnreviewed ? interactions.filter((i) => !i.reviewed_at) : interactions
  const totals = {
    customers: customers.length,
    questions: customers.reduce((sum, c) => sum + c.question_count, 0),
    unreviewed: customers.reduce((sum, c) => sum + c.unreviewed_count, 0),
    urgent: customers.filter((c) => c.flags.some((f) => URGENT_FLAGS.includes(f))).length,
  }
  const selectedCustomer = customers.find((c) => c.customer_id === selected)
  // Before the first answer arrives, show a placeholder rather than zeros.
  const figure = (value: number) => (loading && storage === null ? '…' : value)

  const heading = (
    <div className="page-heading advisor-heading">
      <div>
        <p className="eyebrow">For private bankers</p>
        <h2>Advisor view</h2>
      </div>
      {token && (
        <button type="button" className="advisor-refresh" onClick={() => logOut()}>
          Log out
        </button>
      )}
    </div>
  )

  if (!token) {
    return (
      <div className="page">
        {heading}
        <AdvisorLogin
          message={authMessage}
          onLogin={(newToken) => {
            setAuthMessage(null)
            setToken(newToken)
          }}
        />
      </div>
    )
  }

  return (
    <div className="page">
      {heading}
      <p className="advisor-demo-note">
        What your customers have asked the AI, and what it answered. Demo with one shared password: a real bank would
        give each advisor their own login and show only their own customers.
        {storage === 'memory' && ' No database is connected, so questions are only kept until the API restarts.'}
      </p>

      {error ? (
        <p className="error-state">{error}</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><p className="stat-card__label">Customers who asked</p><p className="stat-card__value">{figure(totals.customers)}</p></div>
            <div className="stat-card"><p className="stat-card__label">Questions</p><p className="stat-card__value">{figure(totals.questions)}</p></div>
            <div className="stat-card"><p className="stat-card__label">Not reviewed</p><p className="stat-card__value">{figure(totals.unreviewed)}</p></div>
            <div className="stat-card"><p className="stat-card__label">Customers who want advice or are worried</p><p className="stat-card__value">{figure(totals.urgent)}</p></div>
          </div>

          <div className="advisor-layout">
            <nav className="advisor-customers" aria-label="Customers">
              <button
                type="button"
                className={`advisor-customer${selected === null ? ' advisor-customer--active' : ''}`}
                onClick={() => setSelected(null)}
              >
                <span className="advisor-customer__name">All customers</span>
                <span className="advisor-customer__meta">{totals.questions} questions</span>
              </button>
              {customers.map((c) => (
                <button
                  key={c.customer_id}
                  type="button"
                  className={`advisor-customer${selected === c.customer_id ? ' advisor-customer--active' : ''}`}
                  onClick={() => setSelected(c.customer_id)}
                >
                  <span className="advisor-customer__name">
                    {c.name ?? c.customer_id}
                    {c.unreviewed_count > 0 && <span className="advisor-count">{c.unreviewed_count}</span>}
                  </span>
                  <span className="advisor-customer__meta">
                    {c.name ? `${c.customer_id} · ${c.risk_profile}` : 'Not in this app’s customer data'} · last asked{' '}
                    {formatTime(c.last_asked_at)}
                  </span>
                  <Tags topics={c.top_topics.slice(0, 3)} flags={c.flags.filter((f) => URGENT_FLAGS.includes(f))} />
                </button>
              ))}
              {!loading && customers.length === 0 && <p className="empty-state">No customer has asked the AI anything yet.</p>}
            </nav>

            <section className="advisor-feed">
              <div className="advisor-feed__header">
                <h3>{selectedCustomer ? `${selectedCustomer.name ?? selectedCustomer.customer_id}: questions` : 'Latest questions'}</h3>
                <label className="advisor-toggle">
                  <input type="checkbox" checked={onlyUnreviewed} onChange={(event) => setOnlyUnreviewed(event.target.checked)} />
                  Only not reviewed
                </label>
                <button type="button" className="advisor-refresh" onClick={load} disabled={loading}>
                  {loading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {visible.map((interaction) => (
                <InteractionCard
                  key={interaction.id}
                  interaction={interaction}
                  token={token}
                  showCustomer={!selected}
                  onChange={updateInteraction}
                  onAuthError={expired}
                />
              ))}
              {!loading && visible.length === 0 && <p className="empty-state">Nothing to show here.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
