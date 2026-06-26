'use client'

import { useState, useMemo } from 'react'
import type { Trade, Account } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'
import TradeChart from './TradeChart'

const TYPE_STYLE: Record<string, string> = {
  코스피: 'bg-blue-50 text-blue-600 border-blue-200',
  코스닥: 'bg-green-50 text-green-600 border-green-200',
  ETF: 'bg-purple-50 text-purple-600 border-purple-200',
}

interface Props {
  trades: Trade[]
  accounts: Account[]
  symbolTypeMap?: Record<string, string>
  defaultExpandedSymbol?: string
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

interface MergedEntry {
  date: string
  type: '매수' | '매도'
  price: number
  quantity: number
  accountName: string
}

interface SymbolGroup {
  symbol: string
  entries: MergedEntry[]
  isAnyHolding: boolean
  totalRemainingQty: number
  weightedAvgBuyPrice: number
  holdingDays: number
  totalProfit: number
  buyCount: number
  sellCount: number
  trades: Trade[]
}

export default function SymbolHistory({ trades, accounts, symbolTypeMap = {}, defaultExpandedSymbol, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    defaultExpandedSymbol ? new Set([defaultExpandedSymbol]) : new Set()
  )

  function toggle(symbol: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      return next
    })
  }

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {}
    accounts.forEach(a => { m[a.id] = a })
    return m
  }, [accounts])

  const symbolGroups = useMemo((): SymbolGroup[] => {
    const bySymbol: Record<string, Trade[]> = {}
    trades.forEach(t => { (bySymbol[t.symbol] ??= []).push(t) })

    return Object.entries(bySymbol).map(([symbol, symbolTrades]) => {
      const accountName = (t: Trade) => {
        const a = accountMap[t.accountId]
        return a ? (a.nickname || `${a.broker} ${a.accountNumber}`) : '알 수 없는 계좌'
      }

      const entries: MergedEntry[] = []
      symbolTrades.forEach(t => {
        t.buyEntries.forEach(e => entries.push({ date: e.date, type: '매수', price: e.price, quantity: e.quantity, accountName: accountName(t) }))
        t.sellEntries.forEach(e => entries.push({ date: e.date, type: '매도', price: e.price, quantity: e.quantity, accountName: accountName(t) }))
      })
      entries.sort((a, b) => a.date.localeCompare(b.date))

      const holdingTrades = symbolTrades.filter(t => !t.isCompleted)
      const isAnyHolding = holdingTrades.length > 0
      const totalRemainingQty = holdingTrades.reduce((s, t) => s + t.remainingQuantity, 0)

      const weightedAvgBuyPrice = (() => {
        const totalAmt = holdingTrades.reduce((s, t) => s + t.avgBuyPrice * t.remainingQuantity, 0)
        return totalRemainingQty > 0 ? totalAmt / totalRemainingQty : 0
      })()

      const holdingDays = (() => {
        if (!isAnyHolding) return 0
        const firstBuy = holdingTrades
          .flatMap(t => t.buyEntries.map(e => e.date))
          .sort()[0] ?? ''
        if (!firstBuy) return 0
        return Math.floor((Date.now() - new Date(firstBuy.slice(0, 10)).getTime()) / 86400000)
      })()

      const totalProfit = symbolTrades.filter(t => t.isCompleted).reduce((s, t) => s + t.profitAmount, 0)

      return {
        symbol,
        entries,
        isAnyHolding,
        totalRemainingQty,
        weightedAvgBuyPrice,
        holdingDays,
        totalProfit,
        buyCount: entries.filter(e => e.type === '매수').length,
        sellCount: entries.filter(e => e.type === '매도').length,
        trades: symbolTrades,
      }
    }).sort((a, b) => {
      if (a.isAnyHolding !== b.isAnyHolding) return a.isAnyHolding ? -1 : 1
      const aDate = a.entries.at(-1)?.date ?? ''
      const bDate = b.entries.at(-1)?.date ?? ''
      return bDate.localeCompare(aDate)
    })
  }, [trades, accountMap])

  if (trades.length === 0)
    return <p className="text-center text-gray-400 py-16 text-sm">거래 기록이 없습니다<br />새 거래를 입력해보세요</p>

  return (
    <div className="space-y-3">
      {symbolGroups.map(group => {
        const isExpanded = expanded.has(group.symbol)
        const isProfitPos = group.totalProfit >= 0
        const completedTrades = group.trades.filter(t => t.isCompleted)

        const holdingColor =
          group.holdingDays <= 7 ? 'bg-green-100 text-green-700'
            : group.holdingDays <= 30 ? 'bg-blue-100 text-blue-700'
              : group.holdingDays <= 90 ? 'bg-orange-100 text-orange-700'
                : 'bg-red-100 text-red-700'

        return (
          <div key={group.symbol} className="rounded-lg overflow-hidden border bg-white">
            {/* 종목 헤더 */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer select-none ${group.isAnyHolding ? 'bg-gray-50' : 'bg-gray-200 opacity-60'}`}
              onClick={() => toggle(group.symbol)}
            >
              <div className="flex items-center gap-2">
                {symbolTypeMap[group.symbol] && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${TYPE_STYLE[symbolTypeMap[group.symbol]] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {symbolTypeMap[group.symbol]}
                  </span>
                )}
                <span className="font-medium">{group.symbol}</span>
                <span className="text-xs text-gray-400">
                  매수 {group.buyCount}건
                  {group.sellCount > 0 ? ` · 매도 ${group.sellCount}건` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {group.isAnyHolding ? (
                  <>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${holdingColor}`}>
                      보유중 {group.holdingDays}일
                    </span>
                    <span className="hidden sm:inline text-xs text-gray-500">
                      잔여 {group.totalRemainingQty}주
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatKRW(Math.round(group.weightedAvgBuyPrice))}
                    </span>
                    {completedTrades.length > 0 && (
                      <span className={`text-xs font-medium ${isProfitPos ? 'text-red-500' : 'text-blue-500'}`}>
                        실현 {(isProfitPos ? '+' : '') + formatKRW(Math.round(group.totalProfit))}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isProfitPos ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      완료 {completedTrades.length}건
                    </span>
                    <span className={`text-xs font-medium ${isProfitPos ? 'text-red-500' : 'text-blue-500'}`}>
                      {(isProfitPos ? '+' : '') + formatKRW(Math.round(group.totalProfit))}
                    </span>
                    {(() => {
                      const totalRate = completedTrades.length > 0
                        ? completedTrades.reduce((s, t) => s + t.profitRate, 0) / completedTrades.length
                        : 0
                      return <span className={`text-xs ${isProfitPos ? 'text-red-400' : 'text-blue-400'}`}>{formatRate(totalRate)}</span>
                    })()}
                  </>
                )}
                <span className="text-gray-300 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* 가격 차트 */}
            {isExpanded && (() => {
              const buyEntries = group.entries.filter(e => e.type === '매수').map(e => ({ date: e.date, price: e.price, quantity: e.quantity }))
              const sellEntries = group.entries.filter(e => e.type === '매도').map(e => ({ date: e.date, price: e.price, quantity: e.quantity }))
              const totalBuyAmt = buyEntries.reduce((s, e) => s + e.price * e.quantity, 0)
              const totalBuyQty = buyEntries.reduce((s, e) => s + e.quantity, 0)
              const avgBuyPrice = totalBuyQty > 0 ? totalBuyAmt / totalBuyQty : 0
              return (
                <TradeChart
                  buyEntries={buyEntries}
                  sellEntries={sellEntries}
                  avgBuyPrice={avgBuyPrice}
                  isCompleted={!group.isAnyHolding}
                />
              )
            })()}

            {/* 전체 거래 내역 (합산) */}
            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-t">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b bg-gray-50">
                      <th className="px-4 py-1.5 text-center font-normal w-20">구분</th>
                      <th className="px-4 py-1.5 text-left font-normal">날짜</th>
                      <th className="px-4 py-1.5 text-left font-normal">계좌</th>
                      <th className="px-4 py-1.5 text-right font-normal">단가</th>
                      <th className="px-4 py-1.5 text-right font-normal">수량</th>
                      <th className="px-4 py-1.5 text-right font-normal">금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.entries.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.type === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                            {e.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{e.date.slice(0, 10)}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{e.accountName}</td>
                        <td className="px-4 py-2 text-right">{formatKRW(e.price)}</td>
                        <td className="px-4 py-2 text-right">{e.quantity}주</td>
                        <td className="px-4 py-2 text-right">{formatKRW(e.price * e.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
