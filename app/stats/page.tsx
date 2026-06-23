'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import type { Trade, Account } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatRate } from '@/lib/utils'
import ProfitHeatmap from '@/components/ProfitHeatmap'

export default function StatsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    apiFetch('/api/trades').then(r => r.json()).then((d: unknown) => Array.isArray(d) && setTrades(d as Trade[]))
    apiFetch('/api/accounts').then(r => r.json()).then((d: unknown) => Array.isArray(d) && setAccounts(d as Account[]))
  }, [])

  const completed = useMemo(() => trades.filter(t => t.isCompleted), [trades])
  const wins = useMemo(() => completed.filter(t => t.profitAmount > 0), [completed])

  const totalProfit = useMemo(() => completed.reduce((s, t) => s + t.profitAmount, 0), [completed])
  const winRate = completed.length > 0 ? (wins.length / completed.length) * 100 : 0
  const avgRate = completed.length > 0 ? completed.reduce((s, t) => s + t.profitRate, 0) / completed.length : 0
  const avgHoldingDays = completed.length > 0 ? completed.reduce((s, t) => s + t.holdingDays, 0) / completed.length : 0

  // Monthly P&L (last 12 months, keyed by last sell date)
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(t => {
      const lastSell = t.sellEntries.length > 0
        ? t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date)
        : t.createdAt
      const month = lastSell.slice(0, 7)
      map[month] = (map[month] ?? 0) + t.profitAmount
    })
    const result = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      result.push({ label: `${d.getMonth() + 1}월`, key, profit: Math.round(map[key] ?? 0) })
    }
    return result
  }, [completed])

  // Daily profits for heatmap
  const dailyProfits = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(t => {
      const lastSell = t.sellEntries.length > 0
        ? t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date)
        : null
      if (!lastSell) return
      const date = lastSell.slice(0, 10)
      map[date] = (map[date] ?? 0) + t.profitAmount
    })
    return map
  }, [completed])

  // Account breakdown
  const accountStats = useMemo(() => {
    const map: Record<string, { profit: number; wins: number; count: number }> = {}
    completed.forEach(t => {
      if (!map[t.accountId]) map[t.accountId] = { profit: 0, wins: 0, count: 0 }
      map[t.accountId].profit += t.profitAmount
      map[t.accountId].count++
      if (t.profitAmount > 0) map[t.accountId].wins++
    })
    return Object.entries(map)
      .map(([accountId, stats]) => {
        const account = accounts.find(a => a.id === accountId)
        const name = account
          ? (account.nickname || `${account.broker} ${account.accountNumber}`)
          : '알 수 없는 계좌'
        return { name, ...stats, winRate: stats.count > 0 ? (stats.wins / stats.count * 100) : 0 }
      })
      .sort((a, b) => b.profit - a.profit)
  }, [completed, accounts])

  // Symbol breakdown (top 5 wins + top 5 losses)
  const symbolStats = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(t => {
      map[t.symbol] = (map[t.symbol] ?? 0) + t.profitAmount
    })
    const sorted = Object.entries(map)
      .map(([symbol, profit]) => ({ symbol, profit: Math.round(profit) }))
      .sort((a, b) => b.profit - a.profit)
    return {
      top: sorted.slice(0, 5).filter(s => s.profit > 0),
      bottom: sorted.filter(s => s.profit < 0).slice(-5).reverse(),
    }
  }, [completed])

  const isProfit = totalProfit >= 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 뒤로</Link>
        <h1 className="text-lg font-bold">통계</h1>
        <span className="text-xs text-gray-400 ml-auto">완료 {completed.length}건</span>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-400 mb-1">총 실현손익</p>
            <p className={`text-base font-bold ${isProfit ? 'text-red-500' : 'text-blue-500'}`}>
              {(isProfit ? '+' : '') + formatKRW(Math.round(totalProfit))}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-400 mb-1">승률</p>
            <p className="text-base font-bold text-gray-700">{winRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-400">{wins.length}승 {completed.length - wins.length}패</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-400 mb-1">평균 수익률</p>
            <p className={`text-base font-bold ${avgRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {formatRate(avgRate)}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-400 mb-1">평균 보유일</p>
            <p className="text-base font-bold text-gray-700">{Math.round(avgHoldingDays)}일</p>
          </div>
        </div>

        {/* Monthly chart */}
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm font-medium text-gray-600 mb-3">월별 손익 (최근 12개월)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={v => v === 0 ? '0' : (Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`)}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : 0
                  return [(n >= 0 ? '+' : '') + formatKRW(n), '손익']
                }}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <ReferenceLine y={0} stroke="#e5e7eb" />
              <Bar dataKey="profit" radius={[3, 3, 0, 0]} maxBarSize={32}>
                {monthlyData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.profit >= 0 ? '#ef4444' : '#3b82f6'} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heatmap */}
        <div className="bg-white rounded-xl border p-4 overflow-x-auto">
          <p className="text-sm font-medium text-gray-600 mb-3">연간 히트맵 (최근 365일)</p>
          <ProfitHeatmap dailyProfits={dailyProfits} />
        </div>

        {/* Account breakdown */}
        {accountStats.length > 0 && (
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-600 mb-3">계좌별 손익</p>
            <div className="space-y-0">
              {accountStats.map((a, idx) => {
                const isP = a.profit >= 0
                return (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <span className="text-sm text-gray-700 truncate block">{a.name}</span>
                      <span className="text-xs text-gray-400">{a.count}건 · 승률 {a.winRate.toFixed(0)}%</span>
                    </div>
                    <span className={`text-sm font-medium ml-4 shrink-0 ${isP ? 'text-red-500' : 'text-blue-500'}`}>
                      {(isP ? '+' : '') + formatKRW(Math.round(a.profit))}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top / Bottom symbols */}
        {(symbolStats.top.length > 0 || symbolStats.bottom.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {symbolStats.top.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">수익 Top</p>
                <div className="space-y-1.5">
                  {symbolStats.top.map(s => (
                    <div key={s.symbol} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-600 truncate">{s.symbol}</span>
                      <span className="text-red-500 font-medium whitespace-nowrap">+{formatKRW(s.profit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {symbolStats.bottom.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">손실 Top</p>
                <div className="space-y-1.5">
                  {symbolStats.bottom.map(s => (
                    <div key={s.symbol} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-600 truncate">{s.symbol}</span>
                      <span className="text-blue-500 font-medium whitespace-nowrap">{formatKRW(s.profit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {completed.length === 0 && (
          <p className="text-center text-gray-400 py-16 text-sm">완료된 거래가 없습니다</p>
        )}
      </div>
    </div>
  )
}
