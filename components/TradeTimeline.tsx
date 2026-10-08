'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HOLDING_PLAN_OPTIONS, type Trade, type Account, type TradeImage } from '@/lib/types'
import { formatKRW, formatRate } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import TradeChart from './TradeChart'
import TradeImageZone from './TradeImageZone'

const TYPE_STYLE: Record<string, string> = {
  코스피: 'bg-blue-50 text-blue-600 border-blue-200',
  코스닥: 'bg-green-50 text-green-600 border-green-200',
  ETF: 'bg-purple-50 text-purple-600 border-purple-200',
}

interface Props {
  trades: Trade[]
  accounts: Account[]
  symbolTypeMap?: Record<string, string>
  onEdit: (trade: Trade) => void
}

type WinFilter = 'all' | 'win' | 'loss'
type GroupMode = 'week' | 'month'
const COLUMNS_SHOWN = 4
const PRICE_CHUNK = 20
const MARKET_TYPES = ['코스피', '코스닥', 'ETF'] as const
const NO_PLAN = '계획 없음'
const PLAN_OPTIONS = [...HOLDING_PLAN_OPTIONS, NO_PLAN] as const

// 실제 보유일 구간
const HOLDING_DAYS_TIERS = [
  { id: 'hd-1',   label: '1일 이내',   test: (d: number) => d <= 1 },
  { id: 'hd-7',   label: '1주일 이내', test: (d: number) => d <= 7 },
  { id: 'hd-30',  label: '1달 이내',   test: (d: number) => d <= 30 },
  { id: 'hd-90',  label: '3개월 이내', test: (d: number) => d <= 90 },
  { id: 'hd-180', label: '6개월 이내', test: (d: number) => d <= 180 },
  { id: 'hd-180+', label: '6개월 이상', test: (_d: number) => true },
] as const

function holdingDaysTier(days: number) {
  return HOLDING_DAYS_TIERS.find(t => t.test(days))!
}

function getWeekStart(d: Date) {
  const day = (d.getDay() + 6) % 7 // 월=0 ... 일=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function fmtMD(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}
function fmtYM(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 수익률 구간별 색상 + 테두리 두께 (진할수록/두꺼울수록 손익이 큼)
const RATE_TIERS = [
  { id: 'red-700',  label: '+20% 이상',   test: (r: number) => r >= 20,  border: 'border-l-red-700',  text: 'text-red-700',  dot: 'bg-red-700',  width: 'border-l-8' },
  { id: 'red-500',  label: '+10 ~ 20%',  test: (r: number) => r >= 10,  border: 'border-l-red-500',  text: 'text-red-500',  dot: 'bg-red-500',  width: 'border-l-4' },
  { id: 'red-300',  label: '0 ~ 10%',    test: (r: number) => r > 0,    border: 'border-l-red-300',  text: 'text-red-400',  dot: 'bg-red-300',  width: 'border-l-2' },
  { id: 'gray-300', label: '0%',         test: (r: number) => r === 0,  border: 'border-l-gray-300', text: 'text-gray-500', dot: 'bg-gray-300', width: 'border-l-2' },
  { id: 'blue-300', label: '0 ~ -10%',   test: (r: number) => r > -10,  border: 'border-l-blue-300', text: 'text-blue-400', dot: 'bg-blue-300', width: 'border-l-2' },
  { id: 'blue-500', label: '-10 ~ -20%', test: (r: number) => r > -20,  border: 'border-l-blue-500', text: 'text-blue-500', dot: 'bg-blue-500', width: 'border-l-4' },
  { id: 'blue-700', label: '-20% 이하',   test: (_r: number) => true,   border: 'border-l-blue-700', text: 'text-blue-700', dot: 'bg-blue-700', width: 'border-l-8' },
] as const

interface TimelineRow { trade: Trade; entryDate: string; exitDate: string; exitPrice: number; isWin: boolean }

// 같은 칸 안에서 종목별로 묶음. 칸의 정렬(최근 매도순)을 유지하도록 각 종목이 처음 나온 위치 순서로 둔다
function groupItems(items: TimelineRow[]): { symbol: string; items: TimelineRow[] }[] {
  const map = new Map<string, TimelineRow[]>()
  items.forEach(r => {
    const list = map.get(r.trade.symbol)
    if (list) list.push(r)
    else map.set(r.trade.symbol, [r])
  })
  return [...map.entries()].map(([symbol, items]) => ({ symbol, items }))
}

function rateTier(rate: number) {
  return RATE_TIERS.find(t => t.test(rate))!
}

// 매도 후 현재가 비교 — 왼쪽 테두리(수익률 빨강/파랑)와 겹치지 않도록 다른 색 계열의 옅은 배경
const AFTER_SELL_STYLE = {
  up:   { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-50 border border-amber-300',   label: '매도 후 상승' },
  down: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-50 border border-emerald-300', label: '매도 후 하락' },
} as const

function afterSell(currentPrice: number | undefined, sellPrice: number) {
  if (currentPrice == null || !(sellPrice > 0) || currentPrice === sellPrice) return null
  const diffRate = (currentPrice / sellPrice - 1) * 100
  const dir = currentPrice > sellPrice ? 'up' : 'down'
  return { currentPrice, diffRate, dir, style: AFTER_SELL_STYLE[dir] }
}

// 매도 결과(익절/손절) × 매도 후 흐름(상승/하락)
const OUTCOMES = [
  { id: 'win-down',  label: '익절 후 하락', note: '잘 팜' },
  { id: 'win-up',    label: '익절 후 상승', note: '일찍 팜' },
  { id: 'loss-down', label: '손절 후 하락', note: '잘 끊음' },
  { id: 'loss-up',   label: '손절 후 상승', note: '아쉬운 손절' },
] as const

function outcomeOf(isWin: boolean, after: ReturnType<typeof afterSell>) {
  if (!after) return null
  return OUTCOMES.find(o => o.id === `${isWin ? 'win' : 'loss'}-${after.dir}`)!
}

function OutcomeBadge({ outcome, after }: { outcome: (typeof OUTCOMES)[number]; after: NonNullable<ReturnType<typeof afterSell>> }) {
  return (
    <span className={`ml-1 px-1.5 py-0.5 rounded-full border border-current text-[10px] font-medium whitespace-nowrap ${after.style.text}`}>
      {outcome.label} · {outcome.note}
    </span>
  )
}

// 손익 금액 구간 (수익률 구간과 같은 색 체계)
const AMOUNT_TIERS = [
  { id: 'amt-p100', label: '+100만 이상',     test: (a: number) => a >= 1_000_000, dot: 'bg-red-700' },
  { id: 'amt-p10',  label: '+10만 ~ 100만',   test: (a: number) => a >= 100_000,   dot: 'bg-red-500' },
  { id: 'amt-p0',   label: '0 ~ +10만',       test: (a: number) => a > 0,          dot: 'bg-red-300' },
  { id: 'amt-0',    label: '0원',             test: (a: number) => a === 0,        dot: 'bg-gray-300' },
  { id: 'amt-m0',   label: '0 ~ -10만',       test: (a: number) => a > -100_000,   dot: 'bg-blue-300' },
  { id: 'amt-m10',  label: '-10만 ~ -100만',  test: (a: number) => a > -1_000_000, dot: 'bg-blue-500' },
  { id: 'amt-m100', label: '-100만 이하',     test: (_a: number) => true,          dot: 'bg-blue-700' },
] as const

function amountTier(amount: number) {
  return AMOUNT_TIERS.find(t => t.test(Math.round(amount)))!
}

export default function TradeTimeline({ trades, accounts, symbolTypeMap = {}, onEdit }: Props) {
  const [winFilter, setWinFilter] = useState<WinFilter>('all')
  const [marketFilters, setMarketFilters] = useState<string[]>([])
  const [tierFilters, setTierFilters] = useState<string[]>([])
  const [amountFilters, setAmountFilters] = useState<string[]>([])
  const [planFilters, setPlanFilters] = useState<string[]>([])
  const [holdingFilters, setHoldingFilters] = useState<string[]>([])
  const [outcomeFilters, setOutcomeFilters] = useState<string[]>([])
  const [groupMode, setGroupMode] = useState<GroupMode>('week')
  const [offset, setOffset] = useState(0) // 0 = 이번 주/달이 가장 오른쪽
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [groupBySymbol, setGroupBySymbol] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [imagesMap, setImagesMap] = useState<Record<string, TradeImage[]>>({})
  const [priceMap, setPriceMap] = useState<Record<string, number>>({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [priceStatus, setPriceStatus] = useState<{ ok: number; total: number; error: string | null } | null>(null)
  const requestedCodes = useRef<Set<string>>(new Set())

  function changeGroupMode(mode: GroupMode) {
    setGroupMode(mode)
    setOffset(0)
  }

  function toggleMarket(type: string) {
    setMarketFilters(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  function toggleTier(id: string) {
    setTierFilters(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  function toggleAmount(id: string) {
    setAmountFilters(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])
  }

  function togglePlan(plan: string) {
    setPlanFilters(prev => prev.includes(plan) ? prev.filter(p => p !== plan) : [...prev, plan])
  }

  function toggleOutcome(id: string) {
    setOutcomeFilters(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id])
  }

  function toggleHolding(id: string) {
    setHoldingFilters(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id])
  }

  function toggleExpand(tradeId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(tradeId) ? next.delete(tradeId) : next.add(tradeId)
      return next
    })
  }

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {}
    accounts.forEach(a => { m[a.id] = a })
    return m
  }, [accounts])

  const rows = useMemo(() => {
    return trades
      .filter(t => t.isCompleted)
      .map(t => {
        const entryDate = t.buyEntries.reduce((min, e) => e.date < min ? e.date : min, t.buyEntries[0]?.date ?? t.createdAt)
        const exitDate = t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0]?.date ?? t.createdAt)
        const exitPrice = t.totalSellQuantity > 0 ? t.totalSellAmount / t.totalSellQuantity : 0
        return { trade: t, entryDate, exitDate, exitPrice, isWin: t.profitAmount >= 0 }
      })
      .filter(r => winFilter === 'all' || (winFilter === 'win' ? r.isWin : !r.isWin))
      .filter(r => marketFilters.length === 0 || marketFilters.includes(symbolTypeMap[r.trade.symbol] ?? ''))
      .filter(r => tierFilters.length === 0 || tierFilters.includes(rateTier(r.trade.profitRate).id))
      .filter(r => amountFilters.length === 0 || amountFilters.includes(amountTier(r.trade.profitAmount).id))
      .filter(r => planFilters.length === 0 || planFilters.includes(r.trade.plannedHoldingPeriod || NO_PLAN))
      .filter(r => holdingFilters.length === 0 || holdingFilters.includes(holdingDaysTier(r.trade.holdingDays).id))
  }, [trades, winFilter, marketFilters, tierFilters, amountFilters, planFilters, holdingFilters, symbolTypeMap])

  // 거래 없는 최근 주/달이 오른쪽에 비어 보이지 않도록, 가장 최근 거래가 있는 시점을 기준으로 삼음
  const anchorDate = useMemo(() => {
    if (rows.length === 0) return new Date()
    const maxExit = rows.reduce((max, r) => r.exitDate > max ? r.exitDate : max, rows[0].exitDate)
    return new Date(maxExit.slice(0, 10))
  }, [rows])

  const baseColumns = useMemo(() => {
    if (groupMode === 'week') {
      const thisWeekStart = getWeekStart(anchorDate)
      return Array.from({ length: COLUMNS_SHOWN }, (_, i) => {
        const backFromNewest = offset + (COLUMNS_SHOWN - 1 - i)
        const start = addDays(thisWeekStart, -backFromNewest * 7)
        const end = addDays(start, 6)
        const startKey = start.toISOString().slice(0, 10)
        const endKey = end.toISOString().slice(0, 10)
        const items = rows
          .filter(r => { const k = r.exitDate.slice(0, 10); return k >= startKey && k <= endKey })
          .sort((a, b) => b.exitDate.localeCompare(a.exitDate))
        const total = items.reduce((s, r) => s + r.trade.profitAmount, 0)
        return { label: `${fmtMD(start)} ~ ${fmtMD(end)}`, items, total }
      })
    }
    const thisMonthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    return Array.from({ length: COLUMNS_SHOWN }, (_, i) => {
      const backFromNewest = offset + (COLUMNS_SHOWN - 1 - i)
      const start = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - backFromNewest, 1)
      const prefix = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      const items = rows
        .filter(r => r.exitDate.slice(0, 7) === prefix)
        .sort((a, b) => b.exitDate.localeCompare(a.exitDate))
      const total = items.reduce((s, r) => s + r.trade.profitAmount, 0)
      return { label: fmtYM(start), items, total }
    })
  }, [rows, offset, groupMode, anchorDate])

  // 화면에 보이는 칸의 종목만 현재가 조회 (이미 조회한 종목은 건너뜀)
  // 매도 후 흐름 필터는 현재가가 있어야 걸러지므로, 필터 적용 전 칸 기준으로 조회한다
  const visibleCodes = useMemo(() => {
    const codes = new Set<string>()
    baseColumns.forEach(c => c.items.forEach(r => { if (r.trade.symbolCode) codes.add(r.trade.symbolCode) }))
    return [...codes].sort()
  }, [baseColumns])

  const columns = useMemo(() => {
    if (outcomeFilters.length === 0) return baseColumns
    return baseColumns.map(c => {
      const items = c.items.filter(r => {
        const o = outcomeOf(r.isWin, afterSell(r.trade.symbolCode ? priceMap[r.trade.symbolCode] : undefined, r.exitPrice))
        return o != null && outcomeFilters.includes(o.id)
      })
      return { ...c, items, total: items.reduce((s, r) => s + r.trade.profitAmount, 0) }
    })
  }, [baseColumns, outcomeFilters, priceMap])

  async function loadPrices(codes: string[]) {
    if (codes.length === 0) return
    codes.forEach(c => requestedCodes.current.add(c))
    setPricesLoading(true)
    const map: Record<string, number> = {}
    let error: string | null = null
    // 한 번에 너무 많은 종목을 보내지 않도록 나눠서 조회
    const chunks: string[][] = []
    for (let i = 0; i < codes.length; i += PRICE_CHUNK) chunks.push(codes.slice(i, i + PRICE_CHUNK))
    await Promise.all(chunks.map(async chunk => {
      try {
        const res = await apiFetch(`/api/stock-price?codes=${chunk.join(',')}`)
        const json = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(json?.data)) {
          error = json?.error ?? `응답 오류 (${res.status})`
          return
        }
        for (const item of json.data) {
          const code = String(item.code ?? '').replace(/^A/, '')
          const price = Number(String(item.price ?? '').replace(/,/g, ''))
          if (code && Number.isFinite(price) && price > 0) map[code] = price
        }
      } catch {
        error = '현재가 서버에 연결할 수 없습니다.'
      }
    }))
    setPriceMap(prev => ({ ...prev, ...map }))
    const ok = codes.filter(c => map[c] != null).length
    if (ok < codes.length) console.warn('[복기 현재가] 조회 실패 종목', codes.filter(c => map[c] == null), error)
    setPriceStatus({ ok, total: codes.length, error })
    // 실패한 종목은 다음에 다시 조회할 수 있도록 남겨 두지 않음
    codes.forEach(c => { if (map[c] == null) requestedCodes.current.delete(c) })
    setPricesLoading(false)
  }

  useEffect(() => {
    loadPrices(visibleCodes.filter(c => !requestedCodes.current.has(c)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCodes.join(',')])

  function renderCard({ trade, exitDate, exitPrice, isWin }: TimelineRow) {
    const account = accountMap[trade.accountId]
    const marketType = symbolTypeMap[trade.symbol]
    const isExpanded = expanded.has(trade.id)
    const color = rateTier(trade.profitRate)
    const entries = [
      ...trade.buyEntries.map(e => ({ ...e, type: '매수' as const })),
      ...trade.sellEntries.map(e => ({ ...e, type: '매도' as const })),
    ].sort((a, b) => a.date.localeCompare(b.date))
    const accountLabel = account ? (account.nickname || `${account.broker} ${account.accountNumber}`) : null
    const after = afterSell(trade.symbolCode ? priceMap[trade.symbolCode] : undefined, exitPrice)
    const outcome = outcomeOf(isWin, after)
    return (
      <div key={trade.id} className={`${after?.style.bg ?? 'bg-white'} rounded-lg border overflow-hidden space-y-1.5 ${color.width} ${color.border}`}>
        <div className="p-3 pb-0 space-y-1.5">
          <div className="flex justify-between items-start gap-1">
            <div className="min-w-0">
              <div>
                {marketType && (
                  <span className={`text-[10px] px-1 py-0.5 rounded border font-medium mr-1 ${TYPE_STYLE[marketType] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {marketType}
                  </span>
                )}
                <span className="font-semibold text-sm">{trade.symbol}</span>
              <a
                href={
                  trade.symbolCode
                    ? `https://stock.naver.com/domestic/stock/${trade.symbolCode}/price`
                    : `https://finance.naver.com/search/search.naver?query=${encodeURIComponent(trade.symbol)}&endUrl=&encoding=UTF-8`
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-green-500 hover:text-green-700 text-xs font-bold ml-1"
                title="네이버 금융 차트 열기"
              >N</a>
              {trade.symbolCode && (
                <a
                  href={`https://www.tradingview.com/chart/?symbol=KRX%3A${trade.symbolCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-600 text-xs ml-1"
                  title="트레이딩뷰 차트 열기"
                >📈</a>
              )}
              </div>
              <p className="text-[11px] text-gray-400">
                {accountLabel && <>{accountLabel} · </>}
                <span className="tabular-nums">{exitDate.slice(5, 10)}</span>
                {' · 보유 '}{trade.holdingDays}일{' · '}
                <span className={`font-medium ${color.text}`}>{formatRate(trade.profitRate)}</span>
              </p>
              {after && (
                <p className="text-[11px] text-gray-400">
                  매도 {formatKRW(Math.round(exitPrice))} → 현재 {formatKRW(after.currentPrice)}{' '}
                  <span className={`font-medium ${after.style.text}`}>{formatRate(after.diffRate)}</span>
                  {outcome && <OutcomeBadge outcome={outcome} after={after} />}
                </p>
              )}
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${color.text}`}>
              {isWin ? '+' : ''}{formatKRW(Math.round(trade.profitAmount))}
            </span>
          </div>
          {trade.comment && (
            <p className="text-xs text-gray-700 bg-gray-50 rounded p-1.5 whitespace-pre-wrap">💬 {trade.comment}</p>
          )}
          {trade.exitComment && (
            <p className="text-xs text-gray-700 bg-amber-50 rounded p-1.5 whitespace-pre-wrap">📝 {trade.exitComment}</p>
          )}
          <div className="flex gap-1.5 justify-end pb-3">
            <button onClick={() => toggleExpand(trade.id)} className="text-[11px] text-gray-500 hover:text-gray-800 px-1.5 py-0.5 border rounded">
              {isExpanded ? '▲ 접기' : '▼ 상세'}
            </button>
            <button
              onClick={() => onEdit(trade)}
              className={`text-[11px] px-1.5 py-0.5 border rounded ${
                !trade.plannedHoldingPeriod
                  ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >수정</button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t">
            <TradeChart
              buyEntries={trade.buyEntries}
              sellEntries={trade.sellEntries}
              avgBuyPrice={trade.avgBuyPrice}
              isCompleted={trade.isCompleted}
              targetPrice={trade.targetPrice}
              stopLossPrice={trade.stopLossPrice}
            />
            {trade.symbolCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://ssl.pstatic.net/imgfinance/chart/item/candle/day/${trade.symbolCode}.png`}
                alt={`${trade.symbol} 캔들 차트`}
                className="w-full border-t"
              />
            )}
            <table className="w-full text-xs border-t">
              <thead>
                <tr className="text-[10px] text-gray-400 border-b bg-gray-50">
                  <th className="px-2 py-1 text-center font-normal">구분</th>
                  <th className="px-2 py-1 text-left font-normal">날짜</th>
                  <th className="px-2 py-1 text-right font-normal">단가</th>
                  <th className="px-2 py-1 text-right font-normal">수량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 text-center">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${e.type === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-gray-500">{e.date.slice(5, 10)}</td>
                    <td className="px-2 py-1 text-right">{formatKRW(e.price)}</td>
                    <td className="px-2 py-1 text-right">{e.quantity}주</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t">
              <TradeImageZone
                tradeId={trade.id}
                images={imagesMap[trade.id] ?? trade.images}
                onUpdate={imgs => setImagesMap(m => ({ ...m, [trade.id]: imgs }))}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  const totalCount = rows.length
  const winCount = rows.filter(r => r.isWin).length

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-[160px_1fr] gap-4 items-start">
      {/* 좌측 필터 */}
      <div className="sticky top-16 space-y-3">
        <select
          value={winFilter}
          onChange={e => setWinFilter(e.target.value as WinFilter)}
          className="w-full bg-white border rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="all">전체</option>
          <option value="win">익절</option>
          <option value="loss">손절</option>
        </select>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {MARKET_TYPES.map(type => (
            <label key={type} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={marketFilters.includes(type)}
                onChange={() => toggleMarket(type)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{type}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {RATE_TIERS.map(tier => (
            <label key={tier.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={tierFilters.includes(tier.id)}
                onChange={() => toggleTier(tier.id)}
                className="accent-blue-600"
              />
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.dot}`} />
              <span className="text-sm text-gray-700">{tier.label}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {AMOUNT_TIERS.map(tier => (
            <label key={tier.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={amountFilters.includes(tier.id)}
                onChange={() => toggleAmount(tier.id)}
                className="accent-blue-600"
              />
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.dot}`} />
              <span className="text-sm text-gray-700">{tier.label}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {PLAN_OPTIONS.map(plan => (
            <label key={plan} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={planFilters.includes(plan)}
                onChange={() => togglePlan(plan)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{plan}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {HOLDING_DAYS_TIERS.map(tier => (
            <label key={tier.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={holdingFilters.includes(tier.id)}
                onChange={() => toggleHolding(tier.id)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">{tier.label}</span>
            </label>
          ))}
        </div>

        <div className="bg-white rounded-lg border p-2 space-y-1">
          {OUTCOMES.map(o => (
            <label key={o.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={outcomeFilters.includes(o.id)}
                onChange={() => toggleOutcome(o.id)}
                className="accent-blue-600"
              />
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${AFTER_SELL_STYLE[o.id.endsWith('up') ? 'up' : 'down'].dot}`} />
              <span className="text-sm text-gray-700">{o.label}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-400 px-1 leading-relaxed">
          {totalCount}건<br />익절 {winCount} / 손절 {totalCount - winCount}
        </p>
      </div>

      {/* 우측 주/월별 히스토리 */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex border rounded overflow-hidden text-sm">
            <button
              onClick={() => changeGroupMode('week')}
              className={`px-3 py-1.5 ${groupMode === 'week' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >주별</button>
            <button
              onClick={() => changeGroupMode('month')}
              className={`px-3 py-1.5 ${groupMode === 'month' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >월별</button>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none mr-auto ml-3">
            <input
              type="checkbox"
              checked={groupBySymbol}
              onChange={e => setGroupBySymbol(e.target.checked)}
              className="accent-blue-600"
            />
            종목 묶기
          </label>
          <div className="flex items-center gap-2 mr-3 text-xs text-gray-500">
            {Object.values(AFTER_SELL_STYLE).map(s => (
              <span key={s.label} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${s.dot}`} />
                {s.label}
              </span>
            ))}
            <button
              onClick={() => loadPrices(visibleCodes)}
              disabled={pricesLoading || visibleCodes.length === 0}
              className="text-gray-500 hover:text-gray-800 border rounded px-2 py-1 disabled:opacity-50"
            >
              {pricesLoading ? '조회중...' : '현재가 새로고침'}
            </button>
            {priceStatus && !pricesLoading && (
              <span className={priceStatus.ok < priceStatus.total ? 'text-red-500' : 'text-gray-400'} title={priceStatus.error ?? undefined}>
                현재가 {priceStatus.ok}/{priceStatus.total}종목
                {priceStatus.error && ` · ${priceStatus.error}`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setOffset(o => o + 1)} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-sm border rounded">
              {groupMode === 'week' ? '‹ 이전주' : '‹ 이전달'}
            </button>
            <button
              onClick={() => setOffset(o => Math.max(0, o - 1))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-sm border rounded disabled:opacity-30"
            >
              {groupMode === 'week' ? '다음주 ›' : '다음달 ›'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {columns.map((w, i) => (
            <div key={i} className="space-y-2 min-w-0">
              <div className="bg-gray-50 border rounded px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">{w.label}</span>
                {w.items.length > 0 && (
                  <span className={`text-xs font-semibold ${w.total >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {w.total >= 0 ? '+' : ''}{formatKRW(Math.round(w.total))}
                  </span>
                )}
              </div>

              {w.items.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-6">거래 없음</p>
              ) : (
                (groupBySymbol ? groupItems(w.items) : w.items.map(r => ({ symbol: r.trade.symbol, items: [r] }))).map(g => {
                  if (g.items.length === 1) return renderCard(g.items[0])
                  const key = `${w.label}|${g.symbol}`
                  const isOpen = openGroups.has(key)
                  const profit = g.items.reduce((s, r) => s + r.trade.profitAmount, 0)
                  const cost = g.items.reduce((s, r) => s + r.trade.avgBuyPrice * r.trade.totalSellQuantity, 0)
                  const rate = cost > 0 ? (profit / cost) * 100 : 0
                  const color = rateTier(rate)
                  const marketType = symbolTypeMap[g.symbol]
                  const sellQty = g.items.reduce((s, r) => s + r.trade.totalSellQuantity, 0)
                  const groupSellPrice = sellQty > 0 ? g.items.reduce((s, r) => s + r.trade.totalSellAmount, 0) / sellQty : 0
                  const groupCode = g.items.find(r => r.trade.symbolCode)?.trade.symbolCode
                  const after = afterSell(groupCode ? priceMap[groupCode] : undefined, groupSellPrice)
                  const outcome = outcomeOf(profit >= 0, after)
                  return (
                    <div key={key} className={`${after?.style.bg ?? 'bg-white'} rounded-lg border overflow-hidden ${color.width} ${color.border}`}>
                      <button onClick={() => toggleGroup(key)} className="w-full p-3 flex justify-between items-start gap-1 text-left hover:bg-black/[0.03]">
                        <div className="min-w-0">
                          <div>
                            {marketType && (
                              <span className={`text-[10px] px-1 py-0.5 rounded border font-medium mr-1 ${TYPE_STYLE[marketType] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {marketType}
                              </span>
                            )}
                            <span className="font-semibold text-sm">{g.symbol}</span>
                            <span className="text-[11px] text-gray-500 ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded-full">{g.items.length}건</span>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            익절 {g.items.filter(r => r.isWin).length} / 손절 {g.items.filter(r => !r.isWin).length}{' · '}
                            <span className={`font-medium ${color.text}`}>{formatRate(rate)}</span>
                            {' · '}{isOpen ? '▲ 접기' : '▼ 펼치기'}
                          </p>
                          {after && (
                            <p className="text-[11px] text-gray-400">
                              평균 매도 {formatKRW(Math.round(groupSellPrice))} → 현재 {formatKRW(after.currentPrice)}{' '}
                              <span className={`font-medium ${after.style.text}`}>{formatRate(after.diffRate)}</span>
                              {outcome && <OutcomeBadge outcome={outcome} after={after} />}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold whitespace-nowrap ${color.text}`}>
                          {profit >= 0 ? '+' : ''}{formatKRW(Math.round(profit))}
                        </span>
                      </button>
                      {isOpen && (() => {
                        const buyEntries = g.items.flatMap(r => r.trade.buyEntries)
                        const sellEntries = g.items.flatMap(r => r.trade.sellEntries)
                        const buyQty = buyEntries.reduce((s, e) => s + e.quantity, 0)
                        const avgBuy = buyQty > 0 ? buyEntries.reduce((s, e) => s + e.price * e.quantity, 0) / buyQty : 0
                        const code = g.items.find(r => r.trade.symbolCode)?.trade.symbolCode
                        const allEntries = [
                          ...buyEntries.map(e => ({ ...e, type: '매수' as const })),
                          ...sellEntries.map(e => ({ ...e, type: '매도' as const })),
                        ].sort((a, b) => a.date.localeCompare(b.date))
                        return (
                          <div className="border-t">
                            {/* 묶인 거래 전체를 한 차트·표로 */}
                            <TradeChart buyEntries={buyEntries} sellEntries={sellEntries} avgBuyPrice={avgBuy} isCompleted />
                            {code && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`https://ssl.pstatic.net/imgfinance/chart/item/candle/day/${code}.png`}
                                alt={`${g.symbol} 캔들 차트`}
                                className="w-full border-t"
                              />
                            )}
                            <table className="w-full text-xs border-t">
                              <thead>
                                <tr className="text-[10px] text-gray-400 border-b bg-gray-50">
                                  <th className="px-2 py-1 text-center font-normal">구분</th>
                                  <th className="px-2 py-1 text-left font-normal">날짜</th>
                                  <th className="px-2 py-1 text-right font-normal">단가</th>
                                  <th className="px-2 py-1 text-right font-normal">수량</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {allEntries.map((e, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-1 text-center">
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${e.type === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                                        {e.type}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-gray-500">{e.date.slice(5, 10)}{e.date.slice(11, 16) !== '00:00' && ` ${e.date.slice(11, 16)}`}</td>
                                    <td className="px-2 py-1 text-right">{formatKRW(e.price)}</td>
                                    <td className="px-2 py-1 text-right">{e.quantity}주</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="border-t bg-gray-50 p-2 space-y-2">
                              <p className="text-[11px] text-gray-400 px-1">개별 거래</p>
                              {g.items.map(renderCard)}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
