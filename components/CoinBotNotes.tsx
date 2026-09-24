'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CoinTrade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { matchBotFills, type BotFill, type BotRegime, type JournalEntry } from '@/lib/botFills'
import { formatRate } from '@/lib/utils'

// 자동매매 앱(upbit-alert)이 이 종목을 왜 사고 팔았는지 — 펼친 카드 아래에 붙는 "앱 기록" 블록.
// 앱에 연결하지 못하면(로컬 개발 등) 아무것도 그리지 않는다.

const REGIME_CLS: Record<BotRegime['key'], string> = {
  good: 'bg-green-50 text-green-700',
  neutral: 'bg-yellow-50 text-yellow-700',
  bad: 'bg-red-50 text-red-600',
}

function RegimeChip({ regime }: { regime: BotRegime | null | undefined }) {
  if (!regime) return null
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${REGIME_CLS[regime.key]}`}>시장 {regime.label}</span>
}

function pctCls(v: number) {
  return v >= 0 ? 'text-red-500' : 'text-blue-500'
}

export default function CoinBotNotes({ trade }: { trade: CoinTrade }) {
  const [fills, setFills] = useState<BotFill[] | null>(null)

  const entries: JournalEntry[] = useMemo(() => [
    ...trade.buyEntries.map(e => ({ key: e.id, type: '매수' as const, date: e.date, quantity: e.quantity })),
    ...trade.sellEntries.map(e => ({ key: e.id, type: '매도' as const, date: e.date, quantity: e.quantity })),
  ], [trade])

  const dates = entries.map(e => e.date.slice(0, 10)).sort()
  const from = dates[0]
  // 보유 중이면 끝을 열어둔다(오늘 이후 체결까지)
  const to = trade.isCompleted ? dates[dates.length - 1] : ''

  useEffect(() => {
    if (!from) return
    const qs = new URLSearchParams({ symbol: trade.symbol, from })
    if (to) qs.set('to', to)
    apiFetch(`/api/coin-bot-fills?${qs}`)
      .then(r => (r.ok ? r.json() : null))
      .then(body => setFills(body?.fills ?? null))
      .catch(() => setFills(null))
  }, [trade.symbol, from, to])

  const matched = useMemo(() => (fills ? matchBotFills(entries, fills) : new Map<string, BotFill>()), [entries, fills])

  if (!fills) return null

  const manualCount = entries.filter(e => !matched.has(e.key)).length
  const inJournal = new Set(matched.values())

  return (
    <div className="border-t px-3 py-2 bg-gray-50/60 space-y-1">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>🤖 앱 기록</span>
        <span>
          일지 {entries.length}건 중 앱 {entries.length - manualCount}건
          {manualCount > 0 && <> · 수동 {manualCount}건</>}
        </span>
      </div>
      {fills.length === 0 ? (
        <div className="text-[11px] text-gray-400">이 기간에 앱이 사고판 기록이 없습니다.</div>
      ) : (
        <ul className="space-y-1">
          {fills.map(f => (
            <li key={f.id} className="text-xs flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${f.side === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                {f.decision === 'DCA_BUY' ? '물타기' : f.side}
              </span>
              <span className="text-gray-400">{f.at.slice(5, 16)}</span>
              <span className="text-gray-700" title={f.reason ?? ''}>{f.reason_label ?? '사유 없음'}</span>
              <RegimeChip regime={f.regime} />
              {f.side === '매도' && f.pnl_pct != null && (
                <span className="text-[11px] text-gray-500">
                  실현 <b className={pctCls(f.pnl_pct)}>{formatRate(f.pnl_pct)}</b>
                  {f.peak_pnl_pct != null && <> · 최고 <span className={pctCls(f.peak_pnl_pct)}>{formatRate(f.peak_pnl_pct)}</span></>}
                  {f.trough_pnl_pct != null && <> · 최저 <span className={pctCls(f.trough_pnl_pct)}>{formatRate(f.trough_pnl_pct)}</span></>}
                </span>
              )}
              {!inJournal.has(f) && <span className="text-[10px] text-gray-300">일지에 없음</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
