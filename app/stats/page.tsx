'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { HOLDING_PLAN_OPTIONS, TRADE_SCORE_LABELS, type Trade, type Account, type TradeScore } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatRate } from '@/lib/utils'
import ProfitHeatmap from '@/components/ProfitHeatmap'
import SymbolHistory from '@/components/SymbolHistory'

type ChartPeriod = 'daily' | 'weekly' | 'monthly'
type GroupBy = 'account' | 'tag' | 'market' | 'score' | 'holding' | 'plan'

const GROUP_LABELS: Record<GroupBy, string> = {
  account: '계좌',
  tag: '태그',
  market: '시장',
  score: '매매점수',
  holding: '실제 보유기간',
  plan: '계획 보유기간',
}

// 실제 보유일 구간 (정렬 순서 유지를 위해 배열로 관리)
const HOLDING_BUCKETS: { label: string; max: number }[] = [
  { label: '당일', max: 0 },
  { label: '1~7일', max: 7 },
  { label: '8~30일', max: 30 },
  { label: '31~90일', max: 90 },
  { label: '91~180일', max: 180 },
  { label: '181일 이상', max: Infinity },
]

interface StockMasterRow { symbol: string; tags?: string | null; marketType?: string | null }

interface GroupStat { name: string; count: number; wins: number; profit: number; rateSum: number; daysSum: number; order: number }

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10))
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  return d.toISOString().slice(0, 10)
}

export default function StatsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('monthly')
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [masters, setMasters] = useState<StockMasterRow[]>([])
  const [groupBy, setGroupBy] = useState<GroupBy>('account')

  useEffect(() => {
    apiFetch('/api/trades').then(r => r.json()).then((d: unknown) => Array.isArray(d) && setTrades(d as Trade[]))
    apiFetch('/api/accounts').then(r => r.json()).then((d: unknown) => Array.isArray(d) && setAccounts(d as Account[]))
    apiFetch('/api/stock-master').then(r => r.json()).then((d: unknown) => Array.isArray(d) && setMasters(d as StockMasterRow[]))
  }, [])

  const completed = useMemo(() => trades.filter(t => t.isCompleted), [trades])
  const wins = useMemo(() => completed.filter(t => t.profitAmount > 0), [completed])

  const totalProfit = useMemo(() => completed.reduce((s, t) => s + t.profitAmount, 0), [completed])
  const winRate = completed.length > 0 ? (wins.length / completed.length) * 100 : 0
  const avgRate = completed.length > 0 ? completed.reduce((s, t) => s + t.profitRate, 0) / completed.length : 0
  const avgHoldingDays = completed.length > 0 ? completed.reduce((s, t) => s + t.holdingDays, 0) / completed.length : 0

  // 완료 거래의 마지막 매도일 추출 (공통 유틸)
  const completedWithDate = useMemo(() =>
    completed.map(t => {
      const lastSell = t.sellEntries.length > 0
        ? t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date)
        : t.createdAt
      return { profit: t.profitAmount, date: lastSell.slice(0, 10) }
    }),
    [completed]
  )

  // Monthly P&L (last 12 months)
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {}
    completedWithDate.forEach(({ date, profit }) => {
      const key = date.slice(0, 7)
      map[key] = (map[key] ?? 0) + profit
    })
    const result = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      result.push({ label: `${d.getMonth() + 1}월`, profit: Math.round(map[key] ?? 0) })
    }
    return result
  }, [completedWithDate])

  // Weekly P&L (last 13 weeks)
  const weeklyData = useMemo(() => {
    const map: Record<string, number> = {}
    completedWithDate.forEach(({ date, profit }) => {
      const key = getWeekStart(date)
      map[key] = (map[key] ?? 0) + profit
    })
    const result: { label: string; key: string; profit: number }[] = []
    const now = new Date()
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const key = getWeekStart(d.toISOString())
      const kd = new Date(key)
      const label = `${kd.getMonth() + 1}/${kd.getDate()}`
      if (!result.find(r => r.key === key)) {
        result.push({ label, key, profit: Math.round(map[key] ?? 0) })
      }
    }
    return result
  }, [completedWithDate])

  // Daily P&L (last 30 days)
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {}
    completedWithDate.forEach(({ date, profit }) => {
      map[date] = (map[date] ?? 0) + profit
    })
    const result = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      result.push({ label, profit: Math.round(map[key] ?? 0) })
    }
    return result
  }, [completedWithDate])

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

  // 그룹별 성과 (계좌·태그·시장·점수·보유기간). 태그는 종목마다 여러 개일 수 있어 각 태그에 중복 집계됨
  const groupStats = useMemo(() => {
    const masterMap = new Map(masters.map(m => [m.symbol, m]))
    const keysOf = (t: Trade): { name: string; order: number }[] => {
      switch (groupBy) {
        case 'account': {
          const account = accounts.find(a => a.id === t.accountId)
          return [{ name: account ? (account.nickname || `${account.broker} ${account.accountNumber}`) : '알 수 없는 계좌', order: 0 }]
        }
        case 'tag': {
          const tags = (masterMap.get(t.symbol)?.tags ?? '').split(',').map(s => s.trim()).filter(Boolean)
          return tags.length > 0 ? tags.map(name => ({ name, order: 0 })) : [{ name: '태그 없음', order: 1 }]
        }
        case 'market':
          return [{ name: masterMap.get(t.symbol)?.marketType || '미지정', order: masterMap.get(t.symbol)?.marketType ? 0 : 1 }]
        case 'score':
          return t.tradeScore != null
            ? [{ name: `${t.tradeScore}점 · ${TRADE_SCORE_LABELS[t.tradeScore as TradeScore] ?? ''}`, order: -t.tradeScore }]
            : [{ name: '점수 없음', order: 1 }]
        case 'holding': {
          const idx = HOLDING_BUCKETS.findIndex(b => t.holdingDays <= b.max)
          return [{ name: HOLDING_BUCKETS[idx].label, order: idx }]
        }
        case 'plan': {
          const idx = HOLDING_PLAN_OPTIONS.indexOf(t.plannedHoldingPeriod as typeof HOLDING_PLAN_OPTIONS[number])
          return [{ name: idx >= 0 ? t.plannedHoldingPeriod! : '계획 없음', order: idx >= 0 ? idx : 99 }]
        }
      }
    }
    const map = new Map<string, GroupStat>()
    completed.forEach(t => {
      keysOf(t).forEach(({ name, order }) => {
        const g = map.get(name) ?? { name, count: 0, wins: 0, profit: 0, rateSum: 0, daysSum: 0, order }
        g.count++
        g.profit += t.profitAmount
        g.rateSum += t.profitRate
        g.daysSum += t.holdingDays
        if (t.profitAmount > 0) g.wins++
        map.set(name, g)
      })
    })
    // 순서가 의미 있는 그룹(점수·보유기간)은 고정 순서, 나머지는 손익 내림차순
    const ordered = groupBy === 'score' || groupBy === 'holding' || groupBy === 'plan'
    return [...map.values()]
      .map(g => ({ ...g, winRate: g.wins / g.count * 100, avgRate: g.rateSum / g.count, avgDays: g.daysSum / g.count }))
      .sort((a, b) => ordered ? a.order - b.order : (a.order - b.order) || (b.profit - a.profit))
  }, [completed, accounts, masters, groupBy])

  // 종목코드 맵 (네이버 링크용)
  const symbolCodeMap = useMemo(() => {
    const map: Record<string, string> = {}
    trades.forEach(t => { if (t.symbolCode) map[t.symbol] = t.symbolCode })
    return map
  }, [trades])

  // Symbol breakdown (top 15 wins + top 15 losses)
  const symbolStats = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach(t => {
      map[t.symbol] = (map[t.symbol] ?? 0) + t.profitAmount
    })
    const sorted = Object.entries(map)
      .map(([symbol, profit]) => ({ symbol, profit: Math.round(profit) }))
      .sort((a, b) => b.profit - a.profit)
    return {
      top: sorted.slice(0, 15).filter(s => s.profit > 0),
      bottom: sorted.filter(s => s.profit < 0).slice(-15).reverse(),
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

        {/* P&L Chart */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-600">
              {chartPeriod === 'daily' ? '일별 손익 (최근 30일)' : chartPeriod === 'weekly' ? '주별 손익 (최근 13주)' : '월별 손익 (최근 12개월)'}
            </p>
            <div className="flex border rounded overflow-hidden">
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={`text-xs px-2.5 py-1 ${chartPeriod === p ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {p === 'daily' ? '일' : p === 'weekly' ? '주' : '월'}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const data = chartPeriod === 'daily' ? dailyData : chartPeriod === 'weekly' ? weeklyData : monthlyData
            // 일별은 30개 데이터라 tick 간격 조정
            const tickCount = chartPeriod === 'daily' ? 6 : chartPeriod === 'weekly' ? 4 : undefined
            return (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval={tickCount !== undefined ? Math.floor(data.length / tickCount) : 0}
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
                  <Bar dataKey="profit" radius={[3, 3, 0, 0]} maxBarSize={chartPeriod === 'monthly' ? 32 : 20}>
                    {data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.profit >= 0 ? '#ef4444' : '#3b82f6'} fillOpacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          })()}
        </div>

        {/* Heatmap */}
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm font-medium text-gray-600 mb-3">연간 히트맵 (최근 365일)</p>
          <ProfitHeatmap dailyProfits={dailyProfits} />
        </div>

        {/* Group breakdown */}
        {completed.length > 0 && (
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm font-medium text-gray-600 mb-2">{GROUP_LABELS[groupBy]}별 성과</p>
            <div className="overflow-x-auto -mx-1 px-1 mb-3">
              <div className="inline-flex border rounded overflow-hidden whitespace-nowrap">
                {(Object.keys(GROUP_LABELS) as GroupBy[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`text-xs px-2.5 py-1 ${groupBy === g ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {GROUP_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>
            {groupBy === 'tag' && (
              <p className="text-[11px] text-gray-400 mb-2">태그가 여러 개인 종목은 각 태그에 모두 집계됩니다. 태그는 종목관리에서 붙일 수 있어요.</p>
            )}
            <div className="space-y-0">
              {groupStats.map(g => {
                const isP = g.profit >= 0
                return (
                  <div key={g.name} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <span className="text-sm text-gray-700 truncate block">{g.name}</span>
                      <span className="text-xs text-gray-400">
                        {g.count}건 · 승률 {g.winRate.toFixed(0)}% · 평균 {formatRate(g.avgRate)} · 평균 {Math.round(g.avgDays)}일
                      </span>
                    </div>
                    <span className={`text-sm font-medium ml-4 shrink-0 ${isP ? 'text-red-500' : 'text-blue-500'}`}>
                      {(isP ? '+' : '') + formatKRW(Math.round(g.profit))}
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
                  {symbolStats.top.map(s => {
                    const code = symbolCodeMap[s.symbol]
                    const naverUrl = code
                      ? `https://stock.naver.com/domestic/stock/${code}/price`
                      : `https://finance.naver.com/search/search.naver?query=${encodeURIComponent(s.symbol)}`
                    return (
                      <button
                        key={s.symbol}
                        onClick={() => setSelectedSymbol(s.symbol)}
                        className="w-full flex items-center justify-between text-sm gap-2 hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
                      >
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="text-gray-600 truncate">{s.symbol}</span>
                          <a
                            href={naverUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                            title="네이버 종목 페이지"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L13.5 2zm0 1.5L18.5 8H14a.5.5 0 0 1-.5-.5V3.5zM6 20V4h6v4a1.5 1.5 0 0 0 1.5 1.5H20V20H6z"/></svg>
                          </a>
                        </span>
                        <span className="text-red-500 font-medium whitespace-nowrap">+{formatKRW(s.profit)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {symbolStats.bottom.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">손실 Top</p>
                <div className="space-y-1.5">
                  {symbolStats.bottom.map(s => {
                    const code = symbolCodeMap[s.symbol]
                    const naverUrl = code
                      ? `https://stock.naver.com/domestic/stock/${code}/price`
                      : `https://finance.naver.com/search/search.naver?query=${encodeURIComponent(s.symbol)}`
                    return (
                      <button
                        key={s.symbol}
                        onClick={() => setSelectedSymbol(s.symbol)}
                        className="w-full flex items-center justify-between text-sm gap-2 hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
                      >
                        <span className="flex items-center gap-1 min-w-0">
                          <span className="text-gray-600 truncate">{s.symbol}</span>
                          <a
                            href={naverUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                            title="네이버 종목 페이지"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L13.5 2zm0 1.5L18.5 8H14a.5.5 0 0 1-.5-.5V3.5zM6 20V4h6v4a1.5 1.5 0 0 0 1.5 1.5H20V20H6z"/></svg>
                          </a>
                        </span>
                        <span className="text-blue-500 font-medium whitespace-nowrap">{formatKRW(s.profit)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {completed.length === 0 && (
          <p className="text-center text-gray-400 py-16 text-sm">완료된 거래가 없습니다</p>
        )}
      </div>

      {/* 종목 상세 모달 */}
      {selectedSymbol && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-xl sm:max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h2 className="font-semibold">{selectedSymbol}</h2>
              <button onClick={() => setSelectedSymbol(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-4">
              <SymbolHistory
                trades={trades.filter(t => t.symbol === selectedSymbol)}
                accounts={accounts}
                defaultExpandedSymbol={selectedSymbol}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
