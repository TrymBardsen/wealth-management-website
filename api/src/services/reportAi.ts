// AI report writer using Claude.
//
// Claude never sees the raw database: it gets the deterministic, minimised
// data pack from reports.ts (no names or income) and must answer from it
// alone. The reply is constrained to a JSON schema, every key figure is then
// checked against the data pack, and on any failure (no key, API error,
// refusal, unreadable reply) the deterministic template report is returned
// instead, with a note saying so.
import Anthropic from '@anthropic-ai/sdk'
import { buildDataPack, finaliseReport, type ReportGenerator } from './reports.js'
import { REPORT_SCHEMA, REPORT_SYSTEM_PROMPT, buildUserMessage, parseReportContent, reportQuestion } from './reportPrompt.js'
import { templateContent, templateReportGenerator } from './reportTemplates.js'

export { REPORT_SCHEMA, REPORT_SYSTEM_PROMPT, buildUserMessage, parseReportContent, reportQuestion }

export const DEFAULT_REPORT_MODEL = 'claude-opus-5-5'

export function createClaudeReportGenerator(options: { client?: Anthropic; model?: string } = {}): ReportGenerator {
  const client = options.client ?? new Anthropic({ timeout: 120_000 })
  const model = options.model ?? DEFAULT_REPORT_MODEL

  return {
    kind: 'ai',
    async generate(customerId, request) {
      const pack = buildDataPack(customerId, request.question ?? '')
      const fallback = (note: string) =>
        finaliseReport(customerId, request, pack, templateContent(pack, request), { kind: 'template', note })

      // Nothing to write about: skip the model call entirely.
      if (pack.holdings.length === 0) return templateReportGenerator.generate(customerId, request)

      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          // Retry server-side on another model if a safety classifier declines.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: REPORT_SCHEMA } },
          system: REPORT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserMessage(pack, reportQuestion(request)) }],
        })

        if (response.stop_reason === 'refusal') return fallback('The AI declined this request, so a standard report is shown instead.')
        if (response.stop_reason === 'max_tokens') return fallback('The AI response was cut off, so a standard report is shown instead.')

        const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
        const content = parseReportContent(text)
        if (!content) return fallback('The AI response could not be read, so a standard report is shown instead.')

        return finaliseReport(customerId, request, pack, content, { kind: 'ai', model: response.model })
      } catch (error) {
        // Log the failure without any customer data.
        if (error instanceof Anthropic.APIError) console.error(`Report generation failed: HTTP ${error.status}`)
        else console.error(`Report generation failed: ${(error as Error).message}`)
        return fallback('The AI report writer is unavailable right now, so a standard report is shown instead.')
      }
    },
  }
}

// AI when an API key is configured, otherwise templates only.
export function createDefaultReportGenerator(): ReportGenerator {
  if (!process.env.ANTHROPIC_API_KEY) return templateReportGenerator
  return createClaudeReportGenerator({ model: process.env.REPORT_MODEL || DEFAULT_REPORT_MODEL })
}
