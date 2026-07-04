'use client'

import { useMemo, useState } from 'react'
import type { CoinTrade } from '@/lib/types'
import { formatKRW, formatQty, formatRate } from '@/lib/utils'
import TradeChart from './TradeChart'

interface Props {
  trades: CoinTrade[]
  onEdit: (trade: CoinTrade) => void
  onDelete: (trade: CoinTrade) => void
}

type WinFilter = 'all' | 'win' | 'loss'
type GroupMode = 'week' | 'month'
const COLUMNS_SHOWN = 4

function getWeekStart(d: Date) {
  const day = (d.getDay() + 6) % 7 // 월=0 ... 일=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function fmtMD(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function fmtYM(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 수익률 구간별 색상 + 테두리 두께 (진할수록/두꺼울수록 손익이 큼)
const RATE_TIERS = [
  { id: 'red-700',  label: '+20% 이상',   test: (r: number) => r >= 20,  border: 'border-l-red-700',  text: 'text-red-700',  dot: 'bg-red-700',  width: 'border-l-8' },
  { id: 'red-500',  label: '+10 ~ 20%',  test: (r: number) => r >= 10,  border: 'border-l-red-500',  text: 'text-red-500',  dot: 'bg-red-500',  width: 'border-l-4' },
  { id: 'red-300',  label: '0 ~ 10%',    test: (r: number) => r > 0,    border: 'border-l-red-300',  text: 'text-red-400',  dot: 'bg-red-300',  width: 'border-l-2' },
  { id: 'gray-300', label: '0%',         test: (r: number) => r === 0,  border: 'border-l-gray-300', text: 'text-gray-500', dot: 'bg-gray-300', width: 'border-l-2' },
  { id: 'blue-300', label: '0 ~ -10%',   test: (r: number) => r > -10,  border: 'border-l-blue-300', text: 'text-blue-400', dot: 'bg-blue-300', width: 'border-l-2' },
  { id: 'blue-500', label: '-10 ~ -20%', test: (r: number) => r > -20,  border: 'border-l-blue-500', text: 'text-blue-500', dot: 'bg-blue-500', width: 'border-l-4' },
  { id: 'blue-700', label: '-20% 이하',   test: (_r: number) => true,   border: 'border-l-blue-700', text: 'text-blue-700', dot: 'bg-blue-700', width: 'border-l-8' },
] as const

function rateTier(rate: number) {
  return RATE_TIERS.find(t => t.test(rate))!
}

export default function CoinTimeline({ trades, onEdit, onDelete }: Props) {
  const [winFilter, setWinFilter] = useState<WinFilter>('all')
  const [tierFilters, setTierFilters] = useState<string[]>([])
  const [groupMode, setGroupMode] = useState<GroupMode>('month')
  const [offset, setOffset] = useState(0) // 0 = 이번 주/달이 가장 오른쪽
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function changeGroupMode(mode: GroupMode) {
    setGroupMode(mode)
    setOffset(0)
  }

  function toggleTier(id: string) {
    setTierFilters(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  function toggleExpand(tradeId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(tradeId) ? next.delete(tradeId) : next.add(tradeId)
      return next
    })
  }

  const rows = useMemo(() => {
    return trades
      .filter(t => t.isCompleted)
      .map(t => {
        const entryDate = t.buyEntries.reduce((min, e) => e.date < min ? e.date : min, t.buyEntries[0]?.date ?? t.createdAt)
        const exitDate = t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0]?.date ?? t.createdAt)
        const exitPrice = t.totalSellQuantity > 0 ? t.totalSellAmount / t.totalSellQuantity : 0
        return { trade: t, entryDate, exitDate, exitPrice, isWin: t.profitAmount >= 0 }
      })
      .filter(r => winFilter === 'all' || (winFilter === 'win' ? r.isWin : !r.isWin))
      .filter(r => tierFilters.length === 0 || tierFilters.includes(rateTier(r.trade.profitRate).id))
  }, [trades, winFilter, tierFilters])

  const columns = useMemo(() => {
    if (groupMode === 'week') {
      const thisWeekStart = getWeekStart(new Date())
      return Array.from({ length: COLUMNS_SHOWN }, (_, i) => {
        const backFromNewest = offset + (COLUMNS_SHOWN - 1 - i)
        const start = addDays(thisWeekStart, -backFromNewest * 7)
        const end = addDays(start, 6)
        const startKey = start.toISOString().slice(0, 10)
        const endKey = end.toISOString().slice(0, 10)
        const items = rows
          .filter(r => { const k = r.exitDate.slice(0, 10); return k >= startKey && k <= endKey })
          .sort((a, b) => b.exitDate.localeCompare(a.exitDate))
        const total = items.reduce((s, r) => s + r.trade.profitAmount, 0)
        return { label: `${fmtMD(start)} ~ ${fmtMD(end)}`, items, total }
      })
    }
    const today = new Date()
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    return Array.from({ length: COLUMNS_SHOWN }, (_, i) => {
      const backFromNewest = offset + (COLUMNS_SHOWN - 1 - i)
      const start = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - backFromNewest, 1)
      const prefix = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      const items = rows
        .filter(r => r.exitDate.slice(0, 7) === prefix)
        .sort((a, b) => b.exitDate.localeCompare(a.exitDate))
      const total = items.reduce((s, r) => s + r.trade.profitAmount, 0)
      return { label: fmtYM(start), items, total }
    })
  }, [rows, offset, groupMode])

  const totalCount = rows.length
  const winCount = rows.filter(r => r.isWin).length

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-[160px_1fr] gap-4 items-start">
      {/* 좌측 필터 */}
      <div className="sticky top-16 space-y-3">
        <div className="bg-white rounded-lg border overflow-hidden">
          {([
            ['all', '전체'],
            ['win', '익절'],
            ['loss', '손절'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setWinFilter(v)}
              className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                winFilter === v ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {RATE_TIERS.map(tier => (
            <label key={tier.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={tierFilters.includes(tier.id)}
                onChange={() => toggleTier(tier.id)}
                className="accent-blue-600"
              />
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.dot}`} />
              <span className="text-sm text-gray-700">{tier.label}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-400 px-1 leading-relaxed">
          {totalCount}건<br />익절 {winCount} / 손절 {totalCount - winCount}
        </p>
      </div>

      {/* 우측 주/월별 히스토리 */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex border rounded overflow-hidden text-sm">
            <button
              onClick={() => changeGroupMode('week')}
              className={`px-3 py-1.5 ${groupMode === 'week' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >주별</button>
            <button
              onClick={() => changeGroupMode('month')}
              className={`px-3 py-1.5 ${groupMode === 'month' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >월별</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOffset(o => o + 1)} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-sm border rounded">
              {groupMode === 'week' ? '‹ 이전주' : '‹ 이전달'}
            </button>
            <button
              onClick={() => setOffset(o => Math.max(0, o - 1))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-sm border rounded disabled:opacity-30"
            >
              {groupMode === 'week' ? '다음주 ›' : '다음달 ›'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {columns.map((w, i) => (
            <div key={i} className="space-y-2 min-w-0">
              <div className="bg-gray-50 border rounded px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">{w.label}</span>
                {w.items.length > 0 && (
                  <span className={`text-xs font-semibold ${w.total >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {w.total >= 0 ? '+' : ''}{formatKRW(Math.round(w.total))}
                  </span>
                )}
              </div>

              {w.items.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">거래 없음</p>
              ) : (
                w.items.map(({ trade, exitDate, isWin }) => {
                  const isExpanded = expanded.has(trade.id)
                  const color = rateTier(trade.profitRate)
                  const entries = [
                    ...trade.buyEntries.map(e => ({ ...e, type: '매수' as const })),
                    ...trade.sellEntries.map(e => ({ ...e, type: '매도' as const })),
                  ].sort((a, b) => a.date.localeCompare(b.date))
                  return (
                    <div key={trade.id} className={`bg-white rounded-lg border overflow-hidden space-y-1.5 ${color.width} ${color.border}`}>
                      <div className="p-3 pb-0 space-y-1.5">
                        <div className="flex justify-between items-start gap-1">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm">{trade.symbol}</span>
                            <p className="text-[11px] text-gray-400">
                              <span className="tabular-nums">{exitDate.slice(5, 10)}</span>
                              {' · 보유 '}{trade.holdingDays}일{' · '}
                              <span className={`font-medium ${color.text}`}>{formatRate(trade.profitRate)}</span>
                            </p>
                          </div>
                          <span className={`text-xs font-semibold whitespace-nowrap ${color.text}`}>
                            {isWin ? '+' : ''}{formatKRW(Math.round(trade.profitAmount))}
                          </span>
                        </div>
                        {trade.comment && (
                          <p className="text-xs text-gray-700 bg-gray-50 rounded p-1.5 whitespace-pre-wrap">💬 {trade.comment}</p>
                        )}
                        <div className="flex gap-1.5 justify-end pb-3">
                          <button onClick={() => toggleExpand(trade.id)} className="text-[11px] text-gray-500 hover:text-gray-800 px-1.5 py-0.5 border rounded">
                            {isExpanded ? '▲ 접기' : '▼ 상세'}
                          </button>
                          <button onClick={() => onEdit(trade)} className="text-[11px] text-gray-500 hover:text-gray-800 px-1.5 py-0.5 border rounded">수정</button>
                          <button
                            onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete(trade) }}
                            className="text-[11px] text-red-400 hover:text-red-600 px-1.5 py-0.5 border border-red-200 rounded"
                          >삭제</button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t">
                          <TradeChart
                            buyEntries={trade.buyEntries}
                            sellEntries={trade.sellEntries}
                            avgBuyPrice={trade.avgBuyPrice}
                            isCompleted={trade.isCompleted}
                          />
                          <table className="w-full text-xs border-t">
                            <thead>
                              <tr className="text-[10px] text-gray-400 border-b bg-gray-50">
                                <th className="px-2 py-1 text-center font-normal">구분</th>
                                <th className="px-2 py-1 text-left font-normal">날짜</th>
                                <th className="px-2 py-1 text-right font-normal">단가</th>
                                <th className="px-2 py-1 text-right font-normal">수량</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {entries.map((e, i) => (
                                <tr key={i}>
                                  <td className="px-2 py-1 text-center">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${e.type === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                                      {e.type}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-gray-500">{e.date.slice(5, 10)}</td>
                                  <td className="px-2 py-1 text-right">{formatKRW(e.price)}</td>
                                  <td className="px-2 py-1 text-right">{formatQty(e.quantity)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
