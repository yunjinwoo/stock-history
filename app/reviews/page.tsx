'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import StockNav from '@/components/StockNav'
import TradeModal from '@/components/TradeModal'
import ReasonChips from '@/components/ReasonChips'
import type { Account, Trade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatRate } from '@/lib/utils'
import {
  ENTRY_REASONS, EXIT_REASONS, QUADRANT_LABELS,
  evaluateTrade, lastSellDay, periodRange, summarizeReview,
  type Evaluated, type PeriodKind, type Quadrant, type TradeEvaluation,
} from '@/lib/review'

type ReviewedTrade = Evaluated<Trade>

const PERIOD_LABELS: Record<PeriodKind, string> = { week: '이번 주', month: '이번 달', lastMonth: '지난달', custom: '직접' }

const toneCls = (n: number | null | undefined) => n == null ? '' : n > 0 ? 'text-red-500' : n < 0 ? 'text-blue-500' : ''
const signedKRW = (n: number) => (n > 0 ? '+' : '') + formatKRW(Math.round(n))
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Badge({ children, tone }: { children: React.ReactNode; tone: 'good' | 'bad' | 'neutral' }) {
  const cls = tone === 'good' ? 'bg-green-100 text-green-700' : tone === 'bad' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
  return <span className={`text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>{children}</span>
}

// 계획 대비 자동 평가 배지 — 부분매도 거래는 '목표가 도달'과 '최종 목표 달성'을 따로 보여준다
function EvalBadges({ t, r }: { t: Trade; r: TradeEvaluation }) {
  if (r.status === 'noPlan') return <Badge tone="neutral">계획 없음</Badge>
  return (
    <>
      {t.planExceeded != null && <Badge tone={t.planExceeded ? 'bad' : 'good'}>{t.planExceeded ? '보유 초과' : '보유기간 이내'}</Badge>}
      {r.targetHit != null && (t.profitAmount > 0 || r.targetHit) && (
        r.targetHit && r.finalTargetMet === false
          ? <Badge tone="neutral">일부만 목표가 도달</Badge>
          : <Badge tone={r.targetHit ? 'good' : 'neutral'}>{r.targetHit ? '목표가 도달' : '목표 미달'}</Badge>
      )}
      {t.profitAmount <= 0 && t.stopLossPrice != null && (
        <Badge tone={r.deviations.includes('손절 늦음') ? 'bad' : 'good'}>{r.deviations.includes('손절 늦음') ? '손절 늦음' : '손절 준수'}</Badge>
      )}
      {r.deviations.includes('조기 익절') && <Badge tone="bad">조기 익절</Badge>}
    </>
  )
}

function planText(t: Trade): string {
  const base = t.avgBuyPrice
  const pct = (p: number) => base > 0 ? ((p - base) / base) * 100 : null
  const parts = [
    t.plannedHoldingPeriod,
    t.targetPrice != null && `목표 ${formatRate(pct(t.targetPrice))}`,
    t.stopLossPrice != null && `손절 ${formatRate(pct(t.stopLossPrice))}`,
  ].filter(Boolean)
  return parts.length > 0 ? `계획: ${parts.join(' · ')}` : '계획 없음'
}

function PendingCard({ t, onSaved, onSkip, onOpen }: { t: ReviewedTrade; onSaved: () => void; onSkip: () => void; onOpen: () => void }) {
  const [exitReason, setExitReason] = useState<string | null>(t.exitReason ?? null)
  const [entryReason, setEntryReason] = useState<string | null>(t.entryReason ?? null)
  const [line, setLine] = useState(t.exitComment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const needsEntry = !t.entryReason
  const preview = useMemo(() => evaluateTrade({ ...t, exitReason }), [t, exitReason])

  async function save() {
    if (!exitReason && !line.trim()) {
      setError('청산 이유나 복기 한 줄 중 하나는 남겨 주세요')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch(`/api/trades/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exitReason,
          exitComment: line.trim() || null,
          ...(needsEntry && { entryReason }),
          reviewedAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) { setError('저장하지 못했어요. 다시 시도해 주세요'); return }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-baseline gap-2 flex-wrap">
        <button type="button" onClick={onOpen} className="text-left">
          <span className="font-semibold hover:text-blue-600">{t.symbol}</span>
          <span className="text-xs text-gray-400 ml-2">{t.holdingDays}일 보유 · {lastSellDay(t)?.slice(5).replace('-', '/')} 매도</span>
        </button>
        <span className={`text-sm font-medium tabular-nums ${toneCls(t.profitAmount)}`}>
          {formatRate(t.profitRate)} · {signedKRW(t.profitAmount)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
        <span>{planText(t)}</span>
        <EvalBadges t={t} r={preview} />
      </div>
      {needsEntry && (
        <div>
          <p className="text-[11px] text-gray-400 mb-1">진입 이유 (비어 있음)</p>
          <ReasonChips size="xs" options={ENTRY_REASONS} value={entryReason} onChange={setEntryReason} />
        </div>
      )}
      <div>
        <p className="text-[11px] text-gray-400 mb-1">청산 이유</p>
        <ReasonChips size="xs" options={EXIT_REASONS} value={exitReason} onChange={v => { setExitReason(v); setError('') }} />
        {preview.exitReasonMismatch && <p className="text-xs text-amber-600 mt-1">{preview.exitReasonMismatch}</p>}
      </div>
      <input
        value={line}
        onChange={e => { setLine(e.target.value); setError('') }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) save() }}
        placeholder="복기 한 줄 — 박스권 이탈 확인이 늦었음"
        maxLength={500}
        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onSkip} className="text-xs px-3 py-1.5 border rounded text-gray-500 hover:bg-gray-50">나중에</button>
        <button type="button" onClick={save} disabled={saving} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '저장 중...' : '복기 저장'}
        </button>
      </div>
    </div>
  )
}

function Tile({ label, value, tone, sub }: { label: string; value: string; tone?: number | null; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg px-3 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${toneCls(tone)}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 tabular-nums">{sub}</p>}
    </div>
  )
}

const QUADRANT_STYLE: Record<Quadrant, string> = {
  good: 'bg-green-50 border-green-200 text-green-800',
  lucky: 'bg-amber-50 border-amber-200 text-amber-800',
  goodLoss: 'bg-gray-50 border-gray-200 text-gray-700',
  bad: 'bg-red-50 border-red-200 text-red-800',
}

const QUADRANT_HINT: Record<Quadrant, string> = {
  good: '수익 + 계획 준수',
  lucky: '수익났지만 계획 이탈',
  goodLoss: '손실이지만 계획대로',
  bad: '손실 + 계획 이탈',
}

function CompareBar({ label, value, max, n }: { label: string; value: number | null; max: number; n: number }) {
  const width = value != null && max > 0 ? Math.max(2, (Math.abs(value) / max) * 100) : 0
  return (
    <div className="grid grid-cols-[96px_1fr_88px] gap-2 items-center text-xs">
      <span className="text-gray-500">{label} <span className="text-gray-300">{n}</span></span>
      <div className="h-2.5 bg-gray-100 rounded">
        {value != null && <div className={`h-2.5 rounded ${value >= 0 ? 'bg-red-400' : 'bg-blue-400'}`} style={{ width: `${width}%` }} />}
      </div>
      <span className={`text-right tabular-nums ${toneCls(value)}`}>{value != null ? formatRate(value) : '-'}</span>
    </div>
  )
}

export default function ReviewsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loaded, setLoaded] = useState(false)
  const [period, setPeriod] = useState<PeriodKind>('month')
  const [custom, setCustom] = useState(() => {
    const r = periodRange('month', new Date())
    return { start: r.start, end: ymd(new Date()) }
  })
  const [accountId, setAccountId] = useState('')
  const [pendingAll, setPendingAll] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [quadrant, setQuadrant] = useState<Quadrant | null>(null)
  const [editTrade, setEditTrade] = useState<Trade | null>(null)

  async function load() {
    const [t, a] = await Promise.all([
      apiFetch('/api/trades').then(r => r.json()),
      apiFetch('/api/accounts').then(r => r.json()),
    ])
    if (Array.isArray(t)) setTrades(t)
    if (Array.isArray(a)) setAccounts(a)
    setLoaded(true)
  }

  useEffect(() => { load() }, [])

  const evaluated: ReviewedTrade[] = useMemo(
    () => trades
      .filter(t => !accountId || t.accountId === accountId)
      .map(t => ({ ...t, review: evaluateTrade(t) })),
    [trades, accountId],
  )

  // 복기 대기: 매도 완료 + 복기 안 함. 기본은 최근 30일 매도분만
  const pendingSince = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return ymd(d) }, [])
  const pendingAllList = useMemo(
    () => evaluated
      .filter(t => t.isCompleted && !t.reviewedAt)
      .sort((a, b) => (lastSellDay(b) ?? '').localeCompare(lastSellDay(a) ?? '')),
    [evaluated],
  )
  const pendingRecent = pendingAllList.filter(t => (lastSellDay(t) ?? '') >= pendingSince)
  const pending = (pendingAll ? pendingAllList : pendingRecent).filter(t => !skipped.has(t.id))

  const range = period === 'custom' ? custom : periodRange(period, new Date())
  const inPeriod = useMemo(
    () => evaluated.filter(t => {
      if (!t.isCompleted) return false
      const d = lastSellDay(t)
      return d != null && d >= range.start && d <= range.end
    }),
    [evaluated, range.start, range.end],
  )
  const s = useMemo(() => summarizeReview(inPeriod), [inPeriod])
  const reviewedCount = inPeriod.filter(t => t.reviewedAt).length

  const compareMax = Math.max(
    ...[s.followed.avgRate, s.deviated.avgRate, s.stopKeptLoss.avgRate, s.lateStopLoss.avgRate].map(v => Math.abs(v ?? 0)),
  )

  const quadrantTrades = quadrant ? s.quadrants[quadrant].trades : []

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <header className="bg-white border-b px-4 py-3 flex flex-wrap gap-y-2 items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 돌아가기</Link>
        <h1 className="text-lg font-bold">복기</h1>
        <StockNav className="lg:ml-auto" />
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* 기간·계좌 */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as PeriodKind[]).map(k => (
            <button
              key={k}
              onClick={() => { setPeriod(k); setQuadrant(null) }}
              className={`text-xs px-3 py-1.5 rounded-full border ${period === k ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 hover:border-gray-400'}`}
            >
              {PERIOD_LABELS[k]}
            </button>
          ))}
          {period === 'custom' && (
            <span className="flex items-center gap-1 text-xs">
              <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} className="border rounded px-1.5 py-1" />
              ~
              <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} className="border rounded px-1.5 py-1" />
            </span>
          )}
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="ml-auto border rounded px-2 py-1.5 text-xs">
            <option value="">전체 계좌</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.nickname || `${a.broker} ${a.accountNumber}`}</option>)}
          </select>
        </div>

        {/* 복기 대기 */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 className="font-semibold text-sm">
              복기 대기 <span className="text-blue-600">{pendingAll ? pendingAllList.length : pendingRecent.length}</span>
              <span className="text-xs font-normal text-gray-400 ml-2">{pendingAll ? '전체 매도 완료 거래' : '최근 30일 매도분'}</span>
            </h2>
            <button onClick={() => setPendingAll(v => !v)} className="text-xs text-blue-500 hover:text-blue-700">
              {pendingAll ? '최근 30일만 보기' : `전체 보기 (${pendingAllList.length})`}
            </button>
          </div>
          {!loaded && <p className="text-xs text-gray-400">불러오는 중...</p>}
          {loaded && pending.length === 0 && (
            <p className="text-xs text-gray-400">복기할 거래가 없어요. 매도를 마친 거래가 여기에 쌓입니다.</p>
          )}
          {pending.slice(0, 5).map(t => (
            <PendingCard
              key={t.id}
              t={t}
              onSaved={load}
              onSkip={() => setSkipped(prev => new Set(prev).add(t.id))}
              onOpen={() => setEditTrade(t)}
            />
          ))}
          {pending.length > 5 && <p className="text-xs text-gray-400 text-center">외 {pending.length - 5}건 — 위 카드를 정리하면 이어서 보여요</p>}
        </section>

        {/* 기간 요약 */}
        <section className="space-y-2">
          <p className="text-xs text-gray-400">
            {range.start} ~ {range.end} 매도 완료 {s.count}건 · 복기 {reviewedCount}/{s.count}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="순손익" value={signedKRW(s.profit)} tone={s.profit} sub={`${s.count}건`} />
            <Tile label="승률" value={s.winRate != null ? `${s.winRate.toFixed(0)}%` : '-'} />
            <Tile label="평균 이익 / 손실" value={`${formatRate(s.avgWinRate)} / ${formatRate(s.avgLossRate)}`} />
            <Tile label="손익비" value={s.payoffRatio != null ? s.payoffRatio.toFixed(2) : '-'} sub="평균 이익 ÷ 평균 손실" />
            <Tile label="기대값" value={formatRate(s.expectancyRate)} tone={s.expectancyRate} sub="거래당 평균 수익률" />
            <Tile
              label="계획 준수율"
              value={s.adherenceRate != null ? `${s.adherenceRate.toFixed(0)}%` : '-'}
              sub={`${s.followed.count}/${s.plannedCount}건${s.noPlanCount ? ` · 계획 없음 ${s.noPlanCount}` : ''}`}
            />
          </div>
        </section>

        {/* 결과 × 과정 */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-sm">결과 × 과정</h2>
            <span className="text-[11px] text-gray-400">거래 계획(목표가·손절가·보유기간) 기준</span>
          </div>
          <div className="grid grid-cols-[36px_1fr_1fr] gap-2 text-xs">
            <span />
            <span className="text-center text-gray-400">계획 준수</span>
            <span className="text-center text-gray-400">계획 이탈</span>
            {([['수익', 'good', 'lucky'], ['손실', 'goodLoss', 'bad']] as const).map(([row, a, b]) => (
              <div key={row} className="contents">
                <span className="self-center text-gray-400">{row}</span>
                {[a, b].map(q => {
                  const qb = s.quadrants[q]
                  return (
                    <button
                      key={q}
                      onClick={() => setQuadrant(cur => cur === q ? null : q)}
                      className={`text-left border rounded-lg p-3 ${QUADRANT_STYLE[q]} ${quadrant === q ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                    >
                      <p className="font-semibold">{QUADRANT_LABELS[q]} <span className="font-normal">{qb.count}건</span></p>
                      <p className="mt-0.5 tabular-nums">{qb.avgRate != null ? `평균 ${formatRate(qb.avgRate)} · ${signedKRW(qb.profit)}` : QUADRANT_HINT[q]}</p>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {quadrant && (
            <div className="border-t pt-3 space-y-1.5">
              <p className="text-xs text-gray-500">{QUADRANT_LABELS[quadrant]} — {QUADRANT_HINT[quadrant]}</p>
              {quadrantTrades.length === 0 && <p className="text-xs text-gray-400">이 기간에는 없어요.</p>}
              {quadrantTrades.map(t => (
                <button key={t.id} onClick={() => setEditTrade(t)} className="w-full text-left flex flex-wrap items-center gap-x-2 gap-y-1 text-xs py-1.5 border-b last:border-b-0 hover:bg-gray-50">
                  <span className="font-medium text-sm">{t.symbol}</span>
                  <span className={`tabular-nums ${toneCls(t.profitRate)}`}>{formatRate(t.profitRate)}</span>
                  <span className="text-gray-400">{t.holdingDays}일</span>
                  <EvalBadges t={t} r={t.review} />
                  {t.exitReason && <span className="text-gray-500">· {t.exitReason}</span>}
                  {t.exitComment && <span className="text-gray-400 truncate max-w-full basis-full">{t.exitComment}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 계획 지킨 거래 vs 어긴 거래 */}
        <section className="bg-white border rounded-lg p-4 space-y-2.5">
          <h2 className="font-semibold text-sm">계획 지킨 거래 vs 어긴 거래</h2>
          <p className="text-[11px] text-gray-400">평균 수익률 · 이름 옆 숫자는 건수</p>
          <CompareBar label="계획 준수" value={s.followed.avgRate} max={compareMax} n={s.followed.count} />
          <CompareBar label="계획 이탈" value={s.deviated.avgRate} max={compareMax} n={s.deviated.count} />
          <div className="border-t my-1" />
          <CompareBar label="손절 준수 손실" value={s.stopKeptLoss.avgRate} max={compareMax} n={s.stopKeptLoss.count} />
          <CompareBar label="손절 늦은 손실" value={s.lateStopLoss.avgRate} max={compareMax} n={s.lateStopLoss.count} />
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-gray-500 items-center">
            이탈 유형
            {(Object.entries(s.deviationCounts) as [string, number][]).map(([d, n]) => (
              <Badge key={d} tone={n > 0 ? 'bad' : 'neutral'}>{d} {n}</Badge>
            ))}
          </div>
        </section>
      </div>

      {editTrade && (
        <TradeModal
          trade={editTrade}
          trades={trades}
          accounts={accounts}
          onClose={() => setEditTrade(null)}
          onSave={() => { setEditTrade(null); load() }}
        />
      )}
    </div>
  )
}
