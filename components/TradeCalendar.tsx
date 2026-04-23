'use client'

import { useState, useMemo } from 'react'
import type { Trade } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

interface Props {
  trades: Trade[]
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

function lastSellDate(trade: Trade): string | null {
  if (trade.sellEntries.length === 0) return null
  return trade.sellEntries
    .reduce((max, e) => (e.date > max ? e.date : max), trade.sellEntries[0].date)
    .slice(0, 10)
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function TradeCalendar({ trades, onEdit, onDelete }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const byDate = useMemo(() => {
    const map: Record<string, Trade[]> = {}
    for (const trade of trades) {
      if (!trade.isCompleted) continue
      const date = lastSellDate(trade)
      if (!date) continue
      ;(map[date] ??= []).push(trade)
    }
    return map
  }, [trades])

  const monthTotal = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
    return Object.entries(byDate)
      .filter(([d]) => d.startsWith(prefix))
      .reduce((s, [, ts]) => s + ts.reduce((ss, t) => ss + t.profitAmount, 0), 0)
  }, [byDate, year, month])

  // Build calendar grid (Mon-start)
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  const todayKey = today.toISOString().slice(0, 10)

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const selectedTrades = selectedDate ? (byDate[selectedDate] ?? []) : []

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-lg">‹</button>
        <div className="text-center">
          <span className="font-semibold">{year}년 {month + 1}월</span>
          {monthTotal !== 0 && (
            <span className={`ml-2 text-sm font-medium ${monthTotal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {monthTotal >= 0 ? '+' : ''}{formatKRW(Math.round(monthTotal))}
            </span>
          )}
        </div>
        <button onClick={nextMonth} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-lg">›</button>
      </div>

      {/* 캘린더 그리드 */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {DOW_LABELS.map((d, i) => (
            <div key={d} className={`py-2 text-center text-xs font-medium ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x border-b last:border-b-0">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="min-h-[72px] bg-gray-50/50" />
              const key = dateKey(day)
              const dayTrades = byDate[key] ?? []
              const total = dayTrades.reduce((s, t) => s + t.profitAmount, 0)
              const isToday = key === todayKey
              const isSelected = key === selectedDate
              const isSun = di === 6
              const isSat = di === 5

              return (
                <div
                  key={di}
                  onClick={() => dayTrades.length > 0 && setSelectedDate(isSelected ? null : key)}
                  className={`min-h-[72px] p-1.5 flex flex-col transition-colors
                    ${dayTrades.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}
                    ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}
                >
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-0.5
                    ${isToday ? 'bg-gray-800 text-white font-bold'
                      : isSun ? 'text-red-400'
                      : isSat ? 'text-blue-400'
                      : 'text-gray-600'}`}>
                    {day}
                  </span>
                  {dayTrades.length > 0 && (
                    <>
                      <span className={`text-xs font-medium leading-tight ${total >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {total >= 0 ? '+' : ''}{formatKRW(Math.round(total))}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">{dayTrades.length}건</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 선택일 거래내역 */}
      {selectedDate && selectedTrades.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {selectedDate}
              <span className={`ml-2 font-semibold ${selectedTrades.reduce((s, t) => s + t.profitAmount, 0) >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {(() => {
                  const t = selectedTrades.reduce((s, t) => s + t.profitAmount, 0)
                  return (t >= 0 ? '+' : '') + formatKRW(Math.round(t))
                })()}
              </span>
            </span>
            <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
          </div>

          {selectedTrades.map(trade => {
            const isPos = trade.profitAmount >= 0
            const entries = [
              ...trade.buyEntries.map(e => ({ date: e.date, type: '매수' as const, price: e.price, quantity: e.quantity })),
              ...trade.sellEntries.map(e => ({ date: e.date, type: '매도' as const, price: e.price, quantity: e.quantity })),
            ].sort((a, b) => a.date.localeCompare(b.date))

            return (
              <div key={trade.id} className="rounded-lg border bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{trade.symbol}</span>
                    {trade.symbolCode && <span className="text-gray-400 text-xs">({trade.symbolCode})</span>}
                    <span className="text-xs text-gray-400">
                      매수 {trade.buyEntries.length}건{trade.sellEntries.length > 0 ? ` · 매도 ${trade.sellEntries.length}건` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isPos ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      완료 {formatRate(trade.profitRate)}
                    </span>
                    <span className={`text-xs font-medium ${isPos ? 'text-red-500' : 'text-blue-500'}`}>
                      {(isPos ? '+' : '') + formatKRW(Math.round(trade.profitAmount))}
                    </span>
                    <button onClick={() => onEdit(trade)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded">수정</button>
                    <button
                      onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete(trade) }}
                      className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded"
                    >삭제</button>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b bg-gray-50">
                      <th className="px-4 py-1.5 text-center font-normal w-24">구분</th>
                      <th className="px-4 py-1.5 text-left font-normal">날짜</th>
                      <th className="px-4 py-1.5 text-right font-normal">단가</th>
                      <th className="px-4 py-1.5 text-right font-normal">수량</th>
                      <th className="px-4 py-1.5 text-right font-normal">금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.type === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                            {e.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{e.date.slice(0, 10)}</td>
                        <td className="px-4 py-2 text-right">{formatKRW(e.price)}</td>
                        <td className="px-4 py-2 text-right">{e.quantity}주</td>
                        <td className="px-4 py-2 text-right">{formatKRW(e.price * e.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trade.comment && (
                  <div className="px-4 py-1.5 text-xs text-gray-400 border-t bg-gray-50">💬 {trade.comment}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
