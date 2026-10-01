import { createApp } from './app.js'

// Load api/.env (e.g. ANTHROPIC_API_KEY) when present. Never commit that file.
// createApp() reads the environment, so this must run before it is called.
try {
  process.loadEnvFile()
} catch {
  // No .env file: rely on the real environment.
}

const PORT = Number(process.env.PORT ?? 3000)
const app = createApp()

app.listen(PORT, () => {
  console.log(`Wealth Copilot API listening on http://localhost:${PORT}`)
  console.log('All data served by this API is 100% synthetic / fictional.')
  console.log(process.env.DATABASE_URL ? 'AI interaction log: Neon (ai_interactions).' : 'AI interaction log: in memory (no DATABASE_URL).')
  console.log(process.env.ADVISOR_PASSWORD ? 'Advisor view: password protected.' : 'Advisor view: closed (no ADVISOR_PASSWORD).')
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI reports: enabled (Claude).' : 'AI reports: disabled (no ANTHROPIC_API_KEY), using templates.')
})
