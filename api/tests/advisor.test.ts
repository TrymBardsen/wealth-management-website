import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { MemoryInteractionStore, deriveFlags, deriveTopics, summariseByCustomer, type InteractionStore } from '../src/services/interactions.js'
import { templateReportGenerator } from '../src/services/reportTemplates.js'

const PASSWORD = 'test-password'
let store: MemoryInteractionStore
let app: ReturnType<typeof createApp>
let auth: { Authorization: string }

beforeEach(async () => {
  store = new MemoryInteractionStore()
  app = createApp({ reportGenerator: templateReportGenerator, interactionStore: store, advisorPassword: PASSWORD })
  const login = await request(app).post('/advisor/login').send({ password: PASSWORD })
  auth = { Authorization: `Bearer ${login.body.token}` }
})

describe('logging customer questions', () => {
  it('logs a report question with its answer, topics and flags', async () => {
    await request(app).post('/customers/CUST-00001/reports').send({ question: 'Hvordan har mine asiatiske aksjer gjort det?' })
    const [row] = await store.list({ limit: 10 })
    expect(row.customer_id).toBe('CUST-00001')
    expect(row.prompt).toBe('Hvordan har mine asiatiske aksjer gjort det?')
    expect(row.status).toBe('ok')
    expect(row.report_title).toContain('Asia Pacific')
    expect(row.topics).toEqual(expect.arrayContaining(['geografi', 'avkastning']))
    expect(row.model).toBe('template')
    expect((row.spec as { channel: string }).channel).toBe('report')
  })

  it('logs ready-made reports with the report question', async () => {
    await request(app).post('/customers/CUST-00001/reports').send({ report_type: 'risk-profile' })
    const [row] = await store.list({ limit: 10 })
    expect(row.prompt).toMatch(/risk profile/)
    expect(row.topics).toEqual(expect.arrayContaining(['profil-match', 'risikokilder']))
  })

  it('logs Copilot questions and flags unanswered ones', async () => {
    await request(app).post('/customers/CUST-00001/copilot').send({ message: 'What is the weather tomorrow?' })
    const [row] = await store.list({ limit: 10 })
    expect((row.spec as { channel: string }).channel).toBe('copilot')
    expect(row.status).toBe('unanswered')
    expect(row.flags).toContain('ubesvart')
  })

  it('does not log rejected requests', async () => {
    await request(app).post('/customers/CUST-00001/reports').send({ question: '   ' })
    await request(app).post('/customers/CUST-99999/copilot').send({ message: 'Hi' })
    expect(await store.list({ limit: 10 })).toHaveLength(0)
  })

  it('still answers the customer when logging fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing: InteractionStore = {
      kind: 'memory',
      save: async () => { throw new Error('database down') },
      list: async () => [],
      review: async () => null,
    }
    const res = await request(createApp({ reportGenerator: templateReportGenerator, interactionStore: failing }))
      .post('/customers/CUST-00001/reports').send({ report_type: 'performance' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBeTruthy()
  })
})

describe('advisor endpoints', () => {
  beforeEach(async () => {
    await request(app).post('/customers/CUST-00001/reports').send({ question: 'Bør jeg selge teknologiaksjene mine? Jeg er litt skremt.' })
    await request(app).post('/customers/CUST-00001/copilot').send({ message: 'How has my portfolio performed?' })
    await request(app).post('/customers/CUST-00002/reports').send({ report_type: 'regions' })
  })

  it('summarises who asked what, with names and flags', async () => {
    const res = await request(app).get('/advisor/customers').set(auth)
    expect(res.status).toBe(200)
    expect(res.body.storage).toBe('memory')
    const vilde = res.body.customers.find((c: { customer_id: string }) => c.customer_id === 'CUST-00001')
    expect(vilde).toMatchObject({ name: 'Vilde Solberg', question_count: 2, unreviewed_count: 2 })
    expect(vilde.flags).toEqual(expect.arrayContaining(['ønsker_råd', 'bekymring']))
  })

  it('lists interactions, optionally for one customer', async () => {
    const all = await request(app).get('/advisor/interactions').set(auth)
    const one = await request(app).get('/advisor/interactions?customer_id=CUST-00002').set(auth)
    expect(all.body.interactions).toHaveLength(3)
    expect(one.body.interactions).toHaveLength(1)
    expect(one.body.interactions[0].customer_name).toBe('Elias Karlsen')
  })

  it('lets the advisor mark a question as reviewed with a note, and undo it', async () => {
    const [row] = (await request(app).get('/advisor/interactions').set(auth)).body.interactions
    const reviewed = await request(app).patch(`/advisor/interactions/${row.id}`).set(auth).send({ reviewed: true, advisor_note: ' Ring kunden ' })
    expect(reviewed.status).toBe(200)
    expect(reviewed.body.reviewed_at).toBeTruthy()
    expect(reviewed.body.advisor_note).toBe('Ring kunden')

    const undone = await request(app).patch(`/advisor/interactions/${row.id}`).set(auth).send({ reviewed: false })
    expect(undone.body.reviewed_at).toBeNull()
    expect(undone.body.advisor_note).toBe('Ring kunden')
  })

  it.each([
    ['not-a-uuid', { reviewed: true }, 400],
    ['00000000-0000-4000-8000-000000000000', { reviewed: 'yes' }, 400],
    ['00000000-0000-4000-8000-000000000000', { reviewed: true, advisor_note: 'x'.repeat(1001) }, 400],
    ['00000000-0000-4000-8000-000000000000', { reviewed: true }, 404],
  ])('rejects PATCH %s %j with %i', async (id, body, status) => {
    const res = await request(app).patch(`/advisor/interactions/${id}`).set(auth).send(body)
    expect(res.status).toBe(status)
  })
})

describe('advisor password', () => {
  it('returns a session token for the right password', async () => {
    const res = await request(app).post('/advisor/login').send({ password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.token).toMatch(/^[\w-]+\.[\w-]+$/)
    expect(new Date(res.body.expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects a wrong or missing password', async () => {
    expect((await request(app).post('/advisor/login').send({ password: 'wrong' })).status).toBe(401)
    expect((await request(app).post('/advisor/login').send({})).status).toBe(401)
  })

  it.each([
    ['no token', {}],
    ['a made-up token', { Authorization: 'Bearer abc.def' }],
    ['a tampered token', null],
  ])('blocks the advisor data with %s', async (_name, headers) => {
    const tampered = { Authorization: `${auth.Authorization.slice(0, -2)}xx` }
    for (const path of ['/advisor/customers', '/advisor/interactions']) {
      const res = await request(app).get(path).set(headers ?? tampered)
      expect(res.status).toBe(401)
    }
    const patch = await request(app).patch('/advisor/interactions/00000000-0000-4000-8000-000000000000').set(headers ?? tampered).send({ reviewed: true })
    expect(patch.status).toBe(401)
  })

  it('does not accept a token from another API instance', async () => {
    const other = createApp({ reportGenerator: templateReportGenerator, interactionStore: store, advisorPassword: PASSWORD })
    expect((await request(other).get('/advisor/customers').set(auth)).status).toBe(401)
  })

  it('locks login after too many wrong passwords', async () => {
    for (let i = 0; i < 10; i += 1) await request(app).post('/advisor/login').send({ password: 'wrong' })
    const res = await request(app).post('/advisor/login').send({ password: PASSWORD })
    expect(res.status).toBe(429)
  })

  it('keeps the advisor view closed when no password is configured', async () => {
    const closed = createApp({ reportGenerator: templateReportGenerator, interactionStore: store, advisorPassword: '' })
    expect((await request(closed).post('/advisor/login').send({ password: '' })).status).toBe(503)
    expect((await request(closed).get('/advisor/customers')).status).toBe(503)
  })
})

describe('tagging', () => {
  it('uses the shared Norwegian topic vocabulary', () => {
    expect(deriveTopics('Hvor mye teknologi eier jeg i fondene?')).toEqual(expect.arrayContaining(['teknologieksponering', 'fondsinnhold']))
    expect(deriveTopics('Hva skjer hvis markedet faller 40 %?')).toContain('markedsfall')
    expect(deriveTopics('Kan du gi meg en lasagneoppskrift?')).toEqual(['annet'])
  })

  it('flags requests for advice, worries and data the bank does not have', () => {
    expect(deriveFlags('Bør jeg selge fondet mitt?', true)).toContain('ønsker_råd')
    expect(deriveFlags('Jeg ble skremt da markedet falt', true)).toContain('bekymring')
    expect(deriveFlags('Hva med bitcoinene mine i en annen bank?', true)).toContain('mangler_data')
    expect(deriveFlags('Hvordan har det gått?', false)).toEqual(['ubesvart'])
  })

  it('counts top topics per customer', () => {
    const row = (customer_id: string, topics: string[], created_at: string) =>
      ({ customer_id, topics, flags: [], created_at, reviewed_at: null }) as never
    const [first] = summariseByCustomer([row('A', ['x', 'y'], '2026-01-01'), row('A', ['y'], '2026-01-02')])
    expect(first).toMatchObject({ customer_id: 'A', question_count: 2, top_topics: ['y', 'x'], last_asked_at: '2026-01-02' })
  })
})
