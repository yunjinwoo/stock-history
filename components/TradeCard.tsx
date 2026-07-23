'use client'

import { useState } from 'react'
import type { Trade, Account, TradeImage } from '@/lib/types'
import { formatKRW, formatRate, planStatus } from '@/lib/utils'

const PLAN_TONE_STYLE: Record<'neutral' | 'good' | 'bad', string> = {
  neutral: 'border-gray-200 text-gray-500 bg-white',
  good: 'border-green-200 text-green-600 bg-green-50',
  bad: 'border-orange-200 text-orange-600 bg-orange-50',
}
import TradeImageZone from '@/components/TradeImageZone'

const TYPE_STYLE: Record<string, string> = {
  '코스피': 'bg-blue-50 text-blue-600 border-blue-200',
  '코스닥': 'bg-green-50 text-green-600 border-green-200',
  'ETF':   'bg-purple-50 text-purple-600 border-purple-200',
}

interface Props {
  trade: Trade
  account?: Account
  marketType?: string
  onEdit: () => void
  onDelete: () => void
}

export default function TradeCard({ trade, account, marketType, onEdit, onDelete }: Props) {
  const [showEntries, setShowEntries] = useState(false)
  const [showFullComment, setShowFullComment] = useState(false)
  const [images, setImages] = useState<TradeImage[]>(trade.images)

  const holdingColor =
    trade.holdingDays <= 7  ? 'bg-green-100 text-green-700' :
    trade.holdingDays <= 30 ? 'bg-blue-100 text-blue-700' :
    trade.holdingDays <= 90 ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'

  const statusBadge = !trade.isCompleted
    ? <span className={`text-xs px-2 py-0.5 rounded-full ${holdingColor}`}>보유중 {trade.holdingDays}일</span>
    : <span className={`text-xs px-2 py-0.5 rounded-full ${trade.profitAmount >= 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
        완료 {formatRate(trade.profitRate)} · <span className={holdingColor.split(' ')[1]}>{trade.holdingDays}일</span>
      </span>

  const comment = trade.comment
  const commentPreview = comment && comment.length > 30 ? comment.slice(0, 30) + '...' : comment

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          {marketType && (
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium mr-1.5 ${TYPE_STYLE[marketType] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {marketType}
            </span>
          )}
          <span className="font-semibold">{trade.symbol}</span>
          {trade.symbolCode && <span className="text-gray-400 text-xs ml-1">({trade.symbolCode})</span>}
          {(() => {
            const plan = planStatus(trade)
            return plan && (
              <span className={`text-xs px-1.5 py-0.5 rounded border ml-1.5 ${PLAN_TONE_STYLE[plan.tone]}`}>
                📋 {plan.label}
              </span>
            )
          })()}
          {account && (
            <p className="text-gray-400 text-xs mt-0.5">
              {account.broker} · {account.nickname || account.accountNumber}
            </p>
          )}
        </div>
        {statusBadge}
      </div>

      <div className="text-sm text-gray-600 space-y-0.5">
        {!trade.isCompleted ? (
          <>
            <p>평균단가 {formatKRW(Math.round(trade.avgBuyPrice))} × 잔여 {trade.remainingQuantity}주</p>
            <p>투자금 {formatKRW(Math.round(trade.avgBuyPrice * trade.remainingQuantity))}</p>
            {trade.totalSellQuantity > 0 && (
              <p className="text-gray-400">일부 매도: {trade.totalSellQuantity}주 완료</p>
            )}
          </>
        ) : (
          <>
            <p>평균단가 {formatKRW(Math.round(trade.avgBuyPrice))} → 매도 {formatKRW(Math.round(trade.totalSellAmount / trade.totalSellQuantity))}</p>
            <p className={`font-medium ${trade.profitAmount >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              손익 {(trade.profitAmount >= 0 ? '+' : '')}{formatKRW(Math.round(trade.profitAmount))} · 보유 {trade.holdingDays}일
            </p>
          </>
        )}
      </div>

      <button
        onClick={() => setShowEntries(v => !v)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        {showEntries ? '▲ 내역 접기' : `▼ 매수 ${trade.buyEntries.length}건${trade.sellEntries.length > 0 ? ` / 매도 ${trade.sellEntries.length}건` : ''}`}
      </button>

      {showEntries && (
        <div className="space-y-1 text-xs text-gray-500 bg-gray-50 rounded p-2">
          {trade.buyEntries.length > 0 && (
            <div>
              <p className="font-medium text-gray-600 mb-0.5">매수</p>
              {trade.buyEntries.map(e => (
                <p key={e.id}>{e.date.slice(0, 10)} · {formatKRW(e.price)} × {e.quantity}주 = {formatKRW(e.price * e.quantity)}</p>
              ))}
            </div>
          )}
          {trade.sellEntries.length > 0 && (
            <div className="mt-1">
              <p className="font-medium text-gray-600 mb-0.5">매도</p>
              {trade.sellEntries.map(e => (
                <p key={e.id}>{e.date.slice(0, 10)} · {formatKRW(e.price)} × {e.quantity}주 = {formatKRW(e.price * e.quantity)}</p>
              ))}
            </div>
          )}
        </div>
      )}

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

      <div className="border-t pt-2 mt-1">
        <TradeImageZone tradeId={trade.id} images={images} onUpdate={setImages} />
      </div>

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
