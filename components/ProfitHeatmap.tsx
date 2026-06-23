'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
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
const GAP = 1
const LABEL_WIDTH = 20

export default function ProfitHeatmap({ dailyProfits }: Props) {
  const [hovered, setHovered] = useState<{ date: string; profit: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(10)

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 364)
    start.setDate(start.getDate() - start.getDay()) // Align to Sunday

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

  // 컨테이너 너비 기반 셀 크기 계산
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const numWeeks = weeks.length || 53
      const available = el.clientWidth - LABEL_WIDTH - GAP
      const size = Math.floor((available - (numWeeks - 1) * GAP) / numWeeks)
      setCellSize(Math.max(7, Math.min(14, size)))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [weeks.length])

  const radius = Math.max(1, Math.floor(cellSize / 5))

  return (
    <div ref={containerRef}>
      {/* Month labels */}
      <div className="flex mb-1" style={{ gap: GAP, marginLeft: LABEL_WIDTH + GAP }}>
        {weeks.map((_, i) => {
          const label = monthLabels.find(m => m.col === i)
          return (
            <div
              key={i}
              style={{ width: cellSize, flexShrink: 0 }}
              className="text-[9px] text-gray-400 overflow-hidden whitespace-nowrap"
            >
              {label ? label.label : ''}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="flex" style={{ gap: GAP }}>
        {/* Weekday labels */}
        <div className="flex flex-col" style={{ gap: GAP, width: LABEL_WIDTH - GAP }}>
          {WEEKDAY_LABELS.map((d, i) => (
            <div
              key={i}
              style={{ height: cellSize }}
              className="text-[9px] text-gray-400 leading-none flex items-center"
            >
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  style={{ width: cellSize, height: cellSize, borderRadius: radius }}
                  className={day.date ? `${cellColor(day.profit)} cursor-pointer hover:opacity-70` : 'bg-transparent'}
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
        <div className="text-xs text-gray-500 h-4 min-w-0">
          {hovered
            ? `${hovered.date} · ${hovered.profit !== 0 ? (hovered.profit > 0 ? '+' : '') + formatKRW(Math.round(hovered.profit)) : '거래 없음'}`
            : ' '}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <span className="text-[9px] text-gray-400">손실</span>
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-blue-500" />
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-blue-300" />
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-blue-200" />
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-gray-100 border border-gray-200" />
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-red-200" />
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-red-300" />
          <div style={{ width: cellSize, height: cellSize, borderRadius: radius }} className="bg-red-500" />
          <span className="text-[9px] text-gray-400">수익</span>
        </div>
      </div>
    </div>
  )
}
