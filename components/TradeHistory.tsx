'use client'

import type { Trade, Account } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

interface Props {
  trades: Trade[]
  accounts: Account[]
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

type EntryRow = { date: string; type: '매수' | '매도'; price: number; quantity: number }

function firstEntryDate(trade: Trade): string {
  const all = [...trade.buyEntries, ...trade.sellEntries]
  if (all.length === 0) return trade.createdAt
  return all.reduce((min, e) => e.date < min ? e.date : min, all[0].date)
}

export default function TradeHistory({ trades, accounts, onEdit, onDelete }: Props) {
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
          .sort((a, b) => firstEntryDate(b).localeCompare(firstEntryDate(a)))

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

                return (
                  <div key={trade.id} className="rounded-lg border bg-white overflow-hidden">
                    {/* 종목 헤더 */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{trade.symbol}</span>
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
                        <button onClick={() => onEdit(trade)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded">수정</button>
                        <button
                          onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete(trade) }}
                          className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded"
                        >삭제</button>
                      </div>
                    </div>

                    {/* 거래 내역 */}
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
          </div>
        )
      })}
    </div>
  )
}
