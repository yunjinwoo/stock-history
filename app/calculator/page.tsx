'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import StockNav from '@/components/StockNav'
import type { Trade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatRate, uuid } from '@/lib/utils'
import {
  averageDown, qtyForTargetAvg, positionSize,
  stopLossByPrice, stopLossByRate, stopLossByAmount, type StopLossResult,
} from '@/lib/calculator'

type Tab = 'avg' | 'stop'
type StopMode = 'rate' | 'price' | 'amount'

interface BuyRow { key: string; price: string; qty: string }

const num = (s: string) => Number(s.replace(/,/g, '')) || 0
const won = (n: number) => formatKRW(Math.round(n))
const signedWon = (n: number) => (n >= 0 ? '+' : '') + won(n)
const tone = (n: number | null) => n == null ? 'text-gray-700' : n >= 0 ? 'text-red-500' : 'text-blue-500'

function NumInput({ label, value, onChange, placeholder, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string
}) {
  return (
    <label className="space-y-0.5 block">
      <span className="text-xs text-gray-500 block">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="border rounded px-2 py-1.5 w-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {suffix && <span className="text-xs text-gray-400 shrink-0">{suffix}</span>}
      </div>
    </label>
  )
}

function Stat({ label, value, cls = 'text-gray-800', sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded px-3 py-2">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${cls}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

export default function CalculatorPage() {
  const [tab, setTab] = useState<Tab>('avg')
  const [trades, setTrades] = useState<Trade[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [priceLoading, setPriceLoading] = useState(false)

  // 공통: 현재 보유분
  const [avgPrice, setAvgPrice] = useState('')
  const [qty, setQty] = useState('')
  const [curPrice, setCurPrice] = useState('')

  // 물타기
  const [buyRows, setBuyRows] = useState<BuyRow[]>([{ key: uuid(), price: '', qty: '' }])
  const [targetBuyPrice, setTargetBuyPrice] = useState('')
  const [targetAvg, setTargetAvg] = useState('')

  // 손절
  const [stopMode, setStopMode] = useState<StopMode>('rate')
  const [stopRate, setStopRate] = useState('5')
  const [stopPrice, setStopPrice] = useState('')
  const [stopAmount, setStopAmount] = useState('')
  const [sizeEntry, setSizeEntry] = useState('')
  const [sizeStop, setSizeStop] = useState('')
  const [sizeLoss, setSizeLoss] = useState('')

  useEffect(() => {
    apiFetch('/api/trades')
      .then(r => r.json())
      .then((d: unknown) => Array.isArray(d) && setTrades(d as Trade[]))
  }, [])

  const holdings = useMemo(
    () => trades.filter(t => !t.isCompleted && t.remainingQuantity > 0).sort((a, b) => a.symbol.localeCompare(b.symbol, 'ko')),
    [trades],
  )

  async function selectTrade(id: string) {
    setSelectedId(id)
    const t = holdings.find(h => h.id === id)
    if (!t) return
    const avg = String(Math.round(t.avgBuyPrice))
    setAvgPrice(avg)
    setQty(String(t.remainingQuantity))
    setCurPrice('')
    setBuyRows([{ key: uuid(), price: '', qty: '' }])
    if (t.stopLossPrice) { setStopMode('price'); setStopPrice(String(t.stopLossPrice)) }
    setSizeEntry(avg)
    if (!t.symbolCode) return
    setPriceLoading(true)
    try {
      const res = await apiFetch(`/api/stock-price?codes=${t.symbolCode}`)
      const json = await res.json()
      const item = Array.isArray(json?.data) ? json.data.find((d: { code: string }) => d.code === t.symbolCode) : null
      if (item?.price) setCurPrice(String(Number(item.price)))
    } catch {
      // 현재가 조회 실패 시 직접 입력
    } finally {
      setPriceLoading(false)
    }
  }

  const holding = { price: num(avgPrice), qty: num(qty) }
  const cur = num(curPrice) || null
  const nowRate = cur && holding.price > 0 ? (cur / holding.price - 1) * 100 : null
  const nowProfit = cur && holding.price > 0 ? (cur - holding.price) * holding.qty : null

  const avgResult = averageDown(holding, buyRows.map(r => ({ price: num(r.price), qty: num(r.qty) })), cur)
  const targetResult = qtyForTargetAvg(holding, num(targetBuyPrice), num(targetAvg))

  const stopResult: StopLossResult | null =
    stopMode === 'rate' ? stopLossByRate(holding, num(stopRate))
      : stopMode === 'price' ? stopLossByPrice(holding, num(stopPrice))
        : stopLossByAmount(holding, num(stopAmount))
  const sizeResult = positionSize(num(sizeEntry), num(sizeStop), num(sizeLoss))

  function updateRow(key: string, field: 'price' | 'qty', value: string) {
    setBuyRows(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r))
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-0">
      <header className="bg-white border-b px-4 py-3 flex flex-wrap gap-y-2 items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 뒤로</Link>
        <h1 className="text-lg font-bold">손절·물타기 계산기</h1>
        <StockNav />
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* 보유 현황 */}
        <section className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">보유 현황</h2>
            <select
              value={selectedId}
              onChange={e => selectTrade(e.target.value)}
              className="ml-auto border rounded px-2 py-1 text-xs max-w-[60%]"
            >
              <option value="">보유 종목 불러오기 (직접 입력)</option>
              {holdings.map(t => (
                <option key={t.id} value={t.id}>{t.symbol} · {t.remainingQuantity}주</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumInput label="평단가" value={avgPrice} onChange={setAvgPrice} suffix="원" />
            <NumInput label="보유수량" value={qty} onChange={setQty} suffix="주" />
            <NumInput label={priceLoading ? '현재가 (조회중…)' : '현재가'} value={curPrice} onChange={setCurPrice} suffix="원" />
          </div>
          {holding.price > 0 && holding.qty > 0 && (
            <p className="text-xs text-gray-500">
              매입금액 {won(holding.price * holding.qty)}
              {nowRate != null && nowProfit != null && (
                <> · 현재 <span className={tone(nowProfit)}>{signedWon(nowProfit)} ({formatRate(nowRate)})</span></>
              )}
            </p>
          )}
        </section>

        <div className="flex border rounded overflow-hidden bg-white w-fit">
          <button onClick={() => setTab('avg')} className={`text-sm px-4 py-1.5 ${tab === 'avg' ? 'bg-gray-100 font-medium' : 'text-gray-400'}`}>물타기</button>
          <button onClick={() => setTab('stop')} className={`text-sm px-4 py-1.5 ${tab === 'stop' ? 'bg-gray-100 font-medium' : 'text-gray-400'}`}>손절</button>
        </div>

        {tab === 'avg' && (
          <>
            <section className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="text-sm font-semibold">추가 매수</h2>
              {buyRows.map((r, i) => (
                <div key={r.key} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
                  <span className="text-xs text-gray-400 pb-2">{i + 1}회</span>
                  <NumInput label="매수가" value={r.price} onChange={v => updateRow(r.key, 'price', v)} placeholder={curPrice} />
                  <NumInput label="수량" value={r.qty} onChange={v => updateRow(r.key, 'qty', v)} />
                  <button
                    type="button"
                    onClick={() => setBuyRows(rows => rows.length > 1 ? rows.filter(x => x.key !== r.key) : rows)}
                    className="text-red-400 hover:text-red-600 pb-1.5 text-lg leading-none"
                  >×</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setBuyRows(rows => [...rows, { key: uuid(), price: curPrice, qty: '' }])}
                className="text-xs text-blue-500 hover:underline"
              >+ 회차 추가</button>

              {avgResult && avgResult.addedQty > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <Stat label="새 평단" value={won(avgResult.avgPrice)} sub={`기존 대비 ${formatRate(avgResult.avgDropRate)}`} />
                  <Stat label="총 수량" value={`${avgResult.totalQty.toLocaleString('ko-KR')}주`} sub={`+${avgResult.addedQty.toLocaleString('ko-KR')}주`} />
                  <Stat label="추가 투입금" value={won(avgResult.addedCost)} sub={`총 ${won(avgResult.totalCost)}`} />
                  {avgResult.profitRateAt != null && avgResult.profitAt != null && (
                    <Stat
                      label="현재가 기준 손익"
                      value={formatRate(avgResult.profitRateAt)}
                      cls={tone(avgResult.profitAt)}
                      sub={signedWon(avgResult.profitAt)}
                    />
                  )}
                  {avgResult.breakevenRiseRate != null && avgResult.breakevenRiseRate > 0 && (
                    <Stat
                      label="본전까지 필요 상승"
                      value={formatRate(avgResult.breakevenRiseRate)}
                      sub={nowRate != null && nowRate < 0 ? `물타기 전 ${formatRate(holding.price / cur! * 100 - 100)}` : undefined}
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-300">보유 현황과 추가 매수가·수량을 넣으면 새 평단이 계산됩니다</p>
              )}
            </section>

            <section className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="text-sm font-semibold">목표 평단 역산</h2>
              <p className="text-xs text-gray-400">이 가격에 사서 평단을 얼마까지 낮추려면 몇 주가 필요한지</p>
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="매수가" value={targetBuyPrice} onChange={setTargetBuyPrice} placeholder={curPrice} suffix="원" />
                <NumInput label="목표 평단" value={targetAvg} onChange={setTargetAvg} suffix="원" />
              </div>
              {targetResult ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Stat label="필요 수량" value={`${targetResult.qty.toLocaleString('ko-KR')}주`} />
                  <Stat label="필요 금액" value={won(targetResult.cost)} />
                  <Stat label="결과 평단" value={won(targetResult.avgPrice)} />
                </div>
              ) : num(targetBuyPrice) > 0 && num(targetAvg) > 0 && holding.price > 0 ? (
                <p className="text-xs text-orange-500">목표 평단은 매수가보다 높고 현재 평단보다 낮아야 합니다</p>
              ) : null}
            </section>
          </>
        )}

        {tab === 'stop' && (
          <>
            <section className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="text-sm font-semibold">손절 시 손실</h2>
              <div className="flex border rounded overflow-hidden w-fit text-xs">
                {([['rate', '비율'], ['price', '가격'], ['amount', '손실금액']] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setStopMode(m)} className={`px-3 py-1 ${stopMode === m ? 'bg-gray-100 font-medium' : 'text-gray-400'}`}>{label}</button>
                ))}
              </div>
              {stopMode === 'rate' && <NumInput label="평단 대비 손절 비율" value={stopRate} onChange={setStopRate} suffix="%" />}
              {stopMode === 'price' && <NumInput label="손절가" value={stopPrice} onChange={setStopPrice} placeholder={curPrice} suffix="원" />}
              {stopMode === 'amount' && <NumInput label="감당할 최대 손실금액" value={stopAmount} onChange={setStopAmount} suffix="원" />}

              {stopResult ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label="손절가" value={won(stopResult.stopPrice)} />
                  <Stat label="손실률" value={formatRate(stopResult.lossRate)} cls={tone(stopResult.lossRate)} />
                  <Stat label="손실금액" value={signedWon(stopResult.lossAmount)} cls={tone(stopResult.lossAmount)} />
                  <Stat label="원금 회복 필요 상승" value={formatRate(stopResult.recoveryRate)} />
                  {cur != null && (
                    <p className="col-span-full text-xs text-gray-500">
                      현재가 {won(cur)}에서 손절가까지{' '}
                      <span className={tone(stopResult.stopPrice - cur)}>{formatRate((stopResult.stopPrice / cur - 1) * 100)}</span>
                      {stopResult.stopPrice >= cur && ' — 이미 손절가 아래입니다'}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-300">보유 현황과 손절 기준을 넣으면 손실이 계산됩니다</p>
              )}
            </section>

            <section className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="text-sm font-semibold">매수 수량 정하기</h2>
              <p className="text-xs text-gray-400">손절가에 걸려도 손실이 이 금액을 넘지 않으려면 몇 주까지 살 수 있는지</p>
              <div className="grid grid-cols-3 gap-2">
                <NumInput label="진입가" value={sizeEntry} onChange={setSizeEntry} placeholder={curPrice} suffix="원" />
                <NumInput label="손절가" value={sizeStop} onChange={setSizeStop} suffix="원" />
                <NumInput label="허용 손실" value={sizeLoss} onChange={setSizeLoss} suffix="원" />
              </div>
              {sizeResult ? (
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="최대 수량" value={`${sizeResult.qty.toLocaleString('ko-KR')}주`} />
                  <Stat label="필요 금액" value={won(sizeResult.cost)} />
                  <Stat label="손절 시 손실" value={signedWon(-sizeResult.loss)} cls="text-blue-500" />
                </div>
              ) : num(sizeEntry) > 0 && num(sizeStop) >= num(sizeEntry) ? (
                <p className="text-xs text-orange-500">손절가는 진입가보다 낮아야 합니다</p>
              ) : null}
            </section>
          </>
        )}

        <p className="text-[11px] text-gray-400">수수료·세금은 빠진 계산입니다.</p>
      </div>
    </div>
  )
}
