'use client'

import { useState } from 'react'
import type { CoinTrade } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { uuid, today } from '@/lib/utils'
import { parsePastedText } from '@/lib/coinParser'
import type { ParsedEntry } from '@/lib/coinParser'

interface Props {
  trade: CoinTrade | null
  onClose: () => void
  onSave: () => void
  symbols?: string[]
}

interface EntryRow { key: string; date: string; price: string; quantity: string }

const inputCls = 'border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-500 mb-0.5 block'

interface EntrySectionProps {
  type: 'buy' | 'sell'
  label: string
  entries: EntryRow[]
  onUpdate: (type: 'buy' | 'sell', key: string, field: keyof EntryRow, value: string) => void
  onAdd: (type: 'buy' | 'sell') => void
  onRemove: (type: 'buy' | 'sell', key: string) => void
}

function EntrySection({ type, label, entries, onUpdate, onAdd, onRemove }: EntrySectionProps) {
  return (
    <fieldset className="border rounded-lg p-3 space-y-2">
      <legend className="text-xs font-medium px-1 text-gray-500">{label} (선택)</legend>
      {entries.length === 0 && <p className="text-xs text-gray-400 text-center py-1">내역 없음</p>}
      {entries.map((row, idx) => (
        <div key={row.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div>
            {idx === 0 && <label className={labelCls}>날짜</label>}
            <input type="date" value={row.date} onChange={e => onUpdate(type, row.key, 'date', e.target.value)} className={inputCls} />
          </div>
          <div>
            {idx === 0 && <label className={labelCls}>단가 (원)</label>}
            <input type="number" value={row.price} onChange={e => onUpdate(type, row.key, 'price', e.target.value)} className={inputCls} placeholder="50000000" min="0" step="any" />
          </div>
          <div>
            {idx === 0 && <label className={labelCls}>수량</label>}
            <input type="number" value={row.quantity} onChange={e => onUpdate(type, row.key, 'quantity', e.target.value)} className={inputCls} placeholder="0.5" min="0" step="any" />
          </div>
          <button type="button" onClick={() => onRemove(type, row.key)} className="text-red-400 hover:text-red-600 pb-1 text-lg leading-none">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onAdd(type)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
        + {type === 'buy' ? '매수' : '매도'} 추가
      </button>
    </fieldset>
  )
}

function newRow(): EntryRow { return { key: uuid(), date: today(), price: '', quantity: '' } }

function toEntry(e: { date: string; price: number; quantity: number }): EntryRow {
  return { key: uuid(), date: e.date.slice(0, 10), price: e.price.toString(), quantity: e.quantity.toString() }
}

export default function CoinModal({ trade, onClose, onSave, symbols = [] }: Props) {
  const isEdit = trade !== null
  const [tab, setTab] = useState<'direct' | 'paste'>('direct')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 내역 추가 폼 (신규)
  const [addSymbol, setAddSymbol] = useState('')
  const [addType, setAddType] = useState<'매수' | '매도'>('매수')
  const [addDate, setAddDate] = useState(today())
  const [addPrice, setAddPrice] = useState('')
  const [addQuantity, setAddQuantity] = useState('')

  // 수정 폼 (기존 거래)
  const [symbol, setSymbol] = useState(trade?.symbol ?? '')
  const [comment, setComment] = useState(trade?.comment ?? '')
  const [buyEntries, setBuyEntries] = useState<EntryRow[]>(trade ? trade.buyEntries.map(toEntry) : [])
  const [sellEntries, setSellEntries] = useState<EntryRow[]>(trade ? trade.sellEntries.map(toEntry) : [])

  // 붙여넣기 상태
  const [pasteText, setPasteText] = useState('')
  const [parsed, setParsed] = useState<ParsedEntry[]>([])
  const [parseError, setParseError] = useState('')
  const [savedSymbols, setSavedSymbols] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  function updateEntry(type: 'buy' | 'sell', key: string, field: keyof EntryRow, value: string) {
    const setter = type === 'buy' ? setBuyEntries : setSellEntries
    setter(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r))
  }
  function addEntry(type: 'buy' | 'sell') {
    const setter = type === 'buy' ? setBuyEntries : setSellEntries
    setter(prev => [...prev, newRow()])
  }
  function removeEntry(type: 'buy' | 'sell', key: string) {
    const setter = type === 'buy' ? setBuyEntries : setSellEntries
    setter(prev => prev.filter(r => r.key !== key))
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!addSymbol.trim()) { setError('종목명은 필수입니다.'); return }
    if (!addPrice || !addQuantity) { setError('단가와 수량을 입력해주세요.'); return }
    setSaving(true)
    try {
      const res = await apiFetch('/api/coins/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: addSymbol.trim(),
          type: addType,
          date: `${addDate}T00:00:00`,
          price: Number(addPrice),
          quantity: Number(addQuantity),
        }),
      })
      if (!res.ok) {
        let msg = '저장 실패'
        try { const d = await res.json(); msg = d.error ?? msg } catch {}
        setError(msg); return
      }
      onSave()
    } finally { setSaving(false) }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!symbol.trim()) { setError('종목명은 필수입니다.'); return }
    const validBuy = buyEntries.filter(r => r.date && r.price && r.quantity)
    const validSell = sellEntries.filter(r => r.date && r.price && r.quantity)
    if (validBuy.length === 0 && validSell.length === 0) {
      setError('매수 또는 매도 내역을 하나 이상 입력해주세요.'); return
    }
    setSaving(true)
    try {
      const payload = {
        symbol: symbol.trim(),
        comment: comment.trim() || null,
        buyEntries: validBuy.map(r => ({ date: `${r.date}T00:00:00`, price: Number(r.price), quantity: Number(r.quantity) })),
        sellEntries: validSell.map(r => ({ date: `${r.date}T00:00:00`, price: Number(r.price), quantity: Number(r.quantity) })),
      }
      const res = await apiFetch(`/api/coins/${trade!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        let msg = '저장 실패'
        try { const d = await res.json(); msg = d.error ?? msg } catch {}
        setError(msg); return
      }
      onSave()
    } finally { setSaving(false) }
  }

  function handleParse() {
    setParseError('')
    const results = parsePastedText(pasteText)
    if (results.length === 0) { setParseError('파싱된 내역이 없습니다. 형식을 확인해주세요.'); return }
    setParsed(results)
  }

  async function saveSymbol(sym: string): Promise<boolean> {
    const entries = parsed.filter(e => e.symbol === sym)
    const payload = {
      symbol: sym,
      buyEntries: entries.filter(e => e.type === '매수').map(e => ({ date: e.date, price: e.price, quantity: e.quantity })),
      sellEntries: entries.filter(e => e.type === '매도').map(e => ({ date: e.date, price: e.price, quantity: e.quantity })),
    }
    const res = await apiFetch('/api/coins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return res.ok
  }

  async function handleSaveOne(sym: string) {
    const ok = await saveSymbol(sym)
    if (ok) setSavedSymbols(prev => new Set(prev).add(sym))
  }

  async function handleSaveAll() {
    setBulkSaving(true)
    const syms = Object.keys(parsedBySymbol).filter(s => !savedSymbols.has(s))
    for (const sym of syms) {
      const ok = await saveSymbol(sym)
      if (ok) setSavedSymbols(prev => new Set(prev).add(sym))
    }
    setBulkSaving(false)
    onSave()
  }

  function applySymbol(sym: string) {
    const entries = parsed.filter(e => e.symbol === sym)
    setSymbol(sym)
    setBuyEntries(entries.filter(e => e.type === '매수').map(e => ({ key: uuid(), date: e.date.slice(0, 10), price: e.price.toString(), quantity: e.quantity.toString() })))
    setSellEntries(entries.filter(e => e.type === '매도').map(e => ({ key: uuid(), date: e.date.slice(0, 10), price: e.price.toString(), quantity: e.quantity.toString() })))
    setTab('direct')
  }

  const parsedBySymbol = parsed.reduce<Record<string, ParsedEntry[]>>((acc, e) => {
    ;(acc[e.symbol] ??= []).push(e); return acc
  }, {})

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-semibold">{isEdit ? '코인 거래 수정' : '내역 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* 수정 모드 */}
        {isEdit && (
          <div className="p-5">
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>종목명 *</label>
                <input value={symbol} onChange={e => setSymbol(e.target.value)} className={inputCls} placeholder="BTC, ETH, XRP..." />
              </div>
              <EntrySection type="sell" label="매도 내역" entries={sellEntries} onUpdate={updateEntry} onAdd={addEntry} onRemove={removeEntry} />
              <EntrySection type="buy" label="매수 내역" entries={buyEntries} onUpdate={updateEntry} onAdd={addEntry} onRemove={removeEntry} />
              <div>
                <label className={labelCls}>코멘트</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder="매매 이유, 전략 등..." maxLength={500} />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-500 hover:bg-gray-50">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 내역 추가 모드 */}
        {!isEdit && (
          <>
            <div className="flex border-b">
              {(['direct', 'paste'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-sm ${tab === t ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {t === 'direct' ? '직접 입력' : '거래내역 붙여넣기'}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'direct' && (
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className={labelCls}>종목명 *</label>
                    <input
                      value={addSymbol}
                      onChange={e => setAddSymbol(e.target.value)}
                      list="coin-symbols"
                      className={inputCls}
                      placeholder="BTC, ETH, XRP..."
                      autoComplete="off"
                    />
                    <datalist id="coin-symbols">
                      {symbols.map(s => <option key={s} value={s} />)}
                    </datalist>
                    {symbols.includes(addSymbol.trim()) && (
                      <p className="text-xs text-blue-500 mt-1">기존 {addSymbol} 거래에 내역이 추가됩니다.</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>구분 *</label>
                    <div className="flex gap-2">
                      {(['매수', '매도'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setAddType(t)}
                          className={`flex-1 py-2 text-sm rounded border transition-colors ${
                            addType === t
                              ? t === '매수' ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-500 text-white border-orange-500'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>날짜 *</label>
                    <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>단가 (원) *</label>
                      <input type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} className={inputCls} placeholder="50000000" min="0" step="any" />
                    </div>
                    <div>
                      <label className={labelCls}>수량 *</label>
                      <input type="number" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} className={inputCls} placeholder="0.5" min="0" step="any" />
                    </div>
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <div className="flex gap-2 justify-end pt-1">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-500 hover:bg-gray-50">취소</button>
                    <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {saving ? '저장 중...' : '추가'}
                    </button>
                  </div>
                </form>
              )}

              {tab === 'paste' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">거래소 체결내역을 그대로 복사해서 붙여넣으세요.</p>
                  <textarea
                    value={pasteText}
                    onChange={e => { setPasteText(e.target.value); setParsed([]); setParseError('') }}
                    placeholder={'2026.04.28 10:32\nBTC\nKRW\n매수\n0.01000000BTC\n85,000,000KRW\n...'}
                    className="w-full border rounded px-3 py-2 text-xs font-mono h-48 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button onClick={handleParse} disabled={!pasteText.trim()}
                    className="w-full py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">
                    파싱
                  </button>
                  {parseError && <p className="text-red-500 text-sm">{parseError}</p>}

                  {Object.keys(parsedBySymbol).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 font-medium">파싱 결과 — {Object.keys(parsedBySymbol).length}개 종목</p>
                        <button onClick={handleSaveAll}
                          disabled={bulkSaving || Object.keys(parsedBySymbol).every(s => savedSymbols.has(s))}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40">
                          {bulkSaving ? '저장 중...' : '전체 저장'}
                        </button>
                      </div>
                      {Object.entries(parsedBySymbol).map(([sym, entries]) => {
                        const buys = entries.filter(e => e.type === '매수')
                        const sells = entries.filter(e => e.type === '매도')
                        const isSaved = savedSymbols.has(sym)
                        return (
                          <div key={sym} className={`flex items-center justify-between border rounded-lg px-4 py-3 ${isSaved ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}>
                            <div>
                              <span className="font-medium text-sm">{sym}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {buys.length > 0 && `매수 ${buys.length}건`}
                                {buys.length > 0 && sells.length > 0 && ' · '}
                                {sells.length > 0 && `매도 ${sells.length}건`}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {isSaved
                                ? <span className="text-xs text-green-600">✓ 저장됨</span>
                                : <>
                                    <button onClick={() => applySymbol(sym)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border rounded">수정 후 저장</button>
                                    <button onClick={() => handleSaveOne(sym)} className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-200 rounded bg-white">저장</button>
                                  </>
                              }
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
