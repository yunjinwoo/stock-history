'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import StockNav from '@/components/StockNav'
import type { Trade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatRate, uuid } from '@/lib/utils'
import {
  simulateTrades, qtyForTargetAvg, type Side, positionSize,
  stopLossByPrice, stopLossByRate, stopLossByAmount, type StopLossResult,
} from '@/lib/calculator'

type Tab = 'avg' | 'stop'
type StopMode = 'rate' | 'price' | 'amount'

interface StepRow { key: string; side: Side; price: string; qty: string; repeat: string }

const newStep = (side: Side, price = ''): StepRow => ({ key: uuid(), side, price, qty: '', repeat: '1' })

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

  // 물타기 (매수·매도)
  const [stepRows, setStepRows] = useState<StepRow[]>([newStep('buy')])
  const [cycles, setCycles] = useState('1')
  const [showSteps, setShowSteps] = useState(false)
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
    setStepRows([newStep('buy')])
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

  const sim = simulateTrades(
    holding,
    stepRows.map(r => ({ side: r.side, price: num(r.price), qty: num(r.qty), repeat: num(r.repeat) || 1 })),
    num(cycles) || 1,
    cur,
  )
  const simHasTrades = sim != null && sim.rows.length > 0
  const targetResult = qtyForTargetAvg(holding, num(targetBuyPrice), num(targetAvg))

  const stopResult: StopLossResult | null =
    stopMode === 'rate' ? stopLossByRate(holding, num(stopRate))
      : stopMode === 'price' ? stopLossByPrice(holding, num(stopPrice))
        : stopLossByAmount(holding, num(stopAmount))
  const sizeResult = positionSize(num(sizeEntry), num(sizeStop), num(sizeLoss))

  function updateRow(key: string, patch: Partial<StepRow>) {
    setStepRows(rows => rows.map(r => r.key === key ? { ...r, ...patch } : r))
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
          <button onClick={() => setTab('avg')} className={`text-sm px-4 py-1.5 ${tab === 'avg' ? 'bg-gray-100 font-medium' : 'text-gray-400'}`}>물타기·매도</button>
          <button onClick={() => setTab('stop')} className={`text-sm px-4 py-1.5 ${tab === 'stop' ? 'bg-gray-100 font-medium' : 'text-gray-400'}`}>손절</button>
        </div>

        {tab === 'avg' && (
          <>
            <section className="bg-white rounded-lg border p-4 space-y-3">
              <h2 className="text-sm font-semibold">추가 거래</h2>
              <p className="text-xs text-gray-400">위에서부터 순서대로 체결된다고 보고 계산해요. 같은 가격으로 여러 번 거래했다면 반복 횟수를 넣으세요.</p>
              {stepRows.map((r, i) => (
                <div key={r.key} className="grid grid-cols-[auto_auto_1.3fr_1fr_2.75rem_auto] gap-1.5 items-end">
                  <span className="text-xs text-gray-400 pb-2">{i + 1}회</span>
                  <div className="flex border rounded overflow-hidden text-xs mb-px">
                    <button type="button" onClick={() => updateRow(r.key, { side: 'buy' })} className={`px-2 py-1.5 ${r.side === 'buy' ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-400'}`}>매수</button>
                    <button type="button" onClick={() => updateRow(r.key, { side: 'sell' })} className={`px-2 py-1.5 ${r.side === 'sell' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-400'}`}>매도</button>
                  </div>
                  <NumInput label={r.side === 'buy' ? '매수가' : '매도가'} value={r.price} onChange={v => updateRow(r.key, { price: v })} placeholder={curPrice} />
                  <NumInput label="수량" value={r.qty} onChange={v => updateRow(r.key, { qty: v })} />
                  <NumInput label="반복" value={r.repeat} onChange={v => updateRow(r.key, { repeat: v })} />
                  <button
                    type="button"
                    onClick={() => setStepRows(rows => rows.length > 1 ? rows.filter(x => x.key !== r.key) : rows)}
                    className="text-red-400 hover:text-red-600 pb-1.5 text-lg leading-none"
                  >×</button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button type="button" onClick={() => setStepRows(rows => [...rows, newStep('buy', curPrice)])} className="text-red-500 hover:underline">+ 매수 추가</button>
                <button type="button" onClick={() => setStepRows(rows => [...rows, newStep('sell', curPrice)])} className="text-blue-500 hover:underline">+ 매도 추가</button>
                <label className="ml-auto flex items-center gap-1 text-gray-500">
                  위 거래 전체를
                  <input
                    type="number"
                    min={1}
                    value={cycles}
                    onChange={e => setCycles(e.target.value)}
                    className="border rounded px-1.5 py-1 w-14 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  번 반복
                </label>
              </div>

              {sim && simHasTrades ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    <Stat
                      label="최종 평단"
                      value={sim.qty > 0 ? won(sim.avgPrice) : '-'}
                      sub={sim.avgChangeRate != null ? `기존 대비 ${formatRate(sim.avgChangeRate)}` : undefined}
                    />
                    <Stat label="남은 수량" value={`${sim.qty.toLocaleString('ko-KR')}주`} sub={`매수 +${sim.boughtQty.toLocaleString('ko-KR')} · 매도 -${sim.soldQty.toLocaleString('ko-KR')}`} />
                    <Stat label="추가 매수금 / 매도금" value={won(sim.boughtCost)} sub={`매도 ${won(sim.soldAmount)}`} />
                    <Stat label="실현손익" value={signedWon(sim.realized)} cls={tone(sim.realized)} />
                    {sim.evalProfitAt != null && sim.qty > 0 && (
                      <Stat
                        label="현재가 기준 평가손익"
                        value={signedWon(sim.evalProfitAt)}
                        cls={tone(sim.evalProfitAt)}
                        sub={sim.profitRateAt != null ? formatRate(sim.profitRateAt) : undefined}
                      />
                    )}
                    {sim.totalProfitAt != null && (
                      <Stat label="총손익 (실현+평가)" value={signedWon(sim.totalProfitAt)} cls={tone(sim.totalProfitAt)} />
                    )}
                    {sim.breakevenPrice != null && (
                      <Stat
                        label="실현손익 포함 본전가"
                        value={sim.breakevenPrice > 0 ? won(sim.breakevenPrice) : '이미 본전 이상'}
                        sub={sim.breakevenPrice > 0 && sim.breakevenRiseRate != null ? `현재가에서 ${formatRate(sim.breakevenRiseRate)}` : undefined}
                      />
                    )}
                  </div>
                  {sim.rows.some(r => r.clipped) && (
                    <p className="text-xs text-orange-500">보유수량보다 많이 판 회차가 있어 남은 수량만큼만 매도한 것으로 계산했어요</p>
                  )}
                  <button type="button" onClick={() => setShowSteps(v => !v)} className="text-xs text-gray-500 hover:text-gray-800">
                    {showSteps ? '▲ 거래별 변화 접기' : `▼ 거래별 변화 보기 (${sim.rows.length}${sim.truncated ? '+' : ''}건)`}
                  </button>
                  {showSteps && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-right whitespace-nowrap">
                        <thead className="text-gray-400">
                          <tr>
                            <th className="text-left font-normal py-1">회차</th>
                            <th className="font-normal">거래</th>
                            <th className="font-normal">평단</th>
                            <th className="font-normal">보유</th>
                            <th className="font-normal">실현</th>
                            <th className="font-normal">누적 실현</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sim.rows.map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="text-left py-1 text-gray-400">{num(cycles) > 1 ? `${r.cycle}-` : ''}{r.step}회</td>
                              <td className={r.side === 'buy' ? 'text-red-500' : 'text-blue-500'}>
                                {r.side === 'buy' ? '매수' : '매도'} {won(r.price)} × {r.qty}{r.clipped ? '*' : ''}
                              </td>
                              <td>{r.holdQty > 0 ? won(r.avgPrice) : '-'}</td>
                              <td>{r.holdQty.toLocaleString('ko-KR')}주</td>
                              <td className={r.side === 'sell' ? tone(r.realized) : 'text-gray-300'}>{r.side === 'sell' ? signedWon(r.realized) : '-'}</td>
                              <td className={tone(r.realizedTotal)}>{signedWon(r.realizedTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {sim.truncated && <p className="text-[11px] text-gray-400 pt-1">처음 300건만 표시 (결과 계산은 전체 기준)</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-300">매수·매도 가격과 수량을 넣으면 평단과 손익이 계산됩니다</p>
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
