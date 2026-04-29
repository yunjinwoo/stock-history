'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { CoinTrade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import CoinHistory from '@/components/CoinHistory'
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

  const holding = trades.filter(t => !t.isCompleted)
  const completed = trades.filter(t => t.isCompleted)
  const totalProfit = completed.reduce((s, t) => s + t.profitAmount, 0)

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">코인 매매일지</h1>
        <div className="flex gap-2">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">주식</Link>
          <button
            onClick={() => { setEditTrade(null); setShowModal(true) }}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + 내역 추가
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3 max-w-4xl mx-auto">
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
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
            <option value="all">전체</option>
            <option value="보유중">보유중</option>
            <option value="매도완료">매도완료</option>
          </select>
        </div>

        {/* 목록 */}
        <CoinHistory
          trades={trades}
          onEdit={trade => { setEditTrade(trade); setShowModal(true) }}
          onDelete={async trade => { await apiFetch(`/api/coins/${trade.id}`, { method: 'DELETE' }); load() }}
        />
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
