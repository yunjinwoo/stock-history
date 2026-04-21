'use client'

import type { Trade } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

export default function SummaryBar({ trades }: { trades: Trade[] }) {
  const completed = trades.filter(t => t.sellDate && t.profitAmount !== undefined)
  const totalProfit = completed.reduce((s, t) => s + (t.profitAmount ?? 0), 0)
  const avgRate = completed.length
    ? completed.reduce((s, t) => s + (t.profitRate ?? 0), 0) / completed.length
    : 0
  const avgDays = trades.length
    ? trades.reduce((s, t) => s + (t.holdingDays ?? 0), 0) / trades.length
    : 0

  return (
    <div className="bg-white rounded-lg border p-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div>
        <p className="text-gray-400 text-xs">총 거래</p>
        <p className="font-semibold">{trades.length}건</p>
      </div>
      <div>
        <p className="text-gray-400 text-xs">총 손익</p>
        <p className={`font-semibold ${totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
          {totalProfit >= 0 ? '+' : ''}{formatKRW(totalProfit)}
        </p>
      </div>
      <div>
        <p className="text-gray-400 text-xs">평균 수익률</p>
        <p className={`font-semibold ${avgRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
          {completed.length ? formatRate(avgRate) : '-'}
        </p>
      </div>
      <div>
        <p className="text-gray-400 text-xs">평균 보유일</p>
        <p className="font-semibold">{trades.length ? Math.round(avgDays) + '일' : '-'}</p>
      </div>
    </div>
  )
}
