'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Trade, Account } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import TradeCard from '@/components/TradeCard'
import SummaryBar from '@/components/SummaryBar'
import TradeModal from '@/components/TradeModal'

export default function HomePage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editTrade, setEditTrade] = useState<Trade | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (accountFilter !== 'all') params.set('accountId', accountFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search) params.set('search', search)

    const [tradesData, accountsData] = await Promise.all([
      apiFetch(`/api/trades?${params}`).then(r => r.json()),
      apiFetch('/api/accounts').then(r => r.json()),
    ])
    setTrades(tradesData)
    setAccounts(accountsData)
  }, [search, statusFilter, accountFilter])

  useEffect(() => { load() }, [load])

  const holding = trades.filter(t => !t.sellDate)
  const completed = trades.filter(t => t.sellDate)

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">매매일지</h1>
        <div className="flex gap-2">
          <Link href="/accounts" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">계좌관리</Link>
          <button
            onClick={() => { setEditTrade(null); setShowModal(true) }}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + 새 거래
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <SummaryBar trades={trades} />

        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="종목명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm flex-1 min-w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
            <option value="all">전체</option>
            <option value="보유중">보유중</option>
            <option value="매도완료">매도완료</option>
          </select>
          <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
            <option value="all">전체 계좌</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.nickname || `${a.broker} ${a.accountNumber}`}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
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
      </div>

      {showModal && (
        <TradeModal
          trade={editTrade}
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
