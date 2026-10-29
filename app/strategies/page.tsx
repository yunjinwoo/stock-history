'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Strategy, Trade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatRate } from '@/lib/utils'
import { buildCycles, summarizeCycles, ruleText } from '@/lib/strategy'
import StrategyForm from '@/components/StrategyForm'

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const [s, t] = await Promise.all([
      apiFetch('/api/strategies').then(r => r.json()),
      apiFetch('/api/trades').then(r => r.json()),
    ])
    if (Array.isArray(s)) setStrategies(s)
    if (Array.isArray(t)) setTrades(t)
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => Object.fromEntries(strategies.map(s => {
    const mine = trades.filter(t => t.strategyId === s.id)
    const summary = summarizeCycles(buildCycles(mine, s), s.seedMoney)
    return [s.id, { summary, open: mine.filter(t => !t.isCompleted).length }]
  })), [strategies, trades])

  const unassigned = trades.filter(t => !t.strategyId).length

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 돌아가기</Link>
        <h1 className="text-lg font-bold">전략</h1>
        <button onClick={() => setShowForm(v => !v)} className="ml-auto bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700">
          + 새 전략
        </button>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {showForm && (
          <StrategyForm
            onSaved={() => { setShowForm(false); load() }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {strategies.length === 0 && !showForm && (
          <div className="bg-white border rounded-lg p-6 text-center space-y-2">
            <p className="text-sm text-gray-600">아직 전략이 없어요.</p>
            <p className="text-xs text-gray-400">전략을 만들고 거래를 담으면 회차별 승패, 누적 복리, 계획 대비 이탈을 볼 수 있어요.</p>
            <button onClick={() => setShowForm(true)} className="text-sm text-blue-500 hover:text-blue-700">전략 만들기</button>
          </div>
        )}

        {strategies.map(s => {
          const st = stats[s.id]
          const sum = st?.summary
          return (
            <Link key={s.id} href={`/strategies/${s.id}`} className="block bg-white border rounded-lg p-4 hover:border-blue-300">
              <div className="flex justify-between items-baseline gap-2">
                <h2 className="font-semibold">{s.name}</h2>
                <span className="text-xs text-gray-400">{s.tradeCount ?? 0}건{st?.open ? ` · 보유중 ${st.open}` : ''}</span>
              </div>
              {ruleText(s) && <p className="text-xs text-gray-500 mt-0.5">{ruleText(s)}</p>}
              {sum && sum.count > 0 ? (
                <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                  <div><p className="text-[11px] text-gray-400">회차</p><p className="text-sm font-medium">{sum.count}</p></div>
                  <div><p className="text-[11px] text-gray-400">승률</p><p className="text-sm font-medium">{sum.winRate.toFixed(0)}%</p></div>
                  <div><p className="text-[11px] text-gray-400">누적 복리</p><p className={`text-sm font-medium ${sum.cumRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{formatRate(sum.cumRate)}</p></div>
                  <div><p className="text-[11px] text-gray-400">계획 준수</p><p className="text-sm font-medium">{sum.adherenceRate.toFixed(0)}%</p></div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-3">완료된 회차가 아직 없어요.</p>
              )}
            </Link>
          )
        })}

        {strategies.length > 0 && unassigned > 0 && (
          <p className="text-xs text-gray-400 text-center">전략이 없는 거래 {unassigned}건 — 전략 화면의 &lsquo;거래 담기&rsquo;에서 한 번에 지정할 수 있어요.</p>
        )}
      </div>
    </div>
  )
}
