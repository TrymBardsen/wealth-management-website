// Fetches real daily closing levels for the Oslo Børs Benchmark Index
// (OSEBX) from Yahoo Finance and stores them as a static snapshot in
// /data/benchmarks.json.
//
// Unlike the rest of /data this is REAL market data, used only as a
// reference line to compare the (synthetic) portfolios against. The API
// reads the snapshot at startup, so the demo never depends on Yahoo being
// reachable at runtime. Re-run with `npm run fetch-benchmark` after
// regenerating market data so the date ranges keep overlapping.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const YAHOO_SYMBOL = 'OSEBX.OL'
// Start a little before the first market data date so the index has a
// closing level on or before the portfolio's first day (weekends/holidays).
const LOOKBACK_DAYS = 10

const marketData = JSON.parse(await readFile(path.join(__dirname, 'market_data.json'), 'utf8'))
const dates = marketData.map((p) => p.date).sort()
const start = new Date(`${dates[0]}T00:00:00Z`)
start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS)
const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`)
end.setUTCDate(end.getUTCDate() + 1)

const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO_SYMBOL}`)
url.searchParams.set('period1', String(Math.floor(start.getTime() / 1000)))
url.searchParams.set('period2', String(Math.floor(end.getTime() / 1000)))
url.searchParams.set('interval', '1d')

const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
if (!response.ok) throw new Error(`Yahoo Finance request failed: ${response.status} ${response.statusText}`)
const body = await response.json()
const result = body.chart?.result?.[0]
if (!result) throw new Error(`Unexpected Yahoo Finance response: ${JSON.stringify(body.chart?.error)}`)

// Timestamps are trading-session starts; convert to the Oslo calendar date.
const toOsloDate = (seconds) => new Date(seconds * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' })
const closes = result.indicators.quote[0].close
const series = result.timestamp
  .map((ts, i) => ({ date: toOsloDate(ts), value: closes[i] }))
  .filter((point) => typeof point.value === 'number')
  .map((point) => ({ date: point.date, value: Number(point.value.toFixed(2)) }))

const snapshot = {
  ticker: 'OSEBX',
  name: 'Oslo Børs Benchmark Index',
  currency: result.meta.currency,
  source: `Yahoo Finance (${YAHOO_SYMBOL})`,
  fetched_at: new Date().toISOString(),
  series,
}

await writeFile(path.join(__dirname, 'benchmarks.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
console.log(`Wrote benchmarks.json: ${series.length} trading days (${series[0]?.date} - ${series.at(-1)?.date})`)
