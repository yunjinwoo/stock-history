'use client'

import { useState } from 'react'
import type { CoinTrade } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

interface Props {
  trades: CoinTrade[]
  onEdit: (trade: CoinTrade) => void
  onDelete: (trade: CoinTrade) => void
}

type EntryRow = { date: string; type: '매수' | '매도'; price: number; quantity: number }

function lastEntryDate(trade: CoinTrade): string {
  const all = [...trade.buyEntries, ...trade.sellEntries]
  if (all.length === 0) return trade.createdAt
  return all.reduce((max, e) => e.date > max ? e.date : max, all[0].date)
}

function formatQty(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(8).replace(/\.?0+$/, '')
}

export default function CoinHistory({ trades, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [simPrices, setSimPrices] = useState<Record<string, string>>({})

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (trades.length === 0) return (
    <p className="text-center text-gray-400 py-16 text-sm">코인 거래 기록이 없습니다<br/>새 거래를 입력해보세요</p>
  )

  const sorted = [...trades].sort((a, b) => lastEntryDate(b).localeCompare(lastEntryDate(a)))

  return (
    <div className="space-y-3">
      {sorted.map(trade => {
        const entries: EntryRow[] = [
          ...trade.buyEntries.map(e => ({ date: e.date, type: '매수' as const, price: e.price, quantity: e.quantity })),
          ...trade.sellEntries.map(e => ({ date: e.date, type: '매도' as const, price: e.price, quantity: e.quantity })),
        ].sort((a, b) => a.date.localeCompare(b.date))

        const isPos = trade.profitAmount >= 0
        const isExpanded = expanded.has(trade.id)

        const simPrice = Number((simPrices[trade.id] ?? '').replace(/,/g, ''))
        const sim = (!trade.isCompleted && simPrice > 0 && trade.avgBuyPrice > 0) ? {
          profit: (simPrice - trade.avgBuyPrice) * trade.remainingQuantity,
          rate: ((simPrice - trade.avgBuyPrice) / trade.avgBuyPrice) * 100,
        } : null

        return (
          <div key={trade.id} className="rounded-lg border bg-white overflow-hidden">
            {/* 헤더 */}
            <div
              className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer select-none"
              onClick={() => toggle(trade.id)}
            >
              <div className="flex items-center gap-2">
                <a
                  href={`https://upbit.com/exchange?code=CRIX.UPBIT.KRW-${trade.symbol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-medium hover:underline"
                >{trade.symbol}</a>
                <span className="text-xs text-gray-400">
                  매수 {trade.buyEntries.length}건{trade.sellEntries.length > 0 ? ` · 매도 ${trade.sellEntries.length}건` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!trade.isCompleted ? (
                  <>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">보유중 {trade.holdingDays}일</span>
                    <span className="text-xs text-gray-500">잔여 {formatQty(trade.remainingQuantity)}</span>
                    {trade.sellEntries.length > 0 && (
                      <>
                        <span className="text-gray-300 text-xs">|</span>
                        <span className="text-xs text-gray-400">일부매도</span>
                        <span className={`text-xs font-medium ${trade.profitAmount >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                          {(trade.profitAmount >= 0 ? '+' : '') + formatKRW(Math.round(trade.profitAmount))}
                        </span>
                        <span className={`text-xs ${trade.profitAmount >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {formatRate(trade.profitRate)}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isPos ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      완료 {formatRate(trade.profitRate)}
                    </span>
                    <span className={`text-xs font-medium ${isPos ? 'text-red-500' : 'text-blue-500'}`}>
                      {(isPos ? '+' : '') + formatKRW(Math.round(trade.profitAmount))}
                    </span>
                  </>
                )}
                <button onClick={e => { e.stopPropagation(); onEdit(trade) }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded">수정</button>
                <button
                  onClick={e => { e.stopPropagation(); if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete(trade) }}
                  className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded"
                >삭제</button>
                <span className="text-gray-300 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* 거래 내역 */}
            {isExpanded && (
              <table className="w-full text-sm border-t">
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
                      <td className="px-4 py-2 text-right">{formatQty(e.quantity)}</td>
                      <td className="px-4 py-2 text-right">{formatKRW(Math.round(e.price * e.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {isExpanded && trade.comment && (
              <div className="px-4 py-1.5 text-xs text-gray-400 border-t bg-gray-50">💬 {trade.comment}</div>
            )}

            {/* 예상 매도가 */}
            {isExpanded && !trade.isCompleted && (
              <div className="px-4 py-3 border-t bg-gray-50">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-400 whitespace-nowrap">예상 매도가</span>
                  <input
                    type="number"
                    value={simPrices[trade.id] ?? ''}
                    onChange={e => setSimPrices(p => ({ ...p, [trade.id]: e.target.value }))}
                    placeholder={String(Math.round(trade.avgBuyPrice))}
                    className="border rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    min="0" step="any"
                  />
                  {sim ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${sim.profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {(sim.profit >= 0 ? '+' : '') + formatKRW(Math.round(sim.profit))}
                      </span>
                      <span className={`text-xs ${sim.profit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>{formatRate(sim.rate)}</span>
                      <span className="text-xs text-gray-400">({formatQty(trade.remainingQuantity)} 기준)</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">가격을 입력하면 예상 손익이 표시됩니다</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
