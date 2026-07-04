'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { CoinTrade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW, formatQty } from '@/lib/utils'
import CoinHistory from '@/components/CoinHistory'
import CoinCalendar from '@/components/CoinCalendar'
import CoinTimeline from '@/components/CoinTimeline'
import CoinModal from '@/components/CoinModal'
import MemoStrip from '@/components/MemoStrip'

interface Memo { id: string; content: string; showOnMain: boolean; showOnCoin: boolean }

export default function CoinsPage() {
  const [trades, setTrades] = useState<CoinTrade[]>([])
  const [allSymbols, setAllSymbols] = useState<string[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState<CoinTrade | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('list')
  const [holdingOpen, setHoldingOpen] = useState(false)
  const [simRows, setSimRows] = useState<Record<string, { price: string; qty: string }[]>>({})
  const [savedSims, setSavedSims] = useState<Record<string, { id: string; price: number; quantity: number }[]>>({})

  function addSimRow(tradeId: string) {
    setSimRows(prev => ({ ...prev, [tradeId]: [...(prev[tradeId] ?? []), { price: '', qty: '' }] }))
  }
  function removeSimRow(tradeId: string) {
    setSimRows(prev => {
      const rows = prev[tradeId] ?? []
      if (rows.length === 0) return prev
      return { ...prev, [tradeId]: rows.slice(0, -1) }
    })
  }
  function updateSimRow(tradeId: string, i: number, field: 'price' | 'qty', value: string) {
    setSimRows(prev => {
      const rows = [...(prev[tradeId] ?? [])]
      rows[i] = { ...rows[i], [field]: value }
      return { ...prev, [tradeId]: rows }
    })
  }

  const loadSavedSims = useCallback(async () => {
    const data = await apiFetch('/api/sim-entries').then(r => r.json())
    if (!Array.isArray(data)) return
    const map: Record<string, { id: string; price: number; quantity: number }[]> = {}
    for (const e of data) {
      ;(map[e.tradeId] ??= []).push({ id: e.id, price: e.price, quantity: e.quantity })
    }
    setSavedSims(map)
  }, [])

  async function saveSim(trade: CoinTrade) {
    const rows = (simRows[trade.id] ?? []).filter(r => Number(r.price) > 0 && Number(r.qty) > 0)
    if (rows.length === 0) return
    for (const row of rows) {
      await apiFetch('/api/sim-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId: trade.id, price: Number(row.price), quantity: Number(row.qty) }),
      })
    }
    setSimRows(prev => ({ ...prev, [trade.id]: [] }))
    loadSavedSims()
  }

  async function deleteSimEntry(id: string, tradeId: string) {
    await apiFetch(`/api/sim-entries/${id}`, { method: 'DELETE' })
    setSavedSims(prev => ({ ...prev, [tradeId]: (prev[tradeId] ?? []).filter(e => e.id !== id) }))
  }

  function calcNewAvg(trade: CoinTrade, draftRows: { price: string; qty: string }[], saved: { price: number; quantity: number }[]) {
    let totalAmt = trade.avgBuyPrice * trade.remainingQuantity
    let totalQty = trade.remainingQuantity
    for (const s of saved) { totalAmt += s.price * s.quantity; totalQty += s.quantity }
    for (const row of draftRows) {
      const p = Number(row.price); const q = Number(row.qty)
      if (p > 0 && q > 0) { totalAmt += p * q; totalQty += q }
    }
    return totalQty > trade.remainingQuantity ? totalAmt / totalQty : null
  }

  const loadMemos = useCallback(async () => {
    const data = await apiFetch('/api/memos').then(r => r.json())
    if (Array.isArray(data)) setMemos(data)
  }, [])

  const loadSymbols = useCallback(async () => {
    const data = await apiFetch('/api/coins').then(r => r.json())
    if (Array.isArray(data)) setAllSymbols([...new Set((data as CoinTrade[]).map(t => t.symbol))])
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('search', search)
    const data = await apiFetch(`/api/coins?${params}`).then(r => r.json())
    if (Array.isArray(data)) setTrades(data)
  }, [search, statusFilter])

  useEffect(() => { loadSymbols() }, [loadSymbols])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadMemos() }, [loadMemos])
  useEffect(() => { loadSavedSims() }, [loadSavedSims])

  // 완료된 거래의 시뮬 항목 자동 삭제
  useEffect(() => {
    const completedIds = trades.filter(t => t.isCompleted).map(t => t.id)
    completedIds.forEach(id => {
      if (savedSims[id]?.length) {
        apiFetch(`/api/sim-entries?tradeId=${id}`, { method: 'DELETE' })
          .then(() => setSavedSims(prev => { const next = { ...prev }; delete next[id]; return next }))
      }
    })
  }, [trades])

  const holding = trades.filter(t => !t.isCompleted)
  const completed = trades.filter(t => t.isCompleted)
  const totalProfit = completed.reduce((s, t) => s + t.profitAmount, 0)

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">코인 매매일지</h1>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`text-xs px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>≡</button>
            <button onClick={() => setViewMode('calendar')} className={`text-xs px-2.5 py-1.5 ${viewMode === 'calendar' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>📅</button>
            <button onClick={() => setViewMode('timeline')} className={`text-xs px-2.5 py-1.5 ${viewMode === 'timeline' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>복기</button>
          </div>
          <Link href="/" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">주식</Link>
          <Link href="/stats" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">통계</Link>
          <Link href="/memos" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">메모</Link>
          <button
            onClick={() => { setEditTrade(null); setShowModal(true) }}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + 내역 추가
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
      <div className="max-w-4xl mx-auto space-y-3">
        <MemoStrip memos={memos} page="coin" />
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">보유중</p>
            <p className="text-lg font-semibold text-gray-800">{holding.length}건</p>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">완료</p>
            <p className="text-lg font-semibold text-gray-800">{completed.length}건</p>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">실현손익</p>
            <p className={`text-lg font-semibold ${completed.length === 0 ? 'text-gray-300' : totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {completed.length === 0 ? '-' : (totalProfit >= 0 ? '+' : '') + Math.round(totalProfit).toLocaleString('ko-KR') + '원'}
            </p>
          </div>
        </div>

        {/* 검색/필터 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="종목명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <div className="flex border rounded overflow-hidden text-sm">
            {(['all', '보유중', '매도완료'] as const).map(v => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`px-3 py-1.5 ${statusFilter === v ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {v === 'all' ? '전체' : v}
              </button>
            ))}
          </div>
        </div>

        {/* 보유 종목 요약 — 평균매수가 · 추가매수 시뮬 */}
        {viewMode !== 'calendar' && holding.length > 0 && (
          <div className="rounded-lg border bg-white overflow-hidden">
            <button
              onClick={() => setHoldingOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b hover:bg-gray-100 transition-colors"
            >
              <span className="text-xs text-gray-500 font-medium">보유 종목 <span className="text-gray-400">{holding.length}</span></span>
              <span className="text-xs text-gray-400">{holdingOpen ? '▲' : '▼'}</span>
            </button>
            {holdingOpen && (
              <>
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] text-xs text-gray-400 bg-gray-50 border-b px-3 py-1.5 gap-3">
                  <span>종목</span>
                  <span className="text-right">평균매수가</span>
                  <span className="text-right">잔여</span>
                  <span className="text-right">보유일</span>
                  <span />
                  <span />
                </div>
                {holding.map(trade => {
                  const rows = simRows[trade.id] ?? []
                  const saved = savedSims[trade.id] ?? []
                  const newAvg = calcNewAvg(trade, rows, saved)
                  return (
                    <div key={trade.id} className="border-b last:border-b-0">
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center px-3 py-2 gap-3 hover:bg-gray-50">
                        <span className="font-medium text-sm text-gray-700">{trade.symbol}</span>
                        <span className="text-xs text-gray-600 text-right tabular-nums">{formatKRW(Math.round(trade.avgBuyPrice))}</span>
                        <span className="text-xs text-gray-400 text-right">{formatQty(trade.remainingQuantity)}</span>
                        <span className="text-xs text-gray-400 text-right">{trade.holdingDays}일</span>
                        <button
                          onClick={() => addSimRow(trade.id)}
                          className="text-xs w-6 h-6 flex items-center justify-center rounded border text-blue-600 border-blue-200 hover:bg-blue-50 transition-colors"
                        >+</button>
                        <button
                          onClick={() => removeSimRow(trade.id)}
                          disabled={rows.length === 0}
                          className="text-xs w-6 h-6 flex items-center justify-center rounded border text-gray-400 border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30"
                        >−</button>
                      </div>
                      {(saved.length > 0 || rows.length > 0) && (
                        <div className="px-3 pb-3 space-y-1.5 bg-blue-50/40">
                          {saved.map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                              <span className="text-xs text-blue-400">•</span>
                              <span className="text-xs text-gray-600 tabular-nums w-28">{formatKRW(s.price)}</span>
                              <span className="text-xs text-gray-400">{formatQty(s.quantity)}</span>
                              <button
                                onClick={() => deleteSimEntry(s.id, trade.id)}
                                className="text-xs text-gray-300 hover:text-red-400 ml-1"
                              >✕</button>
                            </div>
                          ))}
                          {rows.map((row, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 w-4">↳</span>
                              <input
                                type="number"
                                value={row.price}
                                onChange={e => updateSimRow(trade.id, i, 'price', e.target.value)}
                                placeholder="단가"
                                className="border rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                min="0"
                              />
                              <input
                                type="number"
                                value={row.qty}
                                onChange={e => updateSimRow(trade.id, i, 'qty', e.target.value)}
                                placeholder="수량"
                                className="border rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                min="0"
                                step="any"
                              />
                            </div>
                          ))}
                          <div className="flex items-center gap-3 pt-0.5">
                            {newAvg != null ? (
                              <span className="text-xs font-medium text-blue-700">→ 새 평균가 {formatKRW(Math.round(newAvg))}</span>
                            ) : (
                              <span className="text-xs text-gray-300">단가·수량 입력 시 새 평균가 계산</span>
                            )}
                            {rows.some(r => Number(r.price) > 0 && Number(r.qty) > 0) && (
                              <button
                                onClick={() => saveSim(trade)}
                                className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                              >저장</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

        {/* 목록 / 달력 / 복기 */}
        {viewMode === 'calendar' ? (
          <CoinCalendar
            trades={trades}
            onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
            onDelete={async trade => { await apiFetch(`/api/coins/${trade.id}`, { method: 'DELETE' }); load() }}
          />
        ) : viewMode === 'timeline' ? (
          <CoinTimeline
            trades={trades}
            onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
            onDelete={async trade => { await apiFetch(`/api/coins/${trade.id}`, { method: 'DELETE' }); load() }}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            <CoinHistory
              trades={trades}
              onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
              onDelete={async trade => { await apiFetch(`/api/coins/${trade.id}`, { method: 'DELETE' }); load() }}
            />
          </div>
        )}
      </div>

      {showModal && (
        <CoinModal
          trade={editTrade}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load(); loadSymbols() }}
          symbols={allSymbols}
        />
      )}
    </div>
  )
}
