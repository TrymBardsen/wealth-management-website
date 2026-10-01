// Reads the static datasets from /data (Node only). See data.ts.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Account, BenchmarkData, Customer, Investment, MarketDataPoint, Transaction } from './types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Both `src` (via tsx) and `dist` (built) sit directly under /api, so the
// data folder is always two levels up from here.
const DATA_DIR = path.join(__dirname, '..', '..', 'data')

function loadJson<T>(fileName: string): T {
  const filePath = path.join(DATA_DIR, fileName)
  const raw = readFileSync(filePath, 'utf8')
  return JSON.parse(raw) as T
}

export const customers: Customer[] = loadJson<Customer[]>('customers.json')
export const accounts: Account[] = loadJson<Account[]>('accounts.json')
export const transactions: Transaction[] = loadJson<Transaction[]>('transactions.json')
export const investments: Investment[] = loadJson<Investment[]>('investments.json')
export const marketData: MarketDataPoint[] = loadJson<MarketDataPoint[]>('market_data.json')
export const benchmark: BenchmarkData = loadJson<BenchmarkData>('benchmarks.json')
