'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { HOLDING_PLAN_OPTIONS, type Account, type Strategy, type Trade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatRate } from '@/lib/utils'
import { BAD_DEVIATIONS, buildCycles, findDeviations, ruleText, summarizeCycles, type Deviation } from '@/lib/strategy'
import StrategyForm from '@/components/StrategyForm'
import TradeModal from '@/components/TradeModal'

const inputCls = 'border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400'

function DeviationBadge({ d }: { d: Deviation }) {
  const bad = BAD_DEVIATIONS.includes(d)
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${bad ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{d}</span>
  )
}

function Tile({ label, value, tone, sub }: { label: string; value: string; tone?: 'up' | 'down'; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg px-3 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${tone === 'up' ? 'text-red-500' : tone === 'down' ? 'text-blue-500' : ''}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 tabular-nums">{sub}</p>}
    </div>
  )
}

const toneOf = (n: number) => n > 0 ? 'up' : n < 0 ? 'down' : undefined

function firstBuy(t: Trade): string {
  return (t.buyEntries.length > 0 ? t.buyEntries.reduce((m, e) => e.date < m ? e.date : m, t.buyEntries[0].date) : t.createdAt).slice(0, 10)
}

export default function StrategyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTrade, setEditTrade] = useState<Trade | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  async function load() {
    const [s, t, a] = await Promise.all([
      apiFetch('/api/strategies').then(r => r.json()),
      apiFetch('/api/trades').then(r => r.json()),
      apiFetch('/api/accounts').then(r => r.json()),
    ])
    if (Array.isArray(s)) {
      setStrategies(s)
      setStrategy(s.find((x: Strategy) => x.id === id) ?? null)
    }
    if (Array.isArray(t)) setTrades(t)
    if (Array.isArray(a)) setAccounts(a)
    setLoaded(true)
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => trades.filter(t => t.strategyId === id), [trades, id])
  const cycles = useMemo(() => strategy ? buildCycles(mine, strategy) : [], [mine, strategy])
  const summary = useMemo(() => summarizeCycles(cycles, strategy?.seedMoney), [cycles, strategy])
  const open = useMemo(() => mine.filter(t => !t.isCompleted).sort((a, b) => firstBuy(a).localeCompare(firstBuy(b))), [mine])
  const chartData = useMemo(() => [
    { no: 0, 실제: 0, 계획대로: 0 },
    ...cycles.map(c => ({ no: c.no, 실제: Number(c.cumRate.toFixed(2)), 계획대로: Number(c.planCumRate.toFixed(2)) })),
  ], [cycles])

  async function assign(tradeIds: string[], strategyId: string | null) {
    const res = await apiFetch('/api/trades/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeIds, strategyId }),
    })
    if (res.ok) await load()
  }

  async function handleDelete() {
    if (!strategy) return
    const msg = mine.length > 0
      ? `"${strategy.name}" 전략을 삭제할까요?\n담긴 거래 ${mine.length}건은 지워지지 않고 전략 지정만 풀립니다.`
      : `"${strategy.name}" 전략을 삭제할까요?`
    if (!confirm(msg)) return
    const res = await apiFetch(`/api/strategies/${strategy.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/strategies')
  }

  if (loaded && !strategy) {
    return (
      <div className="min-h-screen p-6 text-center text-sm text-gray-500">
        전략을 찾을 수 없어요. <Link href="/strategies" className="text-blue-500">전략 목록</Link>
      </div>
    )
  }
  if (!strategy) return <div className="min-h-screen" />

  const planGap = summary.cumRate - summary.planCumRate

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/strategies" className="text-gray-400 hover:text-gray-700 text-sm">← 전략</Link>
        <h1 className="text-lg font-bold truncate">{strategy.name}</h1>
        <div className="ml-auto flex gap-2 shrink-0">
          <button onClick={() => setEditing(v => !v)} className="text-sm px-3 py-1.5 rounded border text-gray-500 hover:text-gray-800">수정</button>
          <button onClick={handleDelete} className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50">삭제</button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {editing ? (
          <StrategyForm strategy={strategy} onSaved={() => { setEditing(false); load() }} onCancel={() => setEditing(false)} />
        ) : (
          <div className="text-xs text-gray-500 space-y-0.5">
            {ruleText(strategy) && <p>{ruleText(strategy)}{strategy.seedMoney ? ` · 시작 ${formatKRW(strategy.seedMoney)}` : ''}</p>}
            {strategy.description && <p className="text-gray-400">{strategy.description}</p>}
          </div>
        )}

        {/* 요약 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="회차 (완료)" value={`${summary.count}회`} sub={open.length > 0 ? `보유중 ${open.length}` : undefined} />
          <Tile label="승률" value={`${summary.winRate.toFixed(0)}%`} sub={`${summary.wins}승 ${summary.count - summary.wins}패`} />
          <Tile label="평균 익절 / 손절" value={`${formatRate(summary.avgWinRate)} / ${formatRate(summary.avgLossRate)}`} />
          <Tile label="계획 준수" value={`${summary.adherenceRate.toFixed(0)}%`} sub="이탈 없는 회차" />
          <Tile label="실제 누적 복리" value={formatRate(summary.cumRate)} tone={toneOf(summary.cumRate)} sub={summary.finalAmount != null ? formatKRW(Math.round(summary.finalAmount)) : undefined} />
          <Tile label="계획대로였다면" value={formatRate(summary.planCumRate)} tone={toneOf(summary.planCumRate)} sub={summary.planFinalAmount != null ? formatKRW(Math.round(summary.planFinalAmount)) : undefined} />
          <Tile label="계획 대비" value={formatRate(planGap)} tone={toneOf(planGap)} sub="실제 − 계획 (%p)" />
        </div>
        {(strategy.targetPct == null || strategy.stopLossPct == null) && summary.count > 0 && (
          <p className="text-xs text-gray-400">익절 목표나 손절 기준이 비어 있으면 그 쪽은 실제 수익률로 계획 곡선을 그려요.</p>
        )}

        {/* 누적 곡선 */}
        {cycles.length > 0 && (
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">회차별 누적 복리 수익률 (%) — 같은 승패를 목표/손절 비율대로 끊었다면과 비교</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="no" tick={{ fontSize: 11 }} tickFormatter={n => n === 0 ? '' : `${n}`} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={v => `${v}%`} labelFormatter={n => n === 0 ? '시작' : `${n}회차`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#d1d5db" />
                <Line type="monotone" dataKey="실제" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="계획대로" stroke="#9ca3af" strokeDasharray="4 3" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 보유중 */}
        {open.length > 0 && (
          <div className="bg-white border rounded-lg overflow-hidden">
            <p className="text-xs font-semibold text-gray-600 px-3 py-2 border-b bg-gray-50">진행 중</p>
            {open.map(t => (
              <div key={t.id} className="px-3 py-2 border-b last:border-b-0 flex items-center gap-2 text-sm">
                <button onClick={() => setEditTrade(t)} className="font-medium hover:text-blue-600 truncate">{t.symbol}</button>
                <span className="text-xs text-gray-400">{firstBuy(t)} 매수</span>
                <span className="ml-auto text-xs tabular-nums text-gray-500">
                  {t.holdingDays}일{strategy.plannedDays != null ? ` / ${strategy.plannedDays}일` : ''}
                </span>
                {findDeviations(t, strategy).map(d => <DeviationBadge key={d} d={d} />)}
              </div>
            ))}
          </div>
        )}

        {/* 회차 표 */}
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">회차</th>
                <th className="px-2 py-2 text-left font-medium">종목</th>
                <th className="px-2 py-2 text-left font-medium whitespace-nowrap">매수 → 매도</th>
                <th className="px-2 py-2 text-right font-medium">보유</th>
                <th className="px-2 py-2 text-center font-medium">결과</th>
                <th className="px-2 py-2 text-right font-medium">수익률</th>
                <th className="px-2 py-2 text-right font-medium">누적</th>
                <th className="px-2 py-2 text-left font-medium">계획 대비</th>
                <th className="px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-xs text-gray-400">완료된 회차가 없어요. 아래 &lsquo;거래 담기&rsquo;로 거래를 추가하세요.</td></tr>
              )}
              {[...cycles].reverse().map(c => (
                <tr key={c.trade.id} className="border-t">
                  <td className="px-2 py-1.5 text-xs text-gray-400 tabular-nums">{c.no}</td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => setEditTrade(c.trade)} className="hover:text-blue-600 text-left">{c.trade.symbol}</button>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">{c.startDate.slice(2)} → {c.endDate.slice(5)}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums">{c.trade.holdingDays}일</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`text-xs ${c.win ? 'text-red-500' : 'text-blue-500'}`}>{c.win ? '성공' : '실패'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${c.netRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{formatRate(c.netRate)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${c.cumRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{formatRate(c.cumRate)}</td>
                  <td className="px-2 py-1.5"><div className="flex gap-1 flex-wrap">{c.deviations.map(d => <DeviationBadge key={d} d={d} />)}</div></td>
                  <td className="px-1 py-1.5">
                    <button onClick={() => assign([c.trade.id], null)} title="이 전략에서 빼기" className="text-gray-300 hover:text-red-500 text-base leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 거래 담기 */}
        <div className="bg-white border rounded-lg">
          <button onClick={() => setShowPicker(v => !v)} className="w-full flex justify-between items-center px-3 py-2 text-sm font-medium text-gray-700">
            <span>거래 담기</span>
            <span className="text-gray-400">{showPicker ? '▲' : '▼'}</span>
          </button>
          {showPicker && (
            <TradePicker
              trades={trades}
              accounts={accounts}
              strategies={strategies}
              strategyId={id}
              plannedDays={strategy.plannedDays ?? null}
              onAssign={ids => assign(ids, id)}
            />
          )}
        </div>
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

interface PickerProps {
  trades: Trade[]
  accounts: Account[]
  strategies: Strategy[]
  strategyId: string
  plannedDays: number | null
  onAssign: (ids: string[]) => Promise<void>
}

// 기존 거래를 조건으로 걸러 한 번에 전략에 담는다
function TradePicker({ trades, accounts, strategies, strategyId, plannedDays, onAssign }: PickerProps) {
  const [accountId, setAccountId] = useState('')
  const [status, setStatus] = useState<'' | '완료' | '보유중'>('')
  const [plan, setPlan] = useState('')
  const [maxDays, setMaxDays] = useState(plannedDays != null ? String(plannedDays) : '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [includeOther, setIncludeOther] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const strategyName = Object.fromEntries(strategies.map(s => [s.id, s.name]))
  const accountName = Object.fromEntries(accounts.map(a => [a.id, a.nickname || `${a.broker} ${a.accountNumber}`]))

  const candidates = useMemo(() => trades
    .filter(t => t.strategyId !== strategyId)
    .filter(t => includeOther || !t.strategyId)
    .filter(t => !accountId || t.accountId === accountId)
    .filter(t => !status || (status === '완료' ? t.isCompleted : !t.isCompleted))
    .filter(t => !plan || t.plannedHoldingPeriod === plan)
    .filter(t => !maxDays || t.holdingDays <= Number(maxDays))
    .filter(t => !from || firstBuy(t) >= from)
    .filter(t => !to || firstBuy(t) <= to)
    .filter(t => !search || t.symbol.includes(search.trim()))
    .sort((a, b) => firstBuy(b).localeCompare(firstBuy(a))),
  [trades, strategyId, includeOther, accountId, status, plan, maxDays, from, to, search])

  const allChecked = candidates.length > 0 && candidates.every(t => selected.has(t.id))

  function toggle(tid: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid)
      else next.add(tid)
      return next
    })
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(candidates.map(t => t.id)))
  }

  async function submit() {
    const ids = candidates.filter(t => selected.has(t.id)).map(t => t.id)
    if (ids.length === 0) return
    setSaving(true)
    try {
      await onAssign(ids)
      setSelected(new Set())
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = candidates.filter(t => selected.has(t.id)).length

  return (
    <div className="border-t px-3 py-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputCls}>
          <option value="">전체 계좌</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{accountName[a.id]}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inputCls}>
          <option value="">완료+보유중</option>
          <option value="완료">완료</option>
          <option value="보유중">보유중</option>
        </select>
        <select value={plan} onChange={e => setPlan(e.target.value)} className={inputCls}>
          <option value="">계획 전체</option>
          {HOLDING_PLAN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <label className="text-xs text-gray-500 flex items-center gap-1">
          보유
          <input inputMode="numeric" value={maxDays} onChange={e => setMaxDays(e.target.value.replace(/\D/g, ''))} className={`${inputCls} w-12`} />
          일 이하
        </label>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-gray-500 flex items-center gap-1">
          매수일 <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          ~ <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
        </label>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="종목" className={`${inputCls} w-24`} />
        <label className="text-xs text-gray-500 flex items-center gap-1">
          <input type="checkbox" checked={includeOther} onChange={e => setIncludeOther(e.target.checked)} />
          다른 전략 거래도 보기
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={candidates.length === 0} />
          {candidates.length}건 전체 선택
        </label>
        <button
          onClick={submit}
          disabled={saving || selectedCount === 0}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? '담는 중...' : `${selectedCount}건 담기`}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto border rounded divide-y">
        {candidates.length === 0 && <p className="text-xs text-gray-400 text-center py-4">조건에 맞는 거래가 없어요.</p>}
        {candidates.map(t => (
          <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
            <span className="truncate">{t.symbol}</span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{firstBuy(t).slice(2)} · {t.holdingDays}일</span>
            {t.strategyId && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">{strategyName[t.strategyId] ?? '다른 전략'}</span>}
            <span className="ml-auto text-[11px] text-gray-400 truncate hidden sm:inline">{accountName[t.accountId]}</span>
            <span className={`text-xs tabular-nums whitespace-nowrap ${!t.isCompleted ? 'text-gray-400' : t.profitRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {t.isCompleted ? formatRate(t.profitRate) : '보유중'}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
