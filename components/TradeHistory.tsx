'use client'

import type { Trade, Account } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

interface Props {
  trades: Trade[]
  accounts: Account[]
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

function firstEntryDate(trade: Trade): string {
  const all = [...trade.buyEntries, ...trade.sellEntries]
  if (all.length === 0) return trade.createdAt
  return all.reduce((min, e) => e.date < min ? e.date : min, all[0].date)
}

function avgPrice(entries: { price: number; quantity: number }[]): number {
  const total = entries.reduce((s, e) => s + e.price * e.quantity, 0)
  const qty = entries.reduce((s, e) => s + e.quantity, 0)
  return qty > 0 ? total / qty : 0
}

function dateLabel(entries: { date: string }[]): string {
  if (entries.length === 0) return '-'
  const first = entries.reduce((min, e) => e.date < min ? e.date : min, entries[0].date)
  return entries.length > 1
    ? `${first.slice(0, 10)} 외 ${entries.length - 1}건`
    : first.slice(0, 10)
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
            <div className="flex items-center gap-2 mb-2 pb-1 border-b-2 border-gray-200">
              <span className="font-semibold text-gray-700">
                {account ? (account.nickname || `${account.broker} ${account.accountNumber}`) : '알 수 없는 계좌'}
              </span>
              <span className="text-xs text-gray-400">{accountTrades.length}건</span>
            </div>

            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-400">
                    <th className="px-3 py-2 text-left font-medium text-gray-600" rowSpan={2}>종목</th>
                    <th className="px-3 py-2 text-center font-medium border-l border-blue-100 bg-blue-50 text-blue-600" colSpan={4}>매수</th>
                    <th className="px-3 py-2 text-center font-medium border-l border-orange-100 bg-orange-50 text-orange-500" colSpan={4}>매도</th>
                    <th className="px-3 py-2 text-right font-medium border-l" rowSpan={2}>손익</th>
                    <th className="px-3 py-2 text-right font-medium" rowSpan={2}>수익률</th>
                    <th className="px-3 py-2 text-center font-medium" rowSpan={2}>상태</th>
                    <th className="px-3 py-2 text-left font-medium" rowSpan={2}>코멘트</th>
                    <th className="px-3 py-2" rowSpan={2}></th>
                  </tr>
                  <tr className="border-b bg-gray-50 text-xs text-gray-400">
                    <th className="px-3 py-1.5 text-left font-normal border-l border-blue-100 bg-blue-50">날짜</th>
                    <th className="px-3 py-1.5 text-right font-normal bg-blue-50">단가</th>
                    <th className="px-3 py-1.5 text-right font-normal bg-blue-50">수량</th>
                    <th className="px-3 py-1.5 text-right font-normal bg-blue-50">금액</th>
                    <th className="px-3 py-1.5 text-left font-normal border-l border-orange-100 bg-orange-50">날짜</th>
                    <th className="px-3 py-1.5 text-right font-normal bg-orange-50">단가</th>
                    <th className="px-3 py-1.5 text-right font-normal bg-orange-50">수량</th>
                    <th className="px-3 py-1.5 text-right font-normal bg-orange-50">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {accountTrades.map(trade => {
                    const hasSell = trade.sellEntries.length > 0
                    const sellAvg = hasSell ? avgPrice(trade.sellEntries) : 0
                    const sellTotal = trade.sellEntries.reduce((s, e) => s + e.price * e.quantity, 0)
                    const isPos = trade.profitAmount >= 0

                    return (
                      <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                        {/* 종목 */}
                        <td className="px-3 py-2">
                          <span className="font-medium">{trade.symbol}</span>
                          {trade.symbolCode && <span className="text-gray-400 text-xs ml-1">({trade.symbolCode})</span>}
                        </td>

                        {/* 매수 */}
                        <td className="px-3 py-2 text-xs text-gray-500 border-l border-blue-50">{dateLabel(trade.buyEntries)}</td>
                        <td className="px-3 py-2 text-right">{formatKRW(Math.round(trade.avgBuyPrice))}</td>
                        <td className="px-3 py-2 text-right">{trade.totalBuyQuantity}주</td>
                        <td className="px-3 py-2 text-right">{formatKRW(trade.totalBuyAmount)}</td>

                        {/* 매도 */}
                        <td className="px-3 py-2 text-xs text-gray-500 border-l border-orange-50">
                          {hasSell ? dateLabel(trade.sellEntries) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {hasSell ? formatKRW(Math.round(sellAvg)) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {hasSell ? `${trade.totalSellQuantity}주` : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {hasSell ? formatKRW(sellTotal) : <span className="text-gray-300">-</span>}
                        </td>

                        {/* 손익 */}
                        <td className={`px-3 py-2 text-right font-medium border-l ${trade.isCompleted ? (isPos ? 'text-red-500' : 'text-blue-500') : 'text-gray-300'}`}>
                          {trade.isCompleted ? (isPos ? '+' : '') + formatKRW(Math.round(trade.profitAmount)) : '-'}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${trade.isCompleted ? (isPos ? 'text-red-500' : 'text-blue-500') : 'text-gray-300'}`}>
                          {trade.isCompleted ? formatRate(trade.profitRate) : '-'}
                        </td>

                        {/* 상태 */}
                        <td className="px-3 py-2 text-center">
                          {!trade.isCompleted
                            ? <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">보유 {trade.holdingDays}일</span>
                            : <span className={`text-xs px-2 py-0.5 rounded-full ${isPos ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>완료</span>
                          }
                        </td>

                        {/* 코멘트 */}
                        <td className="px-3 py-2 text-xs text-gray-400 max-w-[180px] truncate">
                          {trade.comment || ''}
                        </td>

                        {/* 액션 */}
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => onEdit(trade)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border rounded">수정</button>
                            <button
                              onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete(trade) }}
                              className="text-xs text-red-300 hover:text-red-500 px-2 py-1 border border-red-100 rounded"
                            >삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
