'use client'

import { useState } from 'react'
import type { Trade, Account } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'

interface Props {
  trade: Trade
  account?: Account
  onEdit: () => void
  onDelete: () => void
}

export default function TradeCard({ trade, account, onEdit, onDelete }: Props) {
  const [showFullComment, setShowFullComment] = useState(false)
  const isHolding = !trade.sellDate
  const profit = trade.profitAmount
  const rate = trade.profitRate

  const statusBadge = isHolding
    ? <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">보유중 {trade.holdingDays}일</span>
    : profit !== undefined
      ? <span className={`text-xs px-2 py-0.5 rounded-full ${profit >= 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
          완료 {formatRate(rate ?? 0)}
        </span>
      : <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">매도완료</span>

  const comment = trade.comment
  const commentPreview = comment && comment.length > 30 ? comment.slice(0, 30) + '...' : comment

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <span className="font-semibold">{trade.symbol}</span>
          {trade.symbolCode && <span className="text-gray-400 text-xs ml-1">({trade.symbolCode})</span>}
          {account && (
            <p className="text-gray-400 text-xs mt-0.5">
              {account.broker} · {account.nickname || account.accountNumber}
            </p>
          )}
        </div>
        {statusBadge}
      </div>

      <div className="text-sm text-gray-600 space-y-0.5">
        <p>매수 {formatKRW(trade.buyPrice)} × {trade.buyQuantity}주 = {formatKRW(trade.buyPrice * trade.buyQuantity)}</p>
        {!isHolding && trade.sellPrice && (
          <>
            <p>매도 {formatKRW(trade.sellPrice)} × {trade.sellQuantity}주</p>
            <p className={`font-medium ${(profit ?? 0) >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              손익 {profit !== undefined ? ((profit >= 0 ? '+' : '') + formatKRW(profit)) : '-'}
              {' · '}보유 {trade.holdingDays}일
            </p>
          </>
        )}
      </div>

      {comment && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
          {showFullComment ? (
            <>
              <span>{comment}</span>
              <button onClick={() => setShowFullComment(false)} className="ml-1 text-blue-400">접기</button>
            </>
          ) : (
            <>
              <span>💬 {commentPreview}</span>
              {comment.length > 30 && (
                <button onClick={() => setShowFullComment(true)} className="ml-1 text-blue-400">더보기</button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onEdit} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border rounded">수정</button>
        <button
          onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete() }}
          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 border border-red-200 rounded"
        >삭제</button>
      </div>
    </div>
  )
}
