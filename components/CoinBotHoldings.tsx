'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { BotHolding, BotHoldingsResponse } from '@/lib/botHoldings'
import type { BotRegime } from '@/lib/botFills'
import { formatKRW, formatQty, formatRate } from '@/lib/utils'

// 자동매매 앱(upbit-alert)이 지금 들고 있는 코인 — 일지 입력과 무관하게 실계좌 기준.
// 앱에 연결하지 못하면(로컬 개발 등) 아무것도 그리지 않는다.

const REGIME_CLS: Record<BotRegime['key'], string> = {
  good: 'bg-green-50 text-green-700',
  neutral: 'bg-yellow-50 text-yellow-700',
  bad: 'bg-red-50 text-red-600',
}

function signCls(v: number | null) {
  if (v == null) return 'text-gray-300'
  return v >= 0 ? 'text-red-500' : 'text-blue-500'
}

function signedKRW(v: number) {
  return (v >= 0 ? '+' : '') + formatKRW(Math.round(v))
}

function HoldingRow({ h }: { h: BotHolding }) {
  const rule = h.exit_rule
  return (
    <div className="border-b last:border-b-0 px-3 py-2 space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium text-sm text-gray-800">{h.symbol}</span>
          <span className="text-[11px] text-gray-400 tabular-nums truncate">
            {formatQty(h.qty)}개 · 평단 {formatKRW(Math.round(h.avg_buy_price))}
            {h.current_price != null && <> → {formatKRW(h.current_price)}</>}
          </span>
        </div>
        <div className="text-right whitespace-nowrap">
          <span className={`text-sm font-semibold tabular-nums ${signCls(h.pnl_pct)}`}>{formatRate(h.pnl_pct)}</span>
          {h.pnl_krw != null && <span className={`ml-1.5 text-[11px] tabular-nums ${signCls(h.pnl_krw)}`}>{signedKRW(h.pnl_krw)}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
        <span className="text-gray-400">{h.entry_at ? h.entry_at.slice(5, 16) : '진입 시각 모름'}</span>
        <span className="text-gray-700" title={h.entry_reason ?? ''}>{h.entry_reason_label ?? '앱 기록 이전 보유'}</span>
        {h.entry_regime && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${REGIME_CLS[h.entry_regime.key]}`}>시장 {h.entry_regime.label}</span>
        )}
        {h.dca_count > 0 && <span>물타기 {h.dca_count}회</span>}
        {h.peak_pnl_pct != null && (
          <span>
            최고 <span className={signCls(h.peak_pnl_pct)}>{formatRate(h.peak_pnl_pct)}</span>
            {h.trough_pnl_pct != null && <> · 최저 <span className={signCls(h.trough_pnl_pct)}>{formatRate(h.trough_pnl_pct)}</span></>}
          </span>
        )}
      </div>
      <div className="text-[11px] text-gray-500">
        청산 {rule.preset ? `${rule.preset.emoji} ${rule.preset.label}` : '직접 설정'} · {rule.text}
        {rule.locked && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">산 시점 규칙 유지</span>}
      </div>
    </div>
  )
}

export default function CoinBotHoldings() {
  const [data, setData] = useState<BotHoldingsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/coin-bot-holdings')
      setData(res.ok ? await res.json() : null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!data) return null

  const { holdings } = data
  const cost = holdings.reduce((s, h) => s + h.cost_krw, 0)
  const priced = holdings.filter(h => h.eval_krw != null)
  const pnl = priced.reduce((s, h) => s + (h.pnl_krw ?? 0), 0)
  const pricedCost = priced.reduce((s, h) => s + h.cost_krw, 0)
  const pnlPct = pricedCost > 0 ? (pnl / pricedCost) * 100 : null

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b gap-2">
        <span className="text-xs text-gray-500 font-medium">
          🤖 자동매매 보유 <span className="text-gray-400">{holdings.length}</span>
          {holdings.length > 0 && (
            <span className="ml-2 font-normal tabular-nums">
              원금 {formatKRW(Math.round(cost))}
              {priced.length > 0 && <> · <span className={signCls(pnl)}>{signedKRW(pnl)} ({formatRate(pnlPct)})</span></>}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-gray-400 whitespace-nowrap">
          {data.current_preset && <span>새 매수 {data.current_preset.emoji} {data.current_preset.label}</span>}
          <button onClick={load} disabled={loading} className="text-blue-600 disabled:opacity-50">{loading ? '조회중' : '↻'}</button>
        </span>
      </div>
      {holdings.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-400">지금 자동매매로 들고 있는 코인이 없습니다.</div>
      ) : (
        holdings.map(h => <HoldingRow key={h.ticker} h={h} />)
      )}
    </div>
  )
}
