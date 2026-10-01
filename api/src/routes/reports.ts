import { Router } from 'express'
import { getCustomer } from '../data.js'
import { MAX_QUESTION_LENGTH, REPORT_TYPES, findReportType, type ReportGenerator, type ReportRequest } from '../services/reports.js'

// The generator is injected so tests (and deployments without an API key)
// can use the deterministic templates.
export function createReportsRouter(generator: ReportGenerator) {
  const router = Router()

  // GET /report-types - ready-made reports and whether free-text questions
  // are answered by the AI writer.
  router.get('/report-types', (_req, res) => {
    res.json({
      ai_enabled: generator.kind === 'ai',
      max_question_length: MAX_QUESTION_LENGTH,
      report_types: REPORT_TYPES.map(({ id, title, description }) => ({ id, title, description })),
    })
  })

  // POST /customers/:customerId/reports - body: { report_type } or { question }.
  router.post('/customers/:customerId/reports', async (req, res, next) => {
    const customer = getCustomer(req.params.customerId)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })

    const { report_type: reportType, question } = req.body ?? {}
    if ((reportType === undefined) === (question === undefined)) {
      return res.status(400).json({ error: 'Provide either "report_type" or "question", not both' })
    }
    let request: ReportRequest
    if (reportType !== undefined) {
      const type = typeof reportType === 'string' ? findReportType(reportType) : undefined
      if (!type) return res.status(400).json({ error: `Unknown report_type. Use one of: ${REPORT_TYPES.map((t) => t.id).join(', ')}` })
      request = { report_type: type.id }
    } else {
      const trimmed = typeof question === 'string' ? question.trim() : ''
      if (!trimmed) return res.status(400).json({ error: '"question" must be a non-empty string' })
      if (trimmed.length > MAX_QUESTION_LENGTH) {
        return res.status(400).json({ error: `"question" must be at most ${MAX_QUESTION_LENGTH} characters` })
      }
      request = { question: trimmed }
    }

    try {
      res.json(await generator.generate(customer.customer_id, request))
    } catch (error) {
      next(error)
    }
  })

  return router
}
