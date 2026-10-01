// Password login for the advisor view.
//
// The password comes from ADVISOR_PASSWORD (api/.env), never from code. A
// correct password returns a signed session token that the advisor
// endpoints require. Tokens are signed with a random key made at startup,
// so restarting the API logs everyone out.
//
// DEMO LEVEL: one shared password. A real bank would use individual
// advisor accounts with SSO/MFA and log who looked at which customer.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const SESSION_HOURS = 8
const MAX_FAILED_LOGINS = 10
const LOCKOUT_MINUTES = 15

const sha256 = (value: string) => createHmac('sha256', 'advisor-password').update(value).digest()
const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url')

export interface AdvisorAuth {
  enabled: boolean
  login(password: unknown, clientKey: string): { token: string; expires_at: string } | { error: 'invalid' | 'locked' }
  verify(token: string | undefined): boolean
  require(req: Request, res: Response, next: NextFunction): void
}

export function createAdvisorAuth(password: string | undefined): AdvisorAuth {
  const signingKey = randomBytes(32)
  const failures = new Map<string, { count: number; resetAt: number }>()
  const sign = (payload: string) => createHmac('sha256', signingKey).update(payload).digest('base64url')

  const verify = (token: string | undefined) => {
    if (!password || !token) return false
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return false
    const expected = Buffer.from(sign(payload))
    const given = Buffer.from(signature)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number }
      return typeof exp === 'number' && exp > Date.now()
    } catch {
      return false
    }
  }

  return {
    enabled: !!password,

    login(attempt, clientKey) {
      const now = Date.now()
      const record = failures.get(clientKey)
      if (record && record.resetAt > now && record.count >= MAX_FAILED_LOGINS) return { error: 'locked' }

      // Compare fixed-length hashes so the check takes the same time
      // however much of the password is right.
      const ok = !!password && typeof attempt === 'string' && timingSafeEqual(sha256(attempt), sha256(password))
      if (!ok) {
        const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + LOCKOUT_MINUTES * 60_000 }
        failures.set(clientKey, { ...current, count: current.count + 1 })
        return { error: 'invalid' }
      }
      failures.delete(clientKey)
      const exp = now + SESSION_HOURS * 3_600_000
      const payload = base64url(JSON.stringify({ exp }))
      return { token: `${payload}.${sign(payload)}`, expires_at: new Date(exp).toISOString() }
    },

    verify,

    require(req, res, next) {
      if (!password) {
        res.status(503).json({ error: 'The advisor view is not set up. Set ADVISOR_PASSWORD for the API.' })
        return
      }
      const header = req.get('authorization') ?? ''
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
      if (!verify(token)) {
        res.status(401).json({ error: 'Log in to the advisor view first.' })
        return
      }
      next()
    },
  }
}
