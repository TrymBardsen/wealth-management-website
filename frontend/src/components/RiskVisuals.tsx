import { Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts'
import type { Investment, RiskContribution, RiskHistory, RiskSummary } from '../api/types'
import { formatCurrency } from '../utils/format'
import { CATEGORY_BANDS, assetTypeColor } from '../utils/risk'

// 0-100 scale with the three risk bands, the band that is typical for the
// customer's profile highlighted, and a marker for the actual score.
export function RiskScale({ score, expected, profile }: { score: number; expected: RiskSummary['risk_category']; profile: string }) {
  return (
    <div className="risk-scale">
      <div className="risk-scale__track">
        {CATEGORY_BANDS.map((band) => (
          <div
            key={band.category}
            className={`risk-scale__band${band.category === expected ? ' risk-scale__band--expected' : ''}`}
            style={{ width: `${band.to - band.from}%` }}
          >
            {band.category}
          </div>
        ))}
        <div className="risk-scale__marker" style={{ left: `${score}%` }}>
          <span>{score}</span>
        </div>
      </div>
      <p className="risk-scale__caption">Highlighted band: typical risk for a “{profile}” profile.</p>
    </div>
  )
}

export interface BarSegment {
  label: string
  value: number
  color: string
  detail: string
}

// Horizontal 100% stacked bar with a legend underneath.
export function StackedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return null
  return (
    <div>
      <div className="stacked-bar">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="stacked-bar__segment"
            style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }}
            title={`${segment.label}: ${segment.detail}`}
          />
        ))}
      </div>
      <ul className="legend-list">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span className="legend-list__swatch" style={{ background: segment.color }} />
            {segment.label} <strong>{segment.detail}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Simple ranked bars, e.g. share per region.
export function BarList({ items }: { items: Array<{ label: string; percentage: number }> }) {
  const max = Math.max(...items.map((i) => i.percentage), 1)
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.label}>
          <span className="bar-list__label">{item.label}</span>
          <span className="bar-list__track">
            <span className="bar-list__fill" style={{ width: `${(item.percentage / max) * 100}%` }} />
          </span>
          <span className="bar-list__value">{item.percentage < 0.5 ? '<1' : item.percentage.toFixed(0)}%</span>
        </li>
      ))}
    </ul>
  )
}

interface TreemapNodeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  color?: string
}

function TreemapNode({ x = 0, y = 0, width = 0, height = 0, name, color }: TreemapNodeProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 44 && height > 22 && (
        <text x={x + 6} y={y + 16} fill="#fff" fontSize={12} fontWeight={600}>
          {name}
        </text>
      )}
    </g>
  )
}

// Every holding as a box sized by its value: big boxes are big bets.
export function HoldingsTreemap({ investments }: { investments: Investment[] }) {
  const data = investments
    .map((inv) => ({
      name: inv.ticker,
      fullName: inv.name,
      assetType: inv.asset_type,
      size: inv.quantity * inv.current_price,
      color: assetTypeColor(inv.asset_type),
    }))
    .sort((a, b) => b.size - a.size)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <Treemap data={data} dataKey="size" nameKey="name" content={<TreemapNode />} isAnimationActive={false}>
        <Tooltip
          formatter={(value: number, _name, item) => [
            formatCurrency(value),
            `${item.payload.fullName} (${item.payload.assetType})`,
          ]}
        />
      </Treemap>
    </ResponsiveContainer>
  )
}

function formatAxisDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(date))
}

// Daily risk score on the full 0-100 scale with the three bands behind it,
// so small moves look small. The band typical for the profile is stronger.
export function RiskHistoryChart({ series, expected }: { series: RiskHistory['series']; expected: RiskSummary['risk_category'] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {CATEGORY_BANDS.map((band) => (
          <ReferenceArea
            key={band.category}
            y1={band.from}
            y2={band.to}
            fill={band.category === expected ? '#dbeafe' : '#f1f5f9'}
            fillOpacity={1}
            ifOverflow="hidden"
            label={{ value: band.category, position: 'insideTopLeft', fontSize: 11, fill: '#64748b' }}
          />
        ))}
        <XAxis dataKey="date" tickFormatter={formatAxisDate} minTickGap={40} />
        <YAxis domain={[0, 100]} ticks={[0, 35, 65, 100]} width={32} />
        <Tooltip
          labelFormatter={(label: string) => formatAxisDate(label)}
          formatter={(value: number) => [`${value} / 100`, 'Risk score']}
        />
        <Line type="stepAfter" dataKey="risk_score" stroke="#0f172a" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function formatShare(pct: number) {
  return pct < 0.5 ? '<1%' : `${pct.toFixed(0)}%`
}

// One row per holding: its share of the money next to its share of the
// swings, so holdings that "punch above their weight" stand out.
export function ContributionBars({ holdings }: { holdings: RiskContribution[] }) {
  const max = Math.max(...holdings.flatMap((h) => [h.value_pct, h.swing_share_pct]), 1)
  return (
    <div className="contribution-bars">
      <div className="contribution-bars__legend">
        <span>
          <span className="legend-list__swatch contribution-bars__swatch--value" />
          Share of your money
        </span>
        <span>
          <span className="legend-list__swatch contribution-bars__swatch--swing" />
          Share of the swings
        </span>
        <span>
          <span className="legend-list__swatch contribution-bars__swatch--outsized" />
          Much more of the swings than of the money
        </span>
      </div>
      {holdings.map((h) => (
        <div key={h.investment_id} className="contribution-bars__row">
          <div className="contribution-bars__name">
            {h.name}
            <span>
              {h.ticker} · {h.asset_type} · {h.sector}
            </span>
          </div>
          <div className="contribution-bars__bars">
            <span className="contribution-bars__bar contribution-bars__bar--value" style={{ width: `${(h.value_pct / max) * 100}%` }} />
            <span className="contribution-bars__value">{formatShare(h.value_pct)}</span>
            <span
              className={`contribution-bars__bar contribution-bars__bar--swing${h.swing_share_pct > h.value_pct * 1.25 ? ' contribution-bars__bar--outsized' : ''}`}
              style={{ width: `${(h.swing_share_pct / max) * 100}%` }}
            />
            <span className="contribution-bars__value">{formatShare(h.swing_share_pct)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
