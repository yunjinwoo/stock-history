'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { Trade, Account } from '@/lib/types'
import { apiFetch } from '@/lib/api'

interface StockMasterItem { symbol: string; symbolCode: string; tags: string | null }
import TradeCard from '@/components/TradeCard'
import TradeHistory from '@/components/TradeHistory'
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'table' | 'calendar'>('table')

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

  const filteredTagOptions = tagSearch.trim()
    ? allTags.filter(t => t.includes(tagSearch.trim()))
    : allTags

  function toggleTag(tag: string) {
    setTagFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const displayTrades = tagFilters.length > 0
    ? trades.filter(t => tagFilters.some(tag => symbolTagMap[t.symbol]?.includes(tag)))
    : trades

  const holding = displayTrades.filter(t => !t.isCompleted)
  const completed = displayTrades.filter(t => t.isCompleted)

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">매매일지</h1>
        <div className="flex gap-2">
          <div className="flex border rounded overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`text-xs px-2 py-1.5 ${viewMode === 'table' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>≡</button>
            <button onClick={() => setViewMode('card')} className={`text-xs px-2 py-1.5 ${viewMode === 'card' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>▦</button>
            <button onClick={() => setViewMode('calendar')} className={`text-xs px-2 py-1.5 ${viewMode === 'calendar' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>📅</button>
          </div>
          <Link href="/coins" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">코인</Link>
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
                onEdit={() => { setEditTrade(trade); setShowModal(true) }}
                onDelete={async () => { await apiFetch(`/api/trades/${trade.id}`, { method: 'DELETE' }); load() }}
              />
            ))}
            {completed.map(trade => (
              <TradeCard
                key={trade.id}
                trade={trade}
                account={accounts.find(a => a.id === trade.accountId)}
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
          accounts={accounts}
          defaultAccountId={accountFilter !== 'all' ? accountFilter : undefined}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load(); loadAccounts() }}
        />
      )}
    </div>
  )
}
