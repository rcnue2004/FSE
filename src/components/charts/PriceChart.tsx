'use client'
import { PricePoint } from '@/types'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'

interface Props {
  priceHistory: PricePoint[]
  color?: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-xl">
        <p className="text-muted text-xs mb-1">{payload[0]?.payload?.tournamentName || label}</p>
        <p className="font-mono font-bold text-accent">${payload[0].value.toFixed(2)}</p>
      </div>
    )
  }
  return null
}

export default function PriceChart({ priceHistory, color = '#00d4aa' }: Props) {
  const data = priceHistory.map((p) => ({
    ...p,
    displayDate: p.date ? format(new Date(p.date), 'MMM d') : '',
  }))

  const prices = data.map((d) => d.price)
  const min = Math.min(...prices) * 0.95
  const max = Math.max(...prices) * 1.05

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={{ fill: color, r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
