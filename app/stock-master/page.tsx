'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import type { MemoImage } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import MemoImageZone from '@/components/MemoImageZone'

const MARKET_TYPES = ['코스피', '코스닥', 'ETF'] as const
type MarketType = typeof MARKET_TYPES[number]

interface StockMaster {
  id: string
  symbol: string
  symbolCode: string
  tags?: string | null
  marketType?: string | null
}

interface StockMemo {
  id: string
  content: string
  symbols: { id: string; symbol: string }[]
  createdAt: string
  images: MemoImage[]
}

function parseTags(tags?: string | null): string[] {
  return tags ? tags.split(',').filter(Boolean) : []
}

export default function StockMasterPage() {
  const [list, setList] = useState<StockMaster[]>([])
  const [symbol, setSymbol] = useState('')
  const [symbolCode, setSymbolCode] = useState('')
  const [marketType, setMarketType] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editSymbol, setEditSymbol] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editMarketType, setEditMarketType] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tagInputId, setTagInputId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [allMemos, setAllMemos] = useState<StockMemo[]>([])
  const [memoImagesMap, setMemoImagesMap] = useState<Record<string, MemoImage[]>>({})
  const [memoExpandId, setMemoExpandId] = useState<string | null>(null)
  const [memoInputId, setMemoInputId] = useState<string | null>(null)
  const [memoInput, setMemoInput] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [marketTypeFilter, setMarketTypeFilter] = useState<MarketType | '미지정' | null>(null)
  const [memoFilter, setMemoFilter] = useState<'all' | 'has' | 'none'>('all')
  const [sortMode, setSortMode] = useState<'name' | 'memoCount'>('name')

  const allTagsInList = useMemo(() => {
    const set = new Set<string>()
    list.forEach(item => parseTags(item.tags).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [list])

  const typeCounts = useMemo(() => {
    const counts: Record<MarketType | '미지정', number> = { '코스피': 0, '코스닥': 0, 'ETF': 0, '미지정': 0 }
    list.forEach(item => {
      if (item.marketType && item.marketType in counts) counts[item.marketType as MarketType]++
      else counts['미지정']++
    })
    return counts
  }, [list])

  const filtered = useMemo(() => {
    const symbolsWithMemo = new Set(allMemos.flatMap(m => m.symbols.map(s => s.symbol)))
    let result = list.filter(item => {
      if (search.trim()) {
        const q = search.trim()
        if (!item.symbol.includes(q) && !item.symbolCode.includes(q) && !(item.tags && item.tags.includes(q))) return false
      }
      if (tagFilter && !parseTags(item.tags).includes(tagFilter)) return false
      if (marketTypeFilter === '미지정' && item.marketType) return false
      if (marketTypeFilter && marketTypeFilter !== '미지정' && item.marketType !== marketTypeFilter) return false
      if (memoFilter === 'has' && !symbolsWithMemo.has(item.symbol)) return false
      if (memoFilter === 'none' && symbolsWithMemo.has(item.symbol)) return false
      return true
    })
    if (sortMode === 'memoCount') {
      const memoCountMap: Record<string, number> = {}
      allMemos.forEach(m => m.symbols.forEach(s => { memoCountMap[s.symbol] = (memoCountMap[s.symbol] ?? 0) + 1 }))
      result = [...result].sort((a, b) => {
        const diff = (memoCountMap[b.symbol] ?? 0) - (memoCountMap[a.symbol] ?? 0)
        return diff !== 0 ? diff : a.symbol.localeCompare(b.symbol, 'ko')
      })
    }
    return result
  }, [list, search, tagFilter, marketTypeFilter, memoFilter, sortMode, allMemos])

  async function load() {
    const data = await apiFetch('/api/stock-master').then(r => r.json())
    if (Array.isArray(data)) setList(data)
  }

  async function loadMemos() {
    const data = await apiFetch('/api/memos').then(r => r.json())
    if (Array.isArray(data)) setAllMemos(data)
  }

  useEffect(() => { load(); loadMemos() }, [])

  async function handleAdd() {
    if (!symbol.trim() || !symbolCode.trim()) return
    setSaving(true)
    await apiFetch('/api/stock-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, symbolCode, marketType: marketType || null }),
    })
    setSymbol('')
    setSymbolCode('')
    setMarketType('')
    setSearch('')
    setSaving(false)
    load()
  }

  async function handleEdit(item: StockMaster) {
    if (!editSymbol.trim() || !editCode.trim()) return
    await apiFetch(`/api/stock-master/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: editSymbol, symbolCode: editCode, marketType: editMarketType || null }),
    })
    setEditId(null)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await apiFetch(`/api/stock-master/${id}`, { method: 'DELETE' })
    load()
  }

  async function handleAddTag(item: StockMaster, tag: string) {
    const trimmed = tag.trim()
    if (!trimmed) return
    const current = parseTags(item.tags)
    if (current.includes(trimmed)) { setTagInput(''); setTagInputId(null); return }
    const newTags = [...current, trimmed].join(',')
    await apiFetch(`/api/stock-master/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    setTagInput('')
    setTagInputId(null)
    load()
  }

  async function handleAddMemo(item: StockMaster) {
    const trimmed = memoInput.trim()
    if (!trimmed) return
    await apiFetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed, symbols: [item.symbol], category: '종목', showOnMain: false, showOnCoin: false }),
    })
    setMemoInput('')
    setMemoInputId(null)
    loadMemos()
  }

  async function handleDeleteMemo(id: string) {
    if (!confirm('메모를 삭제하시겠습니까?')) return
    await apiFetch(`/api/memos/${id}`, { method: 'DELETE' })
    loadMemos()
  }

  async function handleRemoveTag(item: StockMaster, tag: string) {
    const newTags = parseTags(item.tags).filter(t => t !== tag).join(',')
    await apiFetch(`/api/stock-master/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags || null }),
    })
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
          <div className="flex gap-2 flex-wrap">
            <input
              value={symbol}
              onChange={e => { setSymbol(e.target.value); setSearch(e.target.value) }}
              placeholder="종목명 (예: 삼성전자)"
              className="border rounded px-3 py-1.5 text-sm flex-1 min-w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              value={symbolCode}
              onChange={e => { setSymbolCode(e.target.value); setSearch(e.target.value) }}
              placeholder="종목코드 (예: 005930)"
              className="border rounded px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={marketType}
              onChange={e => setMarketType(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">시장 선택</option>
              {MARKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              onClick={handleAdd}
              disabled={saving || !symbol.trim() || !symbolCode.trim()}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 flex-wrap gap-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">전체 {list.length}건</span>
            {MARKET_TYPES.filter(t => typeCounts[t] > 0).map(t => (
              <button
                key={t}
                onClick={() => setMarketTypeFilter(marketTypeFilter === t ? null : t)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  marketTypeFilter === t
                    ? t === '코스피' ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : t === '코스닥' ? 'bg-green-50 text-green-700 border-green-300'
                      : 'bg-purple-50 text-purple-700 border-purple-300'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t} {typeCounts[t]}
              </button>
            ))}
            {typeCounts['미지정'] > 0 && (
              <button
                onClick={() => setMarketTypeFilter(marketTypeFilter === '미지정' ? null : '미지정')}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  marketTypeFilter === '미지정'
                    ? 'bg-gray-100 text-gray-700 border-gray-400'
                    : 'bg-white text-gray-400 border-gray-200 border-dashed hover:border-gray-400'
                }`}
              >
                미지정 {typeCounts['미지정']}
              </button>
            )}
            {search.trim() && (
              <span className="text-xs text-blue-500">"{search.trim()}" 검색 결과 {filtered.length}건</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex border rounded overflow-hidden text-xs">
              {(['all', 'has', 'none'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setMemoFilter(v)}
                  className={`px-2.5 py-1.5 ${memoFilter === v ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {v === 'all' ? '전체' : v === 'has' ? '메모있는' : '메모없는'}
                </button>
              ))}
            </div>
            <div className="flex border rounded overflow-hidden text-xs">
              {([['name', '종목명순'], ['memoCount', '메모건수순']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setSortMode(v)}
                  className={`px-2.5 py-1.5 ${sortMode === v ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 태그 필터 */}
        {allTagsInList.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTagFilter(null)}
              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                tagFilter === null ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
              }`}
            >
              전체 태그
            </button>
            {allTagsInList.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  tagFilter === tag
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            {search.trim() ? '검색 결과가 없습니다' : '등록된 종목이 없습니다'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} className="bg-white rounded-lg border px-4 py-3">
                {editId === item.id ? (
                  <div className="flex gap-2 flex-wrap">
                    <input
                      value={editSymbol}
                      onChange={e => setEditSymbol(e.target.value)}
                      className="border rounded px-3 py-1.5 text-sm flex-1 min-w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      value={editCode}
                      onChange={e => setEditCode(e.target.value)}
                      className="border rounded px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <select
                      value={editMarketType}
                      onChange={e => setEditMarketType(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      <option value="">시장 선택</option>
                      {MARKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={() => setEditId(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1 border rounded">취소</button>
                    <button onClick={() => handleEdit(item)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">저장</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium flex-1">{item.symbol}</span>
                      {item.marketType && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                          item.marketType === '코스피' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          item.marketType === '코스닥' ? 'bg-green-50 text-green-600 border-green-200' :
                          'bg-purple-50 text-purple-600 border-purple-200'
                        }`}>{item.marketType}</span>
                      )}
                      <span className="text-sm text-gray-400 font-mono">{item.symbolCode}</span>
                      <a
                        href={`https://finance.naver.com/item/main.naver?code=${item.symbolCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-600"
                      >
                        네이버
                      </a>
                      <button onClick={() => { setEditId(item.id); setEditSymbol(item.symbol); setEditCode(item.symbolCode); setEditMarketType(item.marketType ?? '') }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded">수정</button>
                      <button onClick={() => handleDelete(item.id)} className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded">삭제</button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {parseTags(item.tags).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(item, tag)}
                            className="hover:text-blue-800 ml-0.5 leading-none"
                          >×</button>
                        </span>
                      ))}
                      {tagInputId === item.id ? (
                        <input
                          autoFocus
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddTag(item, tagInput)
                            if (e.key === 'Escape') { setTagInputId(null); setTagInput('') }
                          }}
                          onBlur={() => { if (tagInput.trim()) handleAddTag(item, tagInput); else { setTagInputId(null); setTagInput('') } }}
                          className="text-xs border rounded px-2 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="태그 입력"
                        />
                      ) : (
                        <button
                          onClick={() => { setTagInputId(item.id); setTagInput('') }}
                          className="text-xs text-gray-300 hover:text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 px-2 py-0.5 rounded-full transition-colors"
                        >
                          + 태그
                        </button>
                      )}
                    </div>

                    {/* 메모 섹션 */}
                    {(() => {
                      const stockMemos = allMemos.filter(m => m.symbols.some(s => s.symbol === item.symbol))
                      return (
                        <>
                          <button
                            onClick={() => setMemoExpandId(memoExpandId === item.id ? null : item.id)}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              stockMemos.length > 0
                                ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                                : 'text-gray-300 border-dashed border-gray-300 hover:text-gray-500 hover:border-gray-400'
                            }`}
                          >
                            메모{stockMemos.length > 0 && ` ${stockMemos.length}건`}
                            <span className="ml-1 text-gray-400">{memoExpandId === item.id ? '▲' : '▼'}</span>
                          </button>

                          {memoExpandId === item.id && (
                            <div className="border-t pt-2 space-y-1.5">
                              {stockMemos.map(m => (
                                <div key={m.id} className="bg-gray-50 rounded border border-gray-100">
                                  <div className="flex items-start gap-2 px-2 py-1.5">
                                    <p className="text-xs text-gray-700 flex-1 whitespace-pre-wrap break-words">{m.content}</p>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-xs text-gray-300">{m.createdAt.slice(0, 10)}</span>
                                      <button
                                        onClick={() => handleDeleteMemo(m.id)}
                                        className="text-xs text-red-300 hover:text-red-500"
                                      >×</button>
                                    </div>
                                  </div>
                                  <div className="px-2 pb-2">
                                    <MemoImageZone
                                      memoId={m.id}
                                      images={memoImagesMap[m.id] ?? m.images}
                                      onUpdate={imgs => setMemoImagesMap(prev => ({ ...prev, [m.id]: imgs }))}
                                    />
                                  </div>
                                </div>
                              ))}
                              {memoInputId === item.id ? (
                                <div className="space-y-1">
                                  <textarea
                                    autoFocus
                                    value={memoInput}
                                    onChange={e => setMemoInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddMemo(item) }
                                      if (e.key === 'Escape') { setMemoInputId(null); setMemoInput('') }
                                    }}
                                    placeholder="메모 내용 입력 (Enter로 추가, Shift+Enter 줄바꿈)"
                                    rows={2}
                                    className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400 resize-none"
                                  />
                                  <div className="flex justify-end gap-1">
                                    <button onClick={() => { setMemoInputId(null); setMemoInput('') }} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border rounded">취소</button>
                                    <button onClick={() => handleAddMemo(item)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">추가</button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setMemoInputId(item.id); setMemoInput('') }}
                                  className="text-xs text-gray-300 hover:text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 px-2 py-0.5 rounded w-full text-left transition-colors"
                                >
                                  + 메모 추가
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )
                    })()}
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
