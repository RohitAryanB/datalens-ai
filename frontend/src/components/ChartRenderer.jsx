import React, { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Download, BarChart2 } from 'lucide-react'
import './ChartRenderer.css'

const PALETTE = [
  '#7c6aff', '#23d18b', '#ff9f43', '#54a0ff', '#ff6b9d',
  '#a29bfe', '#00cec9', '#fd79a8', '#fdcb6e', '#6c5ce7'
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      {label && <div className="tooltip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="tooltip-row">
          <span style={{ color: p.color }}>{p.name}:</span>
          <span>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ChartRenderer({ config }) {
  const { chart_type, data, x_key, y_key, title, color } = config
  const [activeIndex, setActiveIndex] = useState(null)

  if (!data?.length) return (
    <div className="chart-empty">
      <BarChart2 size={24} />
      <span>No data to display</span>
    </div>
  )

  const renderChart = () => {
    switch (chart_type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2030" />
              <XAxis
                dataKey={x_key}
                tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Space Mono' }}
                angle={-35} textAnchor="end"
                interval={0}
                tickLine={false}
              />
              <YAxis tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={y_key} fill={color || PALETTE[0]} radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2030" />
              <XAxis
                dataKey={x_key}
                tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Space Mono' }}
                angle={-35} textAnchor="end" interval={0} tickLine={false}
              />
              <YAxis tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone" dataKey={y_key}
                stroke={color || PALETTE[0]} strokeWidth={2.5}
                dot={{ fill: color || PALETTE[0], r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'pie': {
        const total = data.reduce((sum, d) => sum + (Number(d[y_key]) || 0), 0)
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                dataKey={y_key}
                nameKey={x_key}
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={55}
                paddingAngle={2}
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                    opacity={activeIndex === null || activeIndex === i ? 1 : 0.5}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span style={{ color: '#8892a4', fontSize: 12 }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )
      }

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2030" />
              <XAxis
                dataKey={x_key} name={x_key}
                tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Space Mono' }} tickLine={false}
              />
              <YAxis
                dataKey={y_key} name={y_key}
                tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Space Mono' }} tickLine={false} axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={data} fill={color || PALETTE[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        )

      default:
        return <div className="chart-empty">Unsupported chart type: {chart_type}</div>
    }
  }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <span className="chart-title">{title}</span>
        <span className="chart-type-badge">{chart_type}</span>
      </div>
      <div className="chart-body">
        {renderChart()}
      </div>
    </div>
  )
}
