'use client'

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { formatKRW } from '@/lib/utils'

interface Entry {
  date: string
  price: number
  quantity: number
}

interface Props {
  buyEntries: Entry[]
  sellEntries: Entry[]
  avgBuyPrice: number
  isCompleted: boolean
  targetPrice?: number | null
  stopLossPrice?: number | null
  currentPrice?: number | null
}

function toTs(date: string) {
  return new Date(date.slice(0, 10)).getTime()
}

function fmtDate(ts: number) {
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  const { date, y, quantity, label } = point
  if (y == null) return null
  return (
    <div className="bg-white border rounded shadow px-2 py-1.5 text-xs space-y-0.5">
      <p className="text-gray-500">{date?.slice(0, 10)}</p>
      <p className="font-medium">{formatKRW(y)}</p>
      <p className="text-gray-400">{label ?? `${quantity}주`}</p>
    </div>
  )
}

export default function TradeChart({ buyEntries, sellEntries, avgBuyPrice, isCompleted, targetPrice, stopLossPrice, currentPrice }: Props) {
  const buyData = buyEntries.map(e => ({ date: e.date, x: toTs(e.date), y: e.price, quantity: e.quantity }))
  const sellData = sellEntries.map(e => ({ date: e.date, x: toTs(e.date), y: e.price, quantity: e.quantity }))

  const allTs = [...buyData, ...sellData].map(d => d.x)
  const allPrices = [...buyData, ...sellData].map(d => d.y)
  if (allTs.length === 0) return null

  const minTs = Math.min(...allTs)
  const maxTs = isCompleted ? Math.max(...allTs) : Date.now()

  // 보유중인 거래만 오늘 날짜에 평균가/현재가 점을 찍음
  const todayTs = Date.now()
  const todayStr = new Date(todayTs).toISOString()
  const avgData = !isCompleted ? [{ date: todayStr, x: todayTs, y: avgBuyPrice, label: '평균가' }] : []
  const currentData = !isCompleted && currentPrice != null ? [{ date: todayStr, x: todayTs, y: currentPrice, label: '현재가' }] : []

  const refPrices = [targetPrice, stopLossPrice, avgBuyPrice, currentPrice].filter((p): p is number => p != null)
  const minPrice = Math.min(...allPrices, ...refPrices)
  const maxPrice = Math.max(...allPrices, ...refPrices)
  const pad = (maxPrice - minPrice) * 0.2 || maxPrice * 0.1

  return (
    <div className="px-4 pt-3 pb-1 border-t">
      <ResponsiveContainer width="100%" height={160}>
        <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[minTs, maxTs]}
            tickFormatter={fmtDate}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            scale="time"
            ticks={Array.from(new Set([...buyData, ...sellData].map(d => d.x))).sort()}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={[Math.max(0, minPrice - pad), maxPrice + pad]}
            tickFormatter={v => (v != null && !isNaN(v) ? formatKRW(v) : '')}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
          {targetPrice != null && (
            <ReferenceLine
              y={targetPrice}
              stroke="#ef4444"
              strokeDasharray="4 3"
              label={{ value: `목표 ${formatKRW(Math.round(targetPrice))}`, position: 'insideBottomRight', fontSize: 10, fill: '#ef4444' }}
            />
          )}
          {stopLossPrice != null && (
            <ReferenceLine
              y={stopLossPrice}
              stroke="#6b7280"
              strokeDasharray="4 3"
              label={{ value: `손절 ${formatKRW(Math.round(stopLossPrice))}`, position: 'insideBottomRight', fontSize: 10, fill: '#6b7280' }}
            />
          )}
          <Scatter name="매수" data={buyData} fill="#3b82f6" opacity={0.85} />
          <Scatter name="매도" data={sellData} fill="#f97316" opacity={0.85} />
          {avgData.length > 0 && (
            <Scatter name="평균가" data={avgData} fill="#60a5fa" shape="diamond" />
          )}
          {currentData.length > 0 && (
            <Scatter name="현재가" data={currentData} fill="#10b981" shape="star" />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
