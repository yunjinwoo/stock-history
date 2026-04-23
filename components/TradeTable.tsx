'use client'

import type { Trade, Account } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

interface Props {
  trades: Trade[]
  accounts: Account[]
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

export default function TradeTable({ trades, accounts, onEdit, onDelete }: Props) {
  if (trades.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-3 py-2 text-left font-medium">종목</th>
            <th className="px-3 py-2 text-left font-medium">계좌</th>
            <th className="px-3 py-2 text-center font-medium">상태</th>
            <th className="px-3 py-2 text-right font-medium">평균단가</th>
            <th className="px-3 py-2 text-right font-medium">수량</th>
            <th className="px-3 py-2 text-right font-medium">투자금</th>
            <th className="px-3 py-2 text-right font-medium">손익</th>
            <th className="px-3 py-2 text-right font-medium">수익률</th>
            <th className="px-3 py-2 text-right font-medium">보유일</th>
            <th className="px-3 py-2 text-left font-medium">코멘트</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {trades.map(trade => {
            const account = accounts.find(a => a.id === trade.accountId)
            const profit = trade.profitAmount
            const isPos = profit >= 0

            return (
              <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2">
                  <span className="font-medium">{trade.symbol}</span>
                  {trade.symbolCode && (
                    <span className="text-gray-400 text-xs ml-1">({trade.symbolCode})</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {account ? (account.nickname || account.broker) : '-'}
                </td>
                <td className="px-3 py-2 text-center">
                  {!trade.isCompleted
                    ? <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">보유 {trade.holdingDays}일</span>
                    : <span className={`text-xs px-2 py-0.5 rounded-full ${isPos ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>완료</span>
                  }
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatKRW(Math.round(trade.avgBuyPrice))}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {!trade.isCompleted
                    ? <>{trade.remainingQuantity}<span className="text-gray-400 text-xs">주</span></>
                    : <>{trade.totalBuyQuantity}<span className="text-gray-400 text-xs">주</span></>
                  }
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {!trade.isCompleted
                    ? formatKRW(Math.round(trade.avgBuyPrice * trade.remainingQuantity))
                    : formatKRW(Math.round(trade.totalBuyAmount))
                  }
                </td>
                <td className={`px-3 py-2 text-right font-medium ${trade.isCompleted ? (isPos ? 'text-red-500' : 'text-blue-500') : 'text-gray-300'}`}>
                  {trade.isCompleted
                    ? (isPos ? '+' : '') + formatKRW(Math.round(profit))
                    : '-'
                  }
                </td>
                <td className={`px-3 py-2 text-right font-medium ${trade.isCompleted ? (isPos ? 'text-red-500' : 'text-blue-500') : 'text-gray-300'}`}>
                  {trade.isCompleted ? formatRate(trade.profitRate) : '-'}
                </td>
                <td className="px-3 py-2 text-right text-gray-500">
                  {trade.holdingDays}일
                </td>
                <td className="px-3 py-2 text-gray-400 text-xs max-w-[140px] truncate">
                  {trade.comment || ''}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(trade)}
                      className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border rounded"
                    >수정</button>
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
  )
}
