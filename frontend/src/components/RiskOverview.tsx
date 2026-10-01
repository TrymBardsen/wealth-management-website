// Building blocks for the top of the Risk page: expected yearly swings
// against the profile, the key facts beside it, and risk per sector that
// opens up to the holdings behind it.
import { useState } from 'react'
import type { AllocationSlice, PerformanceSummary, RiskContribution } from '../api/types'
import { formatCurrency } from '../utils/format'
import {
  PROFILE_MAX_STOCK_SHARE,
  STOCK_ASSET_TYPES,
  maxDrawdown,
  profileBand,
  riskBySector,
  worstDay,
  type ProfileBand,
} from '../utils/reportMetrics'
import { ContributionBars } from './RiskVisuals'

const pct = (value: number, digits = 1) => `${value.toFixed(digits)}%`
const longDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date))
// "Diversified" is a fund label, not a sector a customer would recognise.
const sectorName = (sector: string) => (sector === 'Diversified' ? 'Broad funds' : sector)

const BADGES: Record<ProfileBand, { label: string; tone: string }> = {
  over: { label: 'More risk than your profile', tone: 'warn' },
  within: { label: 'Fits your profile', tone: 'ok' },
  below: { label: 'Less risk than your profile', tone: 'info' },
}

export function SwingCard({
  volatility,
  totalValue,
  range,
  profile,
}: {
  volatility: number
  totalValue: number
  range: [number, number]
  profile: string
}) {
  const max = Math.max(25, Math.ceil(volatility + 5))
  const at = (value: number) => `${Math.min(100, (value / max) * 100)}%`
  const band = profileBand(volatility, range)
  const profileName = profile.toLowerCase()
  const sentence =
    band === 'over'
      ? `Your portfolio swings more (${pct(volatility)} a year) than is typical for a ${profileName} profile (${range[0]}–${range[1]}%).`
      : band === 'below'
        ? `Your portfolio swings less (${pct(volatility)} a year) than is typical for a ${profileName} profile (${range[0]}–${range[1]}%).`
        : `Your portfolio swings ${pct(volatility)} a year, within the typical range for a ${profileName} profile (${range[0]}–${range[1]}%).`

  return (
    <section className="swing-card">
      <h3>Expected swings in a typical year</h3>
      <p className="swing-card__figure">±{pct(volatility)}</p>
      <p className="swing-card__nok">
        That is roughly ±{formatCurrency((volatility / 100) * totalValue)} on a portfolio of {formatCurrency(totalValue)}.
      </p>
      <div className="swing-scale" role="img" aria-label={`You: ${pct(volatility)} a year. Typical for ${profileName}: ${range[0]}–${range[1]}%.`}>
        <span className="swing-scale__you-label" style={{ left: at(volatility) }}>You: {pct(volatility)}</span>
        <div className="swing-scale__track">
          <span className="swing-scale__range" style={{ left: at(range[0]), width: `calc(${at(range[1])} - ${at(range[0])})` }} />
          <span className="swing-scale__dot" style={{ left: at(volatility) }} />
        </div>
        <span className="swing-scale__range-label" style={{ left: `calc((${at(range[0])} + ${at(range[1])}) / 2)` }}>
          Expected for {profileName}
        </span>
        <div className="swing-scale__ends">
          <span>0% · calm</span>
          <span>{max}% · big swings</span>
        </div>
      </div>
      <span className={`swing-badge swing-badge--${BADGES[band].tone}`}>{BADGES[band].label}</span>
      <p className="swing-card__sentence">{sentence}</p>
    </section>
  )
}

export function KeyRiskFacts({
  holdings,
  assetMix,
  performance,
  profile,
}: {
  holdings: RiskContribution[]
  assetMix: AllocationSlice[]
  performance: PerformanceSummary
  profile: string
}) {
  const topSector = riskBySector(holdings)[0]
  const stockShare = assetMix.filter((s) => STOCK_ASSET_TYPES.includes(s.label)).reduce((sum, s) => sum + s.percentage, 0)
  const typicalMax = PROFILE_MAX_STOCK_SHARE[profile] ?? 65
  const worst = worstDay(performance.series)
  const fall = maxDrawdown(performance.series)

  return (
    <aside className="key-facts">
      {topSector && (
        <div className="key-facts__item">
          <span className="key-facts__label">Biggest source of risk</span>
          <strong className="key-facts__value">{sectorName(topSector.sector)}</strong>
          <span className="key-facts__caption">
            {pct(topSector.swing_share_pct)} of the risk · {pct(topSector.value_pct, 0)} of the value
          </span>
        </div>
      )}
      <div className="key-facts__item">
        <span className="key-facts__label">Share in stocks</span>
        <strong className={`key-facts__value${stockShare > typicalMax ? ' key-facts__value--warn' : ''}`}>{pct(stockShare, 0)}</strong>
        <span className="key-facts__caption">Typically up to {typicalMax}% for a {profile.toLowerCase()} profile</span>
      </div>
      {worst && (
        <div className="key-facts__item">
          <span className="key-facts__label">Worst day, last {performance.series.length} days</span>
          <strong className="key-facts__value key-facts__value--down">{pct(worst.pct)}</strong>
          <span className="key-facts__caption">
            {longDate(worst.date)}
            {fall ? ` · biggest fall from peak ${pct(fall.pct)}` : ''}
          </span>
        </div>
      )}
    </aside>
  )
}

export function SectorRiskBars({ holdings }: { holdings: RiskContribution[] }) {
  const sectors = riskBySector(holdings)
  const [selected, setSelected] = useState<string | null>(sectors[0]?.sector ?? null)
  const max = Math.max(...sectors.flatMap((s) => [s.value_pct, s.swing_share_pct]), 1)
  const open = sectors.find((s) => s.sector === selected)

  return (
    <div className="sector-risk">
      <ul className="legend-list">
        <li><span className="legend-list__swatch" style={{ background: 'var(--color-primary)' }} />Share of your money</li>
        <li><span className="legend-list__swatch" style={{ background: '#ea580c' }} />Share of the swings</li>
      </ul>
      <div className="sector-risk__rows">
        {sectors.map((s) => (
          <button
            key={s.sector}
            type="button"
            className={`sector-risk__row${s.sector === selected ? ' sector-risk__row--open' : ''}`}
            aria-expanded={s.sector === selected}
            onClick={() => setSelected(s.sector === selected ? null : s.sector)}
          >
            <span className="sector-risk__name">{sectorName(s.sector)}</span>
            <span className="sector-risk__bars">
              <span className="sector-risk__bar sector-risk__bar--value" style={{ width: `${(s.value_pct / max) * 100}%` }} />
              <span className="sector-risk__num">{pct(s.value_pct, 0)}</span>
              <span className="sector-risk__bar sector-risk__bar--swing" style={{ width: `${(s.swing_share_pct / max) * 100}%` }} />
              <span className="sector-risk__num">{pct(s.swing_share_pct)}</span>
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div className="sector-risk__detail">
          <h4>Behind {sectorName(open.sector)}</h4>
          <ContributionBars holdings={holdings.filter((h) => h.sector === open.sector)} />
        </div>
      )}
    </div>
  )
}
