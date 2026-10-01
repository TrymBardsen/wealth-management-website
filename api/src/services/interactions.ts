// Log of every question a customer asks the AI (reports and Copilot) and
// the answer they got, so their private banker can see what they are
// interested in or worried about.
//
// Rows live in the shared Neon table `ai_interactions` (also written by
// other apps on the team), so they follow its format: Norwegian topic and
// flag tags, `status`, `spec` with the full answer, and `reviewed_at` /
// `advisor_note` for the advisor. Without DATABASE_URL an in-memory store
// is used instead (tests, local runs without a database).
//
// IMPORTANT: the advisor endpoints have no login in this demo. In
// production they must sit behind advisor authentication and access
// logging, and customers must be told their questions are shared.
import { neon } from '@neondatabase/serverless'
import { detectFocus, type Report } from './reports.js'

export interface Interaction {
  id: string
  customer_id: string
  created_at: string
  prompt: string
  status: string
  report_title: string | null
  summary: string | null
  customer_notice: string | null
  spec: unknown
  metrics_used: string[]
  topics: string[]
  flags: string[]
  model: string | null
  latency_ms: number
  reviewed_at: string | null
  advisor_note: string | null
}

export type NewInteraction = Omit<Interaction, 'id' | 'created_at' | 'reviewed_at' | 'advisor_note'>

export interface InteractionStore {
  kind: 'neon' | 'memory'
  save(entry: NewInteraction): Promise<void>
  list(filter: { customerId?: string; limit: number }): Promise<Interaction[]>
  review(id: string, update: { reviewed: boolean; advisorNote?: string | null }): Promise<Interaction | null>
}

// ---------------------------------------------------------------------------
// Tagging: what the question is about and what the advisor should notice.
// Same vocabulary as the existing rows in ai_interactions.
// ---------------------------------------------------------------------------

const REPORT_TYPE_TOPICS: Record<string, string[]> = {
  'risk-profile': ['profil-match', 'risikokilder'],
  performance: ['avkastning'],
  regions: ['geografi'],
  diversification: ['spredning'],
}
const COPILOT_INTENT_TOPICS: Record<string, string[]> = {
  performance: ['avkastning'],
  'risk-change': ['risikokilder'],
  diversification: ['spredning'],
  savings: ['sparing'],
  'largest-risks': ['risikokilder'],
}
const KEYWORD_TOPICS: Array<[RegExp, string]> = [
  [/\b(risik\w*|risk\w*|sving\w*|volatil\w*)\b/i, 'risikokilder'],
  [/\b(fall\w*|krakk\w*|crash\w*|drop\w*|nedgang\w*)\b/i, 'markedsfall'],
  [/\b(avkastning\w*|return\w*|perform\w*|gjort det|utvikl\w*)\b/i, 'avkastning'],
  [/\b(spre\w*|diversif\w*|konsentr\w*)\b/i, 'spredning'],
  [/\b(fond\w*|fund\w*|etf\w*)\b/i, 'fondsinnhold'],
  [/\b(spar\w*|sav\w*|budsjett\w*|budget\w*)\b/i, 'sparing'],
  [/\b(profil\w*|profile)\b/i, 'profil-match'],
]
const FLAG_PATTERNS: Array<[RegExp, string]> = [
  [/\b(bør jeg|skal jeg|burde jeg|should i|anbefal\w*|recommend\w*|kjøpe eller selge|selge|sell)\b/i, 'ønsker_råd'],
  [/\b(skremt|bekymr\w*|redd|urolig|nervøs|worried|scared|nervous|afraid)\b/i, 'bekymring'],
  [/\b(annen bank|andre banker|other bank|bitcoin\w*|krypto\w*|crypto\w*|ekstern\w*)\b/i, 'mangler_data'],
]

const unique = (values: string[]) => [...new Set(values)]

export function deriveTopics(prompt: string, base: string[] = []): string[] {
  const focus = detectFocus(prompt)
  const fromFocus = focus
    ? focus.field === 'geography' ? ['geografi'] : focus.label === 'Technology' ? ['teknologieksponering'] : ['sektor']
    : []
  const fromKeywords = KEYWORD_TOPICS.filter(([pattern]) => pattern.test(prompt)).map(([, topic]) => topic)
  const topics = unique([...base, ...fromFocus, ...fromKeywords])
  return topics.length > 0 ? topics : ['annet']
}

export function deriveFlags(prompt: string, answered: boolean): string[] {
  const flags = FLAG_PATTERNS.filter(([pattern]) => pattern.test(prompt)).map(([, flag]) => flag)
  if (!answered) flags.push('ubesvart')
  return unique(flags)
}

export function interactionFromReport(report: Report, latencyMs: number): NewInteraction {
  const fromType = report.report_type ? REPORT_TYPE_TOPICS[report.report_type] ?? [] : []
  return {
    customer_id: report.customer_id,
    prompt: report.question,
    status: report.answers_question ? 'ok' : 'unanswered',
    report_title: report.title,
    summary: report.summary,
    customer_notice: report.generated_by.note ?? null,
    spec: { channel: 'report', report_type: report.report_type, report },
    metrics_used: unique(report.key_figures.map((f) => f.source)),
    topics: deriveTopics(report.question, fromType),
    flags: deriveFlags(report.question, report.answers_question),
    model: report.generated_by.kind === 'ai' ? report.generated_by.model ?? null : 'template',
    latency_ms: Math.round(latencyMs),
  }
}

export function interactionFromCopilot(
  customerId: string,
  message: string,
  reply: { answer: string; matched_intent: string },
  latencyMs: number,
): NewInteraction {
  const answered = reply.matched_intent !== 'fallback' && reply.matched_intent !== 'error'
  return {
    customer_id: customerId,
    prompt: message,
    status: answered ? 'ok' : 'unanswered',
    report_title: null,
    summary: reply.answer,
    customer_notice: null,
    spec: { channel: 'copilot', matched_intent: reply.matched_intent, answer: reply.answer },
    metrics_used: [],
    topics: deriveTopics(message, COPILOT_INTENT_TOPICS[reply.matched_intent] ?? []),
    flags: deriveFlags(message, answered),
    model: 'rule-based',
    latency_ms: Math.round(latencyMs),
  }
}

// ---------------------------------------------------------------------------
// Advisor overview per customer
// ---------------------------------------------------------------------------

export interface CustomerInterest {
  customer_id: string
  question_count: number
  unreviewed_count: number
  last_asked_at: string
  top_topics: string[]
  flags: string[]
}

export function summariseByCustomer(rows: Interaction[]): CustomerInterest[] {
  const groups = new Map<string, Interaction[]>()
  for (const row of rows) groups.set(row.customer_id, [...(groups.get(row.customer_id) ?? []), row])
  return [...groups.entries()]
    .map(([customerId, items]) => {
      const topicCounts = new Map<string, number>()
      for (const topic of items.flatMap((i) => i.topics)) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
      return {
        customer_id: customerId,
        question_count: items.length,
        unreviewed_count: items.filter((i) => !i.reviewed_at).length,
        last_asked_at: items.map((i) => i.created_at).sort().at(-1) ?? '',
        top_topics: [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic]) => topic),
        flags: unique(items.flatMap((i) => i.flags)),
      }
    })
    .sort((a, b) => (a.last_asked_at < b.last_asked_at ? 1 : -1))
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export class MemoryInteractionStore implements InteractionStore {
  kind = 'memory' as const
  private rows: Interaction[] = []

  async save(entry: NewInteraction) {
    this.rows.push({ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString(), reviewed_at: null, advisor_note: null })
  }

  async list({ customerId, limit }: { customerId?: string; limit: number }) {
    return this.rows
      .filter((r) => !customerId || r.customer_id === customerId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
  }

  async review(id: string, { reviewed, advisorNote }: { reviewed: boolean; advisorNote?: string | null }) {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return null
    row.reviewed_at = reviewed ? new Date().toISOString() : null
    if (advisorNote !== undefined) row.advisor_note = advisorNote
    return row
  }
}

// Matches the table other apps already write to; a no-op where it exists.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ai_interactions (
    id uuid PRIMARY KEY,
    customer_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    prompt text NOT NULL,
    status text NOT NULL,
    report_title text,
    summary text,
    customer_notice text,
    spec jsonb,
    metrics_used text[] NOT NULL DEFAULT '{}',
    topics text[] NOT NULL DEFAULT '{}',
    flags text[] NOT NULL DEFAULT '{}',
    tool_trace jsonb NOT NULL DEFAULT '[]',
    model text,
    latency_ms integer NOT NULL DEFAULT 0,
    reviewed_at timestamptz,
    advisor_note text
  )`,
  'CREATE INDEX IF NOT EXISTS ai_interactions_customer_idx ON ai_interactions (customer_id, created_at DESC)',
]

const COLUMNS = `id, customer_id, created_at, prompt, status, report_title, summary, customer_notice, spec,
  metrics_used, topics, flags, model, latency_ms, reviewed_at, advisor_note`

function toInteraction(row: Record<string, unknown>): Interaction {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))
  return { ...(row as unknown as Interaction), created_at: iso(row.created_at) ?? '', reviewed_at: iso(row.reviewed_at) }
}

export class NeonInteractionStore implements InteractionStore {
  kind = 'neon' as const
  private sql: ReturnType<typeof neon>
  private ready: Promise<void> | null = null

  constructor(connectionString: string) {
    this.sql = neon(connectionString)
  }

  private ensureSchema() {
    this.ready ??= (async () => {
      for (const statement of SCHEMA) await this.sql.query(statement)
    })()
    return this.ready
  }

  async save(e: NewInteraction) {
    await this.ensureSchema()
    await this.sql.query(
      `INSERT INTO ai_interactions (id, customer_id, prompt, status, report_title, summary, customer_notice, spec,
         metrics_used, topics, flags, model, latency_ms)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, $8::text[], $9::text[], $10::text[], $11, $12)`,
      [e.customer_id, e.prompt, e.status, e.report_title, e.summary, e.customer_notice, JSON.stringify(e.spec),
        e.metrics_used, e.topics, e.flags, e.model, e.latency_ms],
    )
  }

  async list({ customerId, limit }: { customerId?: string; limit: number }) {
    await this.ensureSchema()
    const rows = customerId
      ? await this.sql.query(`SELECT ${COLUMNS} FROM ai_interactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2`, [customerId, limit])
      : await this.sql.query(`SELECT ${COLUMNS} FROM ai_interactions ORDER BY created_at DESC LIMIT $1`, [limit])
    return (rows as Record<string, unknown>[]).map(toInteraction)
  }

  async review(id: string, { reviewed, advisorNote }: { reviewed: boolean; advisorNote?: string | null }) {
    await this.ensureSchema()
    const rows = (await this.sql.query(
      `UPDATE ai_interactions
         SET reviewed_at = CASE WHEN $2 THEN COALESCE(reviewed_at, now()) ELSE NULL END,
             advisor_note = CASE WHEN $3 THEN $4 ELSE advisor_note END
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, reviewed, advisorNote !== undefined, advisorNote ?? null],
    )) as Record<string, unknown>[]
    return rows[0] ? toInteraction(rows[0]) : null
  }
}

export function createDefaultInteractionStore(): InteractionStore {
  const url = process.env.DATABASE_URL
  return url ? new NeonInteractionStore(url) : new MemoryInteractionStore()
}

// Logging must never break the customer's answer.
export async function logInteraction(store: InteractionStore, entry: NewInteraction) {
  try {
    await store.save(entry)
  } catch (error) {
    console.error(`Could not log AI interaction: ${(error as Error).message}`)
  }
}
