import { Router } from 'express'
import { getCustomer } from '../data.js'
import type { AdvisorAuth } from '../services/advisorAuth.js'
import { summariseByCustomer, type InteractionStore } from '../services/interactions.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const OVERVIEW_ROWS = 2000
const MAX_NOTE_LENGTH = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Advisor view of what customers have asked the AI, behind the advisor
// password (see services/advisorAuth.ts). In production this needs
// individual advisor accounts, access to own customers only, and logging
// of who looked at what.
export function createAdvisorRouter(store: InteractionStore, auth: AdvisorAuth) {
  const router = Router()

  // POST /advisor/login - body: { password } -> { token, expires_at }
  router.post('/advisor/login', (req, res) => {
    if (!auth.enabled) return res.status(503).json({ error: 'The advisor view is not set up. Set ADVISOR_PASSWORD for the API.' })
    const result = auth.login(req.body?.password, req.ip ?? 'unknown')
    if ('token' in result) return res.json(result)
    if (result.error === 'locked') return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' })
    return res.status(401).json({ error: 'Wrong password.' })
  })

  // Everything else under /advisor needs a valid session token.
  router.use('/advisor', auth.require)

  const customerInfo = (customerId: string) => {
    const customer = getCustomer(customerId)
    return customer
      ? { name: `${customer.first_name} ${customer.last_name}`, risk_profile: customer.risk_profile }
      : { name: null, risk_profile: null }
  }

  // GET /advisor/customers - who has asked what, most recent first.
  router.get('/advisor/customers', async (_req, res, next) => {
    try {
      const rows = await store.list({ limit: OVERVIEW_ROWS })
      res.json({
        storage: store.kind,
        customers: summariseByCustomer(rows).map((c) => ({ ...c, ...customerInfo(c.customer_id) })),
      })
    } catch (error) {
      next(error)
    }
  })

  // GET /advisor/interactions?customer_id=CUST-00001&limit=50
  router.get('/advisor/interactions', async (req, res, next) => {
    const customerId = typeof req.query.customer_id === 'string' && req.query.customer_id ? req.query.customer_id : undefined
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT))
    try {
      const rows = await store.list({ customerId, limit })
      res.json({ storage: store.kind, interactions: rows.map((r) => ({ ...r, customer_name: customerInfo(r.customer_id).name })) })
    } catch (error) {
      next(error)
    }
  })

  // PATCH /advisor/interactions/:id - body: { reviewed: boolean, advisor_note?: string | null }
  router.patch('/advisor/interactions/:id', async (req, res, next) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid interaction id' })
    const { reviewed, advisor_note: note } = req.body ?? {}
    if (typeof reviewed !== 'boolean') return res.status(400).json({ error: '"reviewed" must be true or false' })
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH)) {
      return res.status(400).json({ error: `"advisor_note" must be text of at most ${MAX_NOTE_LENGTH} characters` })
    }
    try {
      const updated = await store.review(req.params.id, { reviewed, advisorNote: note === undefined ? undefined : note?.trim() || null })
      if (!updated) return res.status(404).json({ error: 'Interaction not found' })
      res.json({ ...updated, customer_name: customerInfo(updated.customer_id).name })
    } catch (error) {
      next(error)
    }
  })

  return router
}
