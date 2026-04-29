'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface StockMaster {
  id: string
  symbol: string
  symbolCode: string
}

export default function StockMasterPage() {
  const [list, setList] = useState<StockMaster[]>([])
  const [symbol, setSymbol] = useState('')
  const [symbolCode, setSymbolCode] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editSymbol, setEditSymbol] = useState('')
  const [editCode, setEditCode] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await apiFetch('/api/stock-master').then(r => r.json())
    if (Array.isArray(data)) setList(data)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!symbol.trim() || !symbolCode.trim()) return
    setSaving(true)
    await apiFetch('/api/stock-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, symbolCode }),
    })
    setSymbol('')
    setSymbolCode('')
    setSaving(false)
    load()
  }

  async function handleEdit(item: StockMaster) {
    if (!editSymbol.trim() || !editCode.trim()) return
    await apiFetch(`/api/stock-master/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: editSymbol, symbolCode: editCode }),
    })
    setEditId(null)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await apiFetch(`/api/stock-master/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">종목 마스터</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">← 돌아가기</Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">종목 추가</p>
          <p className="text-xs text-gray-400">등록하면 같은 이름의 기존 거래에도 자동 적용됩니다.</p>
          <div className="flex gap-2">
            <input
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              placeholder="종목명 (예: 삼성전자)"
              className="border rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              value={symbolCode}
              onChange={e => setSymbolCode(e.target.value)}
              placeholder="종목코드 (예: 005930)"
              className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !symbol.trim() || !symbolCode.trim()}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">등록된 종목이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {list.map(item => (
              <div key={item.id} className="bg-white rounded-lg border px-4 py-3">
                {editId === item.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editSymbol}
                      onChange={e => setEditSymbol(e.target.value)}
                      className="border rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      value={editCode}
                      onChange={e => setEditCode(e.target.value)}
                      className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button onClick={() => setEditId(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1 border rounded">취소</button>
                    <button onClick={() => handleEdit(item)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">저장</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium flex-1">{item.symbol}</span>
                    <span className="text-sm text-gray-400 font-mono">{item.symbolCode}</span>
                    <a
                      href={`https://finance.naver.com/item/main.naver?code=${item.symbolCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-600"
                    >
                      네이버
                    </a>
                    <button onClick={() => { setEditId(item.id); setEditSymbol(item.symbol); setEditCode(item.symbolCode) }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded">수정</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded">삭제</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
