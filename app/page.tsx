'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { Trade, Account } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { formatKRW } from '@/lib/utils'

interface StockMasterItem { symbol: string; symbolCode: string; tags: string | null; marketType: string | null }
import TradeCard from '@/components/TradeCard'
import TradeHistory from '@/components/TradeHistory'
import SymbolHistory from '@/components/SymbolHistory'
import TradeCalendar from '@/components/TradeCalendar'
import MemoStrip from '@/components/MemoStrip'
import SummaryBar from '@/components/SummaryBar'
import TradeModal from '@/components/TradeModal'

interface Memo { id: string; content: string; showOnMain: boolean; showOnCoin: boolean; symbol?: string | null; alertDate?: string | null }

export default function HomePage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [memos, setMemos] = useState<Memo[]>([])
  const [stockMasters, setStockMasters] = useState<StockMasterItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState<Trade | null>(null)
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

  async function saveSim(trade: Trade) {
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

  function calcNewAvg(trade: Trade, draftRows: { price: string; qty: string }[], saved: { price: number; quantity: number }[]) {
    let totalAmt = trade.avgBuyPrice * trade.remainingQuantity
    let totalQty = trade.remainingQuantity
    for (const s of saved) { totalAmt += s.price * s.quantity; totalQty += s.quantity }
    for (const row of draftRows) {
      const p = Number(row.price); const q = Number(row.qty)
      if (p > 0 && q > 0) { totalAmt += p * q; totalQty += q }
    }
    return totalQty > trade.remainingQuantity ? totalAmt / totalQty : null
  }
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [symbolFilter, setSymbolFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'table' | 'calendar' | 'symbol'>('table')

  const loadAccounts = useCallback(async () => {
    const data = await apiFetch('/api/accounts').then(r => r.json())
    if (Array.isArray(data)) setAccounts(data)
  }, [])

  const loadStockMasters = useCallback(async () => {
    const data = await apiFetch('/api/stock-master').then(r => r.json())
    if (Array.isArray(data)) setStockMasters(data)
  }, [])

  const loadMemos = useCallback(async () => {
    const data = await apiFetch('/api/memos').then(r => r.json())
    if (Array.isArray(data)) setMemos(data)
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (accountFilter !== 'all') params.set('accountId', accountFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('search', search)

    const data = await apiFetch(`/api/trades?${params}`).then(r => r.json())
    if (Array.isArray(data)) setTrades(data)
  }, [search, statusFilter, accountFilter])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { load() }, [load])
  useEffect(() => { loadMemos() }, [loadMemos])
  useEffect(() => { loadStockMasters() }, [loadStockMasters])
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

  const allTags = useMemo(() => {
    const set = new Set<string>()
    stockMasters.forEach(m => {
      if (m.tags) m.tags.split(',').filter(Boolean).forEach(t => set.add(t))
    })
    return Array.from(set).sort()
  }, [stockMasters])

  const symbolTagMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    stockMasters.forEach(m => {
      map[m.symbol] = m.tags ? m.tags.split(',').filter(Boolean) : []
    })
    return map
  }, [stockMasters])

  const symbolCodeMap = useMemo(() => {
    const map: Record<string, string> = {}
    stockMasters.forEach(m => { if (m.symbolCode) map[m.symbol] = m.symbolCode })
    return map
  }, [stockMasters])

  const symbolTypeMap = useMemo(() => {
    const map: Record<string, string> = {}
    stockMasters.forEach(m => { if (m.marketType) map[m.symbol] = m.marketType })
    return map
  }, [stockMasters])

  const filteredTagOptions = tagSearch.trim()
    ? allTags.filter(t => t.includes(tagSearch.trim()))
    : allTags

  function toggleTag(tag: string) {
    setTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const displayTrades = trades.filter(t => {
    if (symbolFilter && t.symbol !== symbolFilter) return false
    if (tagFilters.length > 0 && !tagFilters.some(tag => symbolTagMap[t.symbol]?.includes(tag))) return false
    return true
  })

  const holding = displayTrades.filter(t => !t.isCompleted)
  const completed = displayTrades.filter(t => t.isCompleted)

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">매매일지</h1>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`text-xs px-2 py-1.5 ${viewMode === 'table' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>≡</button>
            <button onClick={() => setViewMode('symbol')} className={`text-xs px-2 py-1.5 ${viewMode === 'symbol' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>종목</button>
            <button onClick={() => setViewMode('card')} className={`text-xs px-2 py-1.5 ${viewMode === 'card' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>▦</button>
            <button onClick={() => setViewMode('calendar')} className={`text-xs px-2 py-1.5 ${viewMode === 'calendar' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>📅</button>
          </div>
          <Link href="/coins" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">코인</Link>
          <Link href="/stats" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">통계</Link>
          <Link href="/memos" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">메모</Link>
          <Link href="/stock-master" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">종목관리</Link>
          <Link href="/accounts" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">계좌관리</Link>
          <button
            onClick={() => { setEditTrade(null); setShowModal(true) }}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + 새 거래
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        <div className="max-w-2xl mx-auto space-y-3">
          <MemoStrip memos={memos} page="stock" symbolCodeMap={symbolCodeMap} />
          <SummaryBar trades={displayTrades} />

          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="종목명 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm flex-1 min-w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
            <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">전체 계좌</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.nickname || `${a.broker} ${a.accountNumber}`}</option>
              ))}
            </select>
            {allTags.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setTagDropdownOpen(v => !v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border transition-colors ${
                  tagFilters.length > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                태그
                {tagFilters.length > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {tagFilters.length}
                  </span>
                )}
                <span className="text-gray-400 text-xs">{tagDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {tagDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTagDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-48 p-2 space-y-1.5">
                    <input
                      autoFocus
                      value={tagSearch}
                      onChange={e => setTagSearch(e.target.value)}
                      placeholder="태그 검색"
                      className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {tagFilters.length > 0 && (
                      <button
                        onClick={() => { setTagFilters([]); setTagDropdownOpen(false) }}
                        className="text-xs text-gray-400 hover:text-red-400 w-full text-left px-1"
                      >
                        전체 해제
                      </button>
                    )}
                    <div className="max-h-52 overflow-y-auto space-y-0.5">
                      {filteredTagOptions.length === 0
                        ? <p className="text-xs text-gray-400 px-1 py-1">검색 결과 없음</p>
                        : filteredTagOptions.map(tag => (
                          <label key={tag} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tagFilters.includes(tag)}
                              onChange={() => toggleTag(tag)}
                              className="accent-blue-600"
                            />
                            <span className="text-sm text-gray-700">{tag}</span>
                          </label>
                        ))
                      }
                    </div>
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>

        {/* 보유 종목 요약 — 평균매수가 · 추가매수 시뮬 */}
        {viewMode !== 'calendar' && holding.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-lg border bg-white overflow-hidden">
              <button
                onClick={() => setHoldingOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b hover:bg-gray-100 transition-colors"
              >
                <span className="text-xs text-gray-500 font-medium flex items-center gap-2">
                  보유 종목 <span className="text-gray-400">{holding.length}</span>
                  {symbolFilter && (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      {symbolFilter}
                      <button onClick={e => { e.stopPropagation(); setSymbolFilter(null) }} className="hover:text-blue-900">✕</button>
                    </span>
                  )}
                </span>
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
                          <button
                            onClick={() => setSymbolFilter(prev => prev === trade.symbol ? null : trade.symbol)}
                            className={`font-medium text-sm text-left ${symbolFilter === trade.symbol ? 'text-blue-600 underline' : 'text-gray-700 hover:text-blue-500'}`}
                          >{trade.symbol}</button>
                          <div className="text-right">
                            <span className="text-xs text-gray-600 tabular-nums">{formatKRW(Math.round(trade.avgBuyPrice))}</span>
                            {(trade.targetPrice || trade.stopLossPrice) && trade.avgBuyPrice > 0 && (
                              <div className="flex gap-1 justify-end mt-0.5">
                                {trade.targetPrice && (
                                  <span className="text-[10px] text-red-400">↑{Math.round((trade.targetPrice / trade.avgBuyPrice - 1) * 100)}%</span>
                                )}
                                {trade.stopLossPrice && (
                                  <span className="text-[10px] text-blue-400">↓{Math.round((trade.stopLossPrice / trade.avgBuyPrice - 1) * 100)}%</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 text-right">{trade.remainingQuantity}주</span>
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
                            {/* 저장된 항목 */}
                            {saved.map(s => (
                              <div key={s.id} className="flex items-center gap-2">
                                <span className="text-xs text-blue-400">•</span>
                                <span className="text-xs text-gray-600 tabular-nums w-28">{formatKRW(s.price)}</span>
                                <span className="text-xs text-gray-400">{s.quantity}주</span>
                                <button
                                  onClick={() => deleteSimEntry(s.id, trade.id)}
                                  className="text-xs text-gray-300 hover:text-red-400 ml-1"
                                >✕</button>
                              </div>
                            ))}
                            {/* 입력 중인 행 */}
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
                                  placeholder="수량(주)"
                                  className="border rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  min="0"
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
          </div>
        )}

        {viewMode === 'calendar' ? (
          <TradeCalendar
            trades={displayTrades}
            onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
            onDelete={async trade => { await apiFetch(`/api/trades/${trade.id}`, { method: 'DELETE' }); load() }}
          />
        ) : viewMode === 'table' ? (
          <TradeHistory
            trades={displayTrades}
            accounts={accounts}
            symbolTypeMap={symbolTypeMap}
            onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
            onDelete={async trade => { await apiFetch(`/api/trades/${trade.id}`, { method: 'DELETE' }); load() }}
          />
        ) : viewMode === 'symbol' ? (
          <SymbolHistory
            trades={displayTrades}
            accounts={accounts}
            symbolTypeMap={symbolTypeMap}
            onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
            onDelete={async trade => { await apiFetch(`/api/trades/${trade.id}`, { method: 'DELETE' }); load() }}
          />
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {holding.map(trade => (
              <TradeCard
                key={trade.id}
                trade={trade}
                account={accounts.find(a => a.id === trade.accountId)}
                marketType={symbolTypeMap[trade.symbol]}
                onEdit={() => { setEditTrade(trade); setShowModal(true) }}
                onDelete={async () => { await apiFetch(`/api/trades/${trade.id}`, { method: 'DELETE' }); load() }}
              />
            ))}
            {completed.map(trade => (
              <TradeCard
                key={trade.id}
                trade={trade}
                account={accounts.find(a => a.id === trade.accountId)}
                marketType={symbolTypeMap[trade.symbol]}
                onEdit={() => { setEditTrade(trade); setShowModal(true) }}
                onDelete={async () => { await apiFetch(`/api/trades/${trade.id}`, { method: 'DELETE' }); load() }}
              />
            ))}
            {trades.length === 0 && (
              <p className="text-center text-gray-400 py-16 text-sm">거래 기록이 없습니다<br/>새 거래를 입력해보세요</p>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <TradeModal
          trade={editTrade}
          trades={editTrade ? undefined : trades}
          accounts={accounts}
          defaultAccountId={accountFilter !== 'all' ? accountFilter : undefined}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load(); loadAccounts() }}
        />
      )}
    </div>
  )
}
