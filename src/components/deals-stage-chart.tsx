'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const STAGE_COLORS: Record<string, string> = {
  NEW: '#6366f1',
  QUALIFIED: '#3b82f6',
  PROPOSAL: '#f59e0b',
  NEGOTIATION: '#f97316',
  WON: '#22c55e',
  LOST: '#ef4444',
}

const STAGE_LABELS: Record<string, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
}

export interface DealStageData {
  stage: string
  count: number
  value: number
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
}

interface Props {
  data: DealStageData[]
}

export default function DealsStageChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: STAGE_LABELS[d.stage] || d.stage,
    count: d.count,
    value: d.value,
    stage: d.stage,
  }))

  return (
    <div className='overflow-x-auto'>
      <div className='min-w-[320px]'>
        <ResponsiveContainer width='100%' height={260}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray='3 3' className='stroke-border' />
            <XAxis
              dataKey='name'
              tick={{ fontSize: 12 }}
              className='text-muted-foreground'
            />
            <YAxis tick={{ fontSize: 12 }} className='text-muted-foreground' />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'value') return [formatCurrency(value), 'Value']
                return [value, 'Deals']
              }}
            />
            <Bar dataKey='count' radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={STAGE_COLORS[entry.stage] || '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
