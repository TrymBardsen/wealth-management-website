import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { AllocationSlice } from '../api/types'

const COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#4b5563']

interface AllocationPieChartProps {
  data: AllocationSlice[]
  title: string
  selected?: string | null
  onSelect?: (label: string | null) => void
}

export default function AllocationPieChart({ data, title, selected = null, onSelect }: AllocationPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="chart-card">
        <h3>{title}</h3>
        <p className="empty-state">No holdings to display.</p>
      </div>
    )
  }

  // Clicking the selected slice again clears the selection.
  const toggle = (label: string) => onSelect?.(selected === label ? null : label)

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={50}
            outerRadius={85}
            paddingAngle={2}
            onClick={(slice: AllocationSlice) => toggle(slice.label)}
            style={{ cursor: onSelect ? 'pointer' : undefined }}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.label}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={selected && selected !== entry.label ? 0.25 : 1}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, _name, props) => [`${props.payload.percentage}%`, props.payload.label]} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="allocation-legend">
        {data.map((entry, index) => (
          <li key={entry.label}>
            <button
              type="button"
              className={`allocation-legend__item${selected === entry.label ? ' allocation-legend__item--selected' : ''}`}
              onClick={() => toggle(entry.label)}
              aria-pressed={selected === entry.label}
              disabled={!onSelect}
            >
              <span className="legend-list__swatch" style={{ background: COLORS[index % COLORS.length] }} />
              {entry.label} <span className="allocation-legend__pct">{entry.percentage < 0.5 ? '<1' : entry.percentage.toFixed(0)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
