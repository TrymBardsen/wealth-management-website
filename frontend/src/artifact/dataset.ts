// Browser stand-in for api/src/dataset.ts in the artifact build: the same
// JSON files from /data, bundled into the page instead of read from disk.
// vite.artifact.config.ts swaps this in; nothing else changes.
import type { Account, BenchmarkData, Customer, Investment, MarketDataPoint, Transaction } from '../../../api/src/types'
import accountsJson from '../../../data/accounts.json'
import benchmarkJson from '../../../data/benchmarks.json'
import customersJson from '../../../data/customers.json'
import investmentsJson from '../../../data/investments.json'
import marketDataJson from '../../../data/market_data.json'
import transactionsJson from '../../../data/transactions.json'

export const customers = customersJson as Customer[]
export const accounts = accountsJson as Account[]
export const transactions = transactionsJson as Transaction[]
export const investments = investmentsJson as Investment[]
export const marketData = marketDataJson as MarketDataPoint[]
export const benchmark = benchmarkJson as BenchmarkData
