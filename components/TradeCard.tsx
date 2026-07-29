'use client'

import { useState, useEffect } from 'react'
import type { Trade, Account, TradeImage } from '@/lib/types'
import { formatKRW, formatRate, planStatus, uuid } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

const PLAN_TONE_STYLE: Record<'neutral' | 'good' | 'bad', string> = {
  neutral: 'border-gray-200 text-gray-500 bg-white',
  good: 'border-green-200 text-green-600 bg-green-50',
  bad: 'border-orange-200 text-orange-600 bg-orange-50',
}
import TradeImageZone from '@/components/TradeImageZone'

const TYPE_STYLE: Record<string, string> = {
  '코스피': 'bg-blue-50 text-blue-600 border-blue-200',
  '코스닥': 'bg-green-50 text-green-600 border-green-200',
  'ETF':   'bg-purple-50 text-purple-600 border-purple-200',
}

interface Props {
  trade: Trade
  account?: Account
  marketType?: string
  priceMap?: Record<string, number>
  onEdit: () => void
  onDelete: () => void
}

interface ScenarioRow {
  key: string
  buyPrice: string
  sellPrice: string
  rateInput: string
}

const DEFAULT_RATE_PCT = '5'

function newScenarioRow(buyPrice: string): ScenarioRow {
  const buy = Number(buyPrice)
  const sellPrice = buy > 0 ? String(Math.round(buy * (1 + Number(DEFAULT_RATE_PCT) / 100))) : ''
  return { key: uuid(), buyPrice, sellPrice, rateInput: DEFAULT_RATE_PCT }
}

function calcScenarioRow(row: ScenarioRow, budget: number) {
  const buy = Number(row.buyPrice)
  const sell = Number(row.sellPrice)
  if (!buy || buy <= 0) return null
  const qty = budget > 0 ? Math.floor(budget / buy) : 0
  const invest = qty * buy
  const proceeds = sell > 0 ? qty * sell : null
  const profit = proceeds != null ? proceeds - invest : null
  const rate = buy > 0 && sell > 0 ? (sell / buy - 1) * 100 : null
  return { qty, invest, proceeds, profit, rate }
}

interface SavedScenario {
  currentPrice: string | null
  budget: string | null
  targetProfit: string | null
  rowsJson: string
}

export default function TradeCard({ trade, account, marketType, priceMap = {}, onEdit, onDelete }: Props) {
  const [showEntries, setShowEntries] = useState(false)
  const [showFullComment, setShowFullComment] = useState(false)
  const [images, setImages] = useState<TradeImage[]>(trade.images)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const [scenarioLoaded, setScenarioLoaded] = useState(false)
  const defaultCurrentPrice = trade.avgBuyPrice > 0 ? String(Math.round(trade.avgBuyPrice)) : ''
  const investedAmount = trade.avgBuyPrice * trade.remainingQuantity
  const defaultTargetProfit = investedAmount > 0 ? String(Math.round(investedAmount * 0.5)) : ''
  const [scenarioCurrentPrice, setScenarioCurrentPrice] = useState(defaultCurrentPrice)
  const [scenarioBudget, setScenarioBudget] = useState('500000')
  const [scenarioRows, setScenarioRows] = useState<ScenarioRow[]>([])
  const [scenarioTargetProfit, setScenarioTargetProfit] = useState(defaultTargetProfit)
  const [scenarioSaved, setScenarioSaved] = useState(false)

  useEffect(() => {
    if (!scenarioOpen || scenarioLoaded) return
    setScenarioLoaded(true)
    apiFetch(`/api/trade-scenarios/${trade.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: SavedScenario | null) => {
        if (!data) return
        if (data.currentPrice) setScenarioCurrentPrice(data.currentPrice)
        if (data.budget) setScenarioBudget(data.budget)
        if (data.targetProfit) setScenarioTargetProfit(data.targetProfit)
        try {
          const rows = JSON.parse(data.rowsJson)
          if (Array.isArray(rows)) setScenarioRows(rows)
        } catch { /* 저장된 데이터 손상 시 무시 */ }
      })
  }, [scenarioOpen, scenarioLoaded, trade.id])

  function addScenarioRow() {
    setScenarioRows(rows => [...rows, newScenarioRow(scenarioCurrentPrice)])
  }
  function scrollToScenarioRow(key: string) {
    document.getElementById(`scenario-row-${trade.id}-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  function removeScenarioRow(key: string) {
    setScenarioRows(rows => rows.filter(r => r.key !== key))
  }
  function updateScenarioRow(key: string, field: 'buyPrice' | 'sellPrice' | 'rateInput', value: string) {
    setScenarioRows(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r))
  }
  function applyRateToRow(key: string) {
    setScenarioRows(rows => rows.map(r => {
      if (r.key !== key) return r
      const buy = Number(r.buyPrice)
      const rate = Number(r.rateInput)
      if (!buy || !rate) return r
      return { ...r, sellPrice: String(Math.round(buy * (1 + rate / 100))) }
    }))
  }
  function loadCurrentPriceFromApi() {
    const p = trade.symbolCode ? priceMap[trade.symbolCode] : undefined
    if (p != null) setScenarioCurrentPrice(String(p))
  }
  // 목표 전체수익에 도달할 때까지 현재가·여유자금·기본 수익률 기준으로 행을 자동 추가
  function autoFillToTarget() {
    const target = Number(scenarioTargetProfit)
    const buy = Number(scenarioCurrentPrice)
    const budget = Number(scenarioBudget) || 0
    if (!target || !buy || buy <= 0) return

    const qty = Math.floor(budget / buy)
    if (qty <= 0) return
    const sellPrice = Math.round(buy * (1 + Number(DEFAULT_RATE_PCT) / 100))
    const perRowProfit = qty * (sellPrice - buy)
    if (perRowProfit <= 0) return

    const currentTotal = scenarioRows.reduce((sum, r) => sum + (calcScenarioRow(r, budget)?.profit ?? 0), 0)
    const remaining = target - currentTotal
    const neededRows = Math.max(0, Math.ceil(remaining / perRowProfit))
    if (neededRows <= 0) return
    setScenarioRows(rows => [...rows, ...Array.from({ length: neededRows }, () => newScenarioRow(scenarioCurrentPrice))])
  }
  async function saveScenario() {
    await apiFetch(`/api/trade-scenarios/${trade.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPrice: scenarioCurrentPrice, budget: scenarioBudget, targetProfit: scenarioTargetProfit, rows: scenarioRows,
      }),
    })
    setScenarioSaved(true)
    setTimeout(() => setScenarioSaved(false), 2000)
  }
  async function resetScenario() {
    setScenarioRows([])
    setScenarioTargetProfit(defaultTargetProfit)
    setScenarioCurrentPrice(defaultCurrentPrice)
    setScenarioBudget('500000')
    await apiFetch(`/api/trade-scenarios/${trade.id}`, { method: 'DELETE' })
  }

  const holdingColor =
    trade.holdingDays <= 7  ? 'bg-green-100 text-green-700' :
    trade.holdingDays <= 30 ? 'bg-blue-100 text-blue-700' :
    trade.holdingDays <= 90 ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'

  const statusBadge = !trade.isCompleted
    ? <span className={`text-xs px-2 py-0.5 rounded-full ${holdingColor}`}>보유중 {trade.holdingDays}일</span>
    : <span className={`text-xs px-2 py-0.5 rounded-full ${trade.profitAmount >= 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
        완료 {formatRate(trade.profitRate)} · <span className={holdingColor.split(' ')[1]}>{trade.holdingDays}일</span>
      </span>

  const comment = trade.comment
  const commentPreview = comment && comment.length > 30 ? comment.slice(0, 30) + '...' : comment

  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          {marketType && (
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium mr-1.5 ${TYPE_STYLE[marketType] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {marketType}
            </span>
          )}
          <span className="font-semibold">{trade.symbol}</span>
          {trade.symbolCode && <span className="text-gray-400 text-xs ml-1">({trade.symbolCode})</span>}
          {(() => {
            const plan = planStatus(trade)
            return plan && (
              <span className={`text-xs px-1.5 py-0.5 rounded border ml-1.5 ${PLAN_TONE_STYLE[plan.tone]}`}>
                📋 {plan.label}
              </span>
            )
          })()}
          {trade.isCompleted && trade.tradeScore != null && (
            <span className="text-xs px-1.5 py-0.5 rounded border ml-1.5 border-yellow-200 text-yellow-600 bg-yellow-50">
              ⭐ {trade.tradeScore}점
            </span>
          )}
          {account && (
            <p className="text-gray-400 text-xs mt-0.5">
              {account.broker} · {account.nickname || account.accountNumber}
            </p>
          )}
        </div>
        {statusBadge}
      </div>

      <div className="text-sm text-gray-600 space-y-0.5">
        {!trade.isCompleted ? (
          <>
            <p>평균단가 {formatKRW(Math.round(trade.avgBuyPrice))} × 잔여 {trade.remainingQuantity}주</p>
            <p>투자금 {formatKRW(Math.round(trade.avgBuyPrice * trade.remainingQuantity))}</p>
            {trade.totalSellQuantity > 0 && (
              <p className="text-gray-400">일부 매도: {trade.totalSellQuantity}주 완료</p>
            )}
          </>
        ) : (
          <>
            <p>평균단가 {formatKRW(Math.round(trade.avgBuyPrice))} → 매도 {formatKRW(Math.round(trade.totalSellAmount / trade.totalSellQuantity))}</p>
            <p className={`font-medium ${trade.profitAmount >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              손익 {(trade.profitAmount >= 0 ? '+' : '')}{formatKRW(Math.round(trade.profitAmount))} · 보유 {trade.holdingDays}일
            </p>
          </>
        )}
      </div>

      <button
        onClick={() => setShowEntries(v => !v)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        {showEntries ? '▲ 내역 접기' : `▼ 매수 ${trade.buyEntries.length}건${trade.sellEntries.length > 0 ? ` / 매도 ${trade.sellEntries.length}건` : ''}`}
      </button>

      {showEntries && (
        <div className="space-y-1 text-xs text-gray-500 bg-gray-50 rounded p-2">
          {trade.buyEntries.length > 0 && (
            <div>
              <p className="font-medium text-gray-600 mb-0.5">매수</p>
              {trade.buyEntries.map(e => (
                <p key={e.id}>{e.date.slice(0, 10)} · {formatKRW(e.price)} × {e.quantity}주 = {formatKRW(e.price * e.quantity)}</p>
              ))}
            </div>
          )}
          {trade.sellEntries.length > 0 && (
            <div className="mt-1">
              <p className="font-medium text-gray-600 mb-0.5">매도</p>
              {trade.sellEntries.map(e => (
                <p key={e.id}>{e.date.slice(0, 10)} · {formatKRW(e.price)} × {e.quantity}주 = {formatKRW(e.price * e.quantity)}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {comment && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
          {showFullComment ? (
            <>
              <span>{comment}</span>
              <button onClick={() => setShowFullComment(false)} className="ml-1 text-blue-400">접기</button>
            </>
          ) : (
            <>
              <span>💬 {commentPreview}</span>
              {comment.length > 30 && (
                <button onClick={() => setShowFullComment(true)} className="ml-1 text-blue-400">더보기</button>
              )}
            </>
          )}
        </div>
      )}

      {!trade.isCompleted && (
        <div className="border-t pt-2">
          <button
            onClick={() => setScenarioOpen(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {scenarioOpen ? '▲ 매매 시나리오 접기' : '▼ 매매 시나리오'}
          </button>
          {scenarioOpen && (() => {
            const budget = Number(scenarioBudget) || 0
            const rowResults = scenarioRows.map(row => ({ row, calc: calcScenarioRow(row, budget) }))
            const totalProfit = rowResults.reduce((sum, r) => sum + (r.calc?.profit ?? 0), 0)
            const anyProfit = rowResults.some(r => r.calc?.profit != null)
            return (
              <div className="mt-2 space-y-3 bg-gray-50 rounded p-2.5">
                {/* 영역1: 현재가 · 여유자금 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="space-y-0.5">
                    <span className="text-gray-400 block">현재가</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={scenarioCurrentPrice}
                        onChange={e => setScenarioCurrentPrice(e.target.value)}
                        placeholder="직접 입력"
                        className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      {trade.symbolCode && priceMap[trade.symbolCode] != null && (
                        <button
                          type="button"
                          onClick={loadCurrentPriceFromApi}
                          className="text-[10px] px-1.5 py-1 rounded border text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap"
                        >API</button>
                      )}
                    </div>
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-gray-400 block">여유자금</span>
                    <input
                      type="number"
                      value={scenarioBudget}
                      onChange={e => setScenarioBudget(e.target.value)}
                      className="border rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </label>
                </div>

                {/* 시나리오 조작 버튼 */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={addScenarioRow}
                    className="text-blue-500 hover:text-blue-700"
                  >+ 매매 시나리오 추가</button>
                  <span className="text-gray-300">|</span>
                  <label className="flex items-center gap-1">
                    <span className="text-gray-400">목표 전체수익</span>
                    <input
                      type="number"
                      value={scenarioTargetProfit}
                      onChange={e => setScenarioTargetProfit(e.target.value)}
                      placeholder="예: 1000000"
                      className="border rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={autoFillToTarget}
                    className="text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded bg-blue-50"
                  >목표까지 자동 추가</button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={resetScenario}
                    className="text-gray-500 hover:text-gray-700 px-2 py-1 border rounded"
                  >초기화</button>
                  <button
                    type="button"
                    onClick={saveScenario}
                    className="text-green-600 hover:text-green-800 px-2 py-1 border border-green-200 rounded bg-green-50"
                  >저장</button>
                  {scenarioSaved && <span className="text-green-500">저장됨</span>}
                </div>

                {/* 영역3: 전체 요약 (위로 이동) */}
                {anyProfit && (
                  <div className="text-xs bg-white rounded border p-2 space-y-0.5">
                    <p className="font-medium text-gray-700">
                      전체 요약{' '}
                      <span className="text-gray-400 font-normal">
                        (총 {rowResults.filter(r => r.calc?.profit != null).length}회차)
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 max-h-56 overflow-y-auto">
                      {rowResults.map(({ row, calc }, idx) => ({ row, calc, idx })).filter(r => r.calc?.profit != null).map(({ row, calc, idx }) => (
                        <p key={row.key} className="text-gray-500">
                          <button
                            type="button"
                            onClick={() => scrollToScenarioRow(row.key)}
                            className="text-blue-500 hover:underline font-medium"
                          >{idx + 1}회차</button>
                          {' '}{formatKRW(Number(row.buyPrice))} → {formatKRW(Number(row.sellPrice))}
                          {' : '}
                          <span className={calc!.profit! >= 0 ? 'text-red-500' : 'text-blue-500'}>
                            {(calc!.profit! >= 0 ? '+' : '') + formatKRW(Math.round(calc!.profit!))}
                          </span>
                        </p>
                      ))}
                    </div>
                    <p className="pt-1 border-t font-medium text-gray-700">
                      전체 수익{' '}
                      <span className={totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}>
                        {(totalProfit >= 0 ? '+' : '') + formatKRW(Math.round(totalProfit))}
                      </span>
                    </p>
                  </div>
                )}

                {/* 영역2: 매매 시나리오 행들 */}
                <div className="space-y-1.5">
                  {rowResults.map(({ row, calc }, idx) => (
                    <div key={row.key} id={`scenario-row-${trade.id}-${row.key}`} className="bg-white rounded border p-2 space-y-1 scroll-mt-16">
                      <p className="text-[11px] font-medium text-gray-500">{idx + 1}회차</p>
                      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5 items-end text-[11px]">
                        <label className="space-y-0.5">
                          <span className="text-gray-400 block">매수가</span>
                          <input
                            type="number"
                            value={row.buyPrice}
                            onChange={e => updateScenarioRow(row.key, 'buyPrice', e.target.value)}
                            className="border rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-gray-400 block">매도가</span>
                          <input
                            type="number"
                            value={row.sellPrice}
                            onChange={e => updateScenarioRow(row.key, 'sellPrice', e.target.value)}
                            className="border rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-gray-400 block">수익률%</span>
                          <input
                            type="number"
                            value={row.rateInput}
                            onChange={e => updateScenarioRow(row.key, 'rateInput', e.target.value)}
                            onBlur={() => applyRateToRow(row.key)}
                            onKeyDown={e => e.key === 'Enter' && applyRateToRow(row.key)}
                            placeholder="입력시 매도가 계산"
                            className="border rounded px-1.5 py-1 w-16 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeScenarioRow(row.key)}
                          className="text-red-400 hover:text-red-600 pb-1 text-base leading-none"
                        >×</button>
                      </div>
                      {calc && calc.qty > 0 ? (
                        <p className="text-[11px] text-gray-500">
                          매수가능 <span className="font-medium text-gray-700">{calc.qty}주</span> (투자금 {formatKRW(calc.invest)})
                          {calc.profit != null && (
                            <>
                              {' · 부분수익 '}
                              <span className={`font-medium ${calc.profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {(calc.profit >= 0 ? '+' : '') + formatKRW(Math.round(calc.profit))}
                              </span>
                              {calc.rate != null && (
                                <span className={calc.profit >= 0 ? 'text-red-400' : 'text-blue-400'}> ({formatRate(calc.rate)})</span>
                              )}
                            </>
                          )}
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-300">매수가와 여유자금을 입력하면 매수 가능 수량이 표시됩니다</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      <div className="border-t pt-2 mt-1">
        <TradeImageZone tradeId={trade.id} images={images} onUpdate={setImages} />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onEdit} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border rounded">수정</button>
        <button
          onClick={() => { if (confirm(`"${trade.symbol}" 거래를 삭제하시겠습니까?`)) onDelete() }}
          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 border border-red-200 rounded"
        >삭제</button>
      </div>
    </div>
  )
}
