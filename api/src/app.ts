// Express app factory - separated from index.ts so tests can import the
// app without binding a real network port.
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { customersRouter } from './routes/customers.js'
import { createReportsRouter } from './routes/reports.js'
import { createCopilotRouter } from './routes/copilot.js'
import { createAdvisorRouter } from './routes/advisor.js'
import { createDefaultInteractionStore, type InteractionStore } from './services/interactions.js'
import { createAdvisorAuth } from './services/advisorAuth.js'
import { createDefaultReportGenerator } from './services/reportAi.js'
import type { ReportGenerator } from './services/reports.js'
import { getAllHoldings, getAllInstruments } from './data.js'
import { loadOpenApiSpec } from './docs.js'

export interface AppOptions {
  // Defaults to Claude when ANTHROPIC_API_KEY is set, otherwise templates.
  reportGenerator?: ReportGenerator
  // Defaults to Neon when DATABASE_URL is set, otherwise in memory.
  interactionStore?: InteractionStore
  // Password for the advisor view. Defaults to ADVISOR_PASSWORD; without
  // one the advisor endpoints stay closed.
  advisorPassword?: string
}

export function createApp(options: AppOptions = {}) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'wealth-copilot-api', timestamp: new Date().toISOString() })
  })

  // API documentation: interactive Swagger UI + the raw OpenAPI document.
  const openApiSpec = loadOpenApiSpec()
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec)
  })
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec))

  const interactionStore = options.interactionStore ?? createDefaultInteractionStore()
  app.use(createReportsRouter(options.reportGenerator ?? createDefaultReportGenerator(), interactionStore))
  app.use(createCopilotRouter(interactionStore))
  app.use(createAdvisorRouter(interactionStore, createAdvisorAuth(options.advisorPassword ?? process.env.ADVISOR_PASSWORD)))
  app.use('/customers', customersRouter)

  // Top-level discovery endpoints for workshop participants.
  app.get('/instruments', (_req, res) => {
    const instruments = getAllInstruments()
    res.json({ count: instruments.length, instruments })
  })

  app.get('/holdings', (_req, res) => {
    const holdings = getAllHoldings()
    res.json({ count: holdings.length, holdings })
  })

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  return app
}
