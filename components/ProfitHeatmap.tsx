'use client'

import { useMemo, useState } from 'react'
import { formatKRW } from '@/lib/utils'

interface Props {
  dailyProfits: Record<string, number>
}

function cellColor(profit: number | undefined): string {
  if (profit === undefined) return 'bg-gray-100'
  if (profit > 0) {
    if (profit >= 100000) return 'bg-red-500'
    if (profit >= 50000) return 'bg-red-400'
    if (profit >= 10000) return 'bg-red-300'
    return 'bg-red-200'
  }
  if (profit < 0) {
    if (profit <= -100000) return 'bg-blue-500'
    if (profit <= -50000) return 'bg-blue-400'
    if (profit <= -10000) return 'bg-blue-300'
    return 'bg-blue-200'
  }
  return 'bg-gray-100'
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export default function ProfitHeatmap({ dailyProfits }: Props) {
  const [hovered, setHovered] = useState<{ date: string; profit: number } | null>(null)

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 364)
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay())

    const weeks: { date: string; profit: number | undefined }[][] = []
    const monthLabels: { label: string; col: number }[] = []
    const current = new Date(start)
    let weekIdx = 0
    let lastMonth = -1

    while (current <= today) {
      const week: { date: string; profit: number | undefined }[] = []
      for (let d = 0; d < 7; d++) {
        if (current > today) {
          week.push({ date: '', profit: undefined })
        } else {
          const dateStr = current.toISOString().slice(0, 10)
          week.push({ date: dateStr, profit: dailyProfits[dateStr] })
          if (d === 0 && current.getMonth() !== lastMonth) {
            monthLabels.push({ label: `${current.getMonth() + 1}월`, col: weekIdx })
            lastMonth = current.getMonth()
          }
        }
        current.setDate(current.getDate() + 1)
      }
      weeks.push(week)
      weekIdx++
    }

    return { weeks, monthLabels }
  }, [dailyProfits])

  return (
    <div>
      {/* Month labels */}
      <div className="flex mb-1 ml-5" style={{ gap: '2px' }}>
        {weeks.map((_, i) => {
          const label = monthLabels.find(m => m.col === i)
          return (
            <div key={i} style={{ width: 11, flexShrink: 0 }} className="text-[9px] text-gray-400 overflow-hidden">
              {label ? label.label : ''}
            </div>
          )
        })}
      </div>

      {/* Grid with weekday labels */}
      <div className="flex gap-1">
        {/* Weekday labels */}
        <div className="flex flex-col" style={{ gap: '2px' }}>
          {WEEKDAY_LABELS.map((d, i) => (
            <div key={i} style={{ height: 11 }} className="text-[9px] text-gray-400 leading-none flex items-center w-4">
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex" style={{ gap: '2px' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: '2px' }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  style={{ width: 11, height: 11, borderRadius: 2 }}
                  className={day.date ? `${cellColor(day.profit)} cursor-pointer transition-opacity hover:opacity-70` : 'bg-transparent'}
                  onMouseEnter={() => day.date ? setHovered({ date: day.date, profit: day.profit ?? 0 }) : undefined}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Info bar */}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-gray-500 h-4">
          {hovered
            ? `${hovered.date} · ${hovered.profit !== 0 ? (hovered.profit > 0 ? '+' : '') + formatKRW(Math.round(hovered.profit)) : '거래 없음'}`
            : ' '}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-gray-400">손실</span>
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-blue-500" />
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-blue-300" />
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-blue-200" />
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-gray-100 border border-gray-200" />
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-red-200" />
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-red-300" />
          <div style={{ width: 10, height: 10, borderRadius: 2 }} className="bg-red-500" />
          <span className="text-[9px] text-gray-400">수익</span>
        </div>
      </div>
    </div>
  )
}
