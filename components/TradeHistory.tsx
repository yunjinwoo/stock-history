'use client'

import { useState } from 'react'
import type { Trade, Account } from '@/lib/types'
import { formatKRW, formatRate, lastEntryDate } from '@/lib/utils'

interface Props {
  trades: Trade[]
  accounts: Account[]
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

type EntryRow = { date: string; type: '매수' | '매도'; price: number; quantity: number }

export default function TradeHistory({ trades, accounts, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [simPrices, setSimPrices] = useState<Record<string, string>>({})

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function calcSim(trade: Trade, priceStr: string) {
    const price = Number(priceStr.replace(/,/g, ''))
    if (!price || price <= 0) return null
    const profit = (price - trade.avgBuyPrice) * trade.remainingQuantity
    const rate = (profit / (trade.avgBuyPrice * trade.remainingQuantity)) * 100
    return { profit, rate }
  }

  if (trades.length === 0) return (
    <p className="text-center text-gray-400 py-16 text-sm">거래 기록이 없습니다<br/>새 거래를 입력해보세요</p>
  )

  const accountOrder = accounts.map(a => a.id)
  const byAccount = trades.reduce<Record<string, Trade[]>>((acc, t) => {
    ;(acc[t.accountId] ??= []).push(t)
    return acc
  }, {})
  const accountIds = [
    ...accountOrder.filter(id => byAccount[id]),
    ...Object.keys(byAccount).filter(id => !accountOrder.includes(id)),
  ]

  return (
    <div className="space-y-6">
      {accountIds.map(accountId => {
        const account = accounts.find(a => a.id === accountId)
        const accountTrades = [...byAccount[accountId]]
          .sort((a, b) => lastEntryDate(b).localeCompare(lastEntryDate(a)))

        return (
          <div key={accountId}>
            {/* 계좌 헤더 */}
            <div className="flex items-center gap-2 mb-3 pb-1 border-b-2 border-gray-200">
              <span className="font-semibold text-gray-700">
                {account ? (account.nickname || `${account.broker} ${account.accountNumber}`) : '알 수 없는 계좌'}
              </span>
              <span className="text-xs text-gray-400">{accountTrades.length}건</span>
            </div>

            <div className="space-y-3">
              {accountTrades.map(trade => {
                const entries: EntryRow[] = [
                  ...trade.buyEntries.map(e => ({ date: e.date, type: '매수' as const, price: e.price, quantity: e.quantity })),
                  ...trade.sellEntries.map(e => ({ date: e.date, type: '매도' as const, price: e.price, quantity: e.quantity })),
                ].sort((a, b) => a.date.localeCompare(b.date))

                const isPos = trade.profitAmount >= 0

                const isExpanded = expanded.has(trade.id)

                return (
                  <div key={trade.id} className="rounded-lg border bg-white overflow-hidden">
                    {/* 종목 헤더 */}
                    <div
                      className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer select-none"
                      onClick={() => toggle(trade.id)}
                    >
                      <div className="flex items-center gap-2">
                        <a
                          href={trade.symbolCode
                            ? `https://finance.naver.com/item/main.naver?code=${trade.symbolCode}`
                            : `https://finance.naver.com/search/searchList.naver?query=${encodeURIComponent(trade.symbol)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="font-medium hover:underline"
                        >{trade.symbol}</a>
                        {trade.symbolCode && <span className="text-gray-400 text-xs">({trade.symbolCode})</span>}
                        <span className="text-xs text-gray-400">
                          매수 {trade.buyEntries.length}건{trade.sellEntries.length > 0 ? ` · 매도 ${trade.sellEntries.length}건` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!trade.isCompleted ? (
                          <>
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">보유중 {trade.holdingDays}일</span>
                            <span className="text-xs text-gray-500">잔여 {trade.remainingQuantity}주</span>
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

                    {/* 거래 내역 (접기/펼치기) */}
                    {isExpanded && <table className="w-full text-sm border-t">
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

                    </table>}
                    {isExpanded && trade.comment && (
                      <div className="px-4 py-1.5 text-xs text-gray-400 border-t bg-gray-50">💬 {trade.comment}</div>
                    )}
                    {isExpanded && !trade.isCompleted && (
                      <div className="px-4 py-3 border-t bg-gray-50">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-gray-400 whitespace-nowrap">예상 매도가</span>
                          <input
                            type="number"
                            value={simPrices[trade.id] ?? ''}
                            onChange={e => setSimPrices(p => ({ ...p, [trade.id]: e.target.value }))}
                            placeholder={String(Math.round(trade.avgBuyPrice))}
                            className="border rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            min="1"
                          />
                          {(() => {
                            const sim = calcSim(trade, simPrices[trade.id] ?? '')
                            if (!sim) return <span className="text-xs text-gray-300">가격을 입력하면 예상 손익이 표시됩니다</span>
                            const isP = sim.profit >= 0
                            return (
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${isP ? 'text-red-500' : 'text-blue-500'}`}>
                                  {(isP ? '+' : '') + formatKRW(Math.round(sim.profit))}
                                </span>
                                <span className={`text-xs ${isP ? 'text-red-400' : 'text-blue-400'}`}>
                                  {formatRate(sim.rate)}
                                </span>
                                <span className="text-xs text-gray-400">
                                  ({trade.remainingQuantity}주 기준)
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
