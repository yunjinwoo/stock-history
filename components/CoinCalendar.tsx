'use client'

import { useState, useMemo } from 'react'
import type { CoinTrade } from '@/lib/types'
import { formatKRW, formatQty } from '@/lib/utils'

interface Props {
  trades: CoinTrade[]
  onEdit: (trade: CoinTrade) => void
  onDelete: (trade: CoinTrade) => void
}

type SellEntry = { trade: CoinTrade; price: number; quantity: number }
type BuyEntry  = { trade: CoinTrade; price: number; quantity: number }
type DayData   = { sells: SellEntry[]; buys: BuyEntry[] }

function sellProfit(s: SellEntry) {
  return (s.price - s.trade.avgBuyPrice) * s.quantity
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function CoinCalendar({ trades, onEdit, onDelete }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const byDate = useMemo(() => {
    const map: Record<string, DayData> = {}
    for (const trade of trades) {
      for (const e of trade.buyEntries) {
        const date = e.date.slice(0, 10)
        const day = map[date] ??= { sells: [], buys: [] }
        day.buys.push({ trade, price: e.price, quantity: e.quantity })
      }
      for (const e of trade.sellEntries) {
        const date = e.date.slice(0, 10)
        const day = map[date] ??= { sells: [], buys: [] }
        day.sells.push({ trade, price: e.price, quantity: e.quantity })
      }
    }
    return map
  }, [trades])

  const recentMonths = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - (5 - i), 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`
      const daySells = Object.entries(byDate)
        .filter(([d]) => d.startsWith(prefix))
        .flatMap(([, day]) => day.sells)
      const total = daySells.reduce((s, e) => s + sellProfit(e), 0)
      const count = daySells.length
      return { year: y, month: m, label: `${m + 1}월`, total, count }
    })
  }, [byDate, year, month])

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

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* 최근 6개월 실현손익 */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-6 divide-x">
          {recentMonths.map((m) => {
            const isCurrent = m.year === year && m.month === month
            const isPos = m.total >= 0
            return (
              <button
                key={`${m.year}-${m.month}`}
                onClick={() => { setYear(m.year); setMonth(m.month); setSelectedDate(null) }}
                className={`px-2 py-3 text-center transition-colors hover:bg-gray-50 ${isCurrent ? 'bg-gray-50' : ''}`}
              >
                <p className={`text-xs mb-1 ${isCurrent ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{m.label}</p>
                {m.count === 0
                  ? <p className="text-xs text-gray-300">-</p>
                  : <>
                      <p className={`text-xs font-medium ${isPos ? 'text-red-500' : 'text-blue-500'}`}>
                        {isPos ? '+' : ''}{formatKRW(Math.round(m.total))}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{m.count}건</p>
                    </>
                }
              </button>
            )
          })}
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-lg">‹</button>
        <span className="font-semibold">{year}년 {month + 1}월</span>
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
              const dayData = byDate[key]
              const hasSells = dayData && dayData.sells.length > 0
              const hasBuys  = dayData && dayData.buys.length > 0
              const hasAny   = hasSells || hasBuys
              const sellTotal = hasSells ? dayData.sells.reduce((s, e) => s + sellProfit(e), 0) : 0
              const isToday    = key === todayKey
              const isSelected = key === selectedDate
              const isSun = di === 6
              const isSat = di === 5

              return (
                <div
                  key={di}
                  onClick={() => hasAny && setSelectedDate(isSelected ? null : key)}
                  className={`min-h-[72px] p-1.5 flex flex-col transition-colors
                    ${hasAny ? 'cursor-pointer hover:bg-gray-50' : ''}
                    ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}
                >
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-0.5
                    ${isToday ? 'bg-gray-800 text-white font-bold'
                      : isSun ? 'text-red-400'
                      : isSat ? 'text-blue-400'
                      : 'text-gray-600'}`}>
                    {day}
                  </span>
                  {hasSells && (
                    <span className={`text-xs font-medium leading-tight ${sellTotal >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      {sellTotal >= 0 ? '+' : ''}{formatKRW(Math.round(sellTotal))}
                    </span>
                  )}
                  {hasAny && (
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {[
                        hasBuys  && `매수 ${dayData.buys.length}건`,
                        hasSells && `매도 ${dayData.sells.length}건`,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 선택일 거래내역 */}
      {selectedDate && byDate[selectedDate] && (
        <div className="space-y-3">
          {(() => {
            const dayData = byDate[selectedDate]
            const daySellProfit = dayData.sells.reduce((s, e) => s + sellProfit(e), 0)
            const tradeMap = new Map<string, CoinTrade>()
            ;[...dayData.buys, ...dayData.sells].forEach(e => tradeMap.set(e.trade.id, e.trade))
            const dayTrades = Array.from(tradeMap.values())

            return (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedDate}
                    {dayData.sells.length > 0 && (
                      <span className={`ml-2 font-semibold ${daySellProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {daySellProfit >= 0 ? '+' : ''}{formatKRW(Math.round(daySellProfit))}
                      </span>
                    )}
                  </span>
                  <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
                </div>

                {dayTrades.map(trade => {
                  const daySells = dayData.sells.filter(e => e.trade.id === trade.id)
                  const dayBuys  = dayData.buys.filter(e => e.trade.id === trade.id)
                  const dayProfit = daySells.reduce((s, e) => s + sellProfit(e), 0)
                  const entries = [
                    ...dayBuys.map(e  => ({ type: '매수' as const, price: e.price, quantity: e.quantity })),
                    ...daySells.map(e => ({ type: '매도' as const, price: e.price, quantity: e.quantity })),
                  ]

                  return (
                    <div key={trade.id} className="rounded-lg border bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://www.upbit.com/exchange?code=CRIX.UPBIT.KRW-${trade.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline text-blue-600"
                          >
                            {trade.symbol} ↗
                          </a>
                          {dayBuys.length > 0  && <span className="text-xs text-blue-500">매수 {dayBuys.length}건</span>}
                          {daySells.length > 0 && <span className="text-xs text-orange-500">매도 {daySells.length}건</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {daySells.length > 0 && (
                            <span className={`text-xs font-medium ${dayProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {dayProfit >= 0 ? '+' : ''}{formatKRW(Math.round(dayProfit))}
                            </span>
                          )}
                          <button onClick={() => onEdit(trade)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded">수정</button>
                          <button
                            onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete(trade) }}
                            className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded"
                          >삭제</button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b bg-gray-50">
                              <th className="px-4 py-1.5 text-center font-normal w-24">구분</th>
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
                                <td className="px-4 py-2 text-right">{formatKRW(e.price)}</td>
                                <td className="px-4 py-2 text-right">{formatQty(e.quantity)}</td>
                                <td className="px-4 py-2 text-right">{formatKRW(Math.round(e.price * e.quantity))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {trade.comment && (
                        <div className="px-4 py-1.5 text-xs text-gray-400 border-t bg-gray-50">💬 {trade.comment}</div>
                      )}
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
