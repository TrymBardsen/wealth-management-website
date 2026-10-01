import { Router } from 'express'
import { getCustomer } from '../data.js'
import { deterministicCopilot } from '../services/copilot.js'
import { interactionFromCopilot, logInteraction, type InteractionStore } from '../services/interactions.js'

export function createCopilotRouter(store: InteractionStore) {
  const router = Router()

  // POST /customers/:customerId/copilot - chat-style Q&A over the customer's
  // own data. Body: { message: string }. Deterministic today; see
  // services/copilot.ts for how a real LLM could be plugged in later.
  router.post('/customers/:customerId/copilot', async (req, res) => {
    const customer = getCustomer(req.params.customerId)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    const message = typeof req.body?.message === 'string' ? req.body.message : ''
    if (!message.trim()) return res.status(400).json({ error: 'Request body must include a non-empty "message" string' })
    const started = performance.now()
    const reply = deterministicCopilot.answer(customer.customer_id, message)
    await logInteraction(store, interactionFromCopilot(customer.customer_id, message.trim(), reply, performance.now() - started))
    res.json(reply)
  })

  return router
}
