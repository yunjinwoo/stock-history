'use client'

import { useState, useEffect } from 'react'
import type { Trade, Account } from '@/lib/types'
import type { ParsedTrade } from '@/lib/kakaoParser'
import KakaoParser from './KakaoParser'
import { apiFetch } from '@/lib/api'
import { uuid, today, splitDateTime, toDateTimeStr } from '@/lib/utils'

interface Props {
  trade: Trade | null
  trades?: Trade[]
  accounts: Account[]
  defaultAccountId?: string
  defaultSymbol?: string
  defaultSymbolCode?: string
  onClose: () => void
  onSave: () => void
}

interface EntryRow {
  key: string
  date: string
  time: string
  price: string
  quantity: string
}

interface FormState {
  accountId: string
  symbol: string
  symbolCode: string
  comment: string
  targetPrice: string
  stopLossPrice: string
  buyEntries: EntryRow[]
  sellEntries: EntryRow[]
}

function newRow(): EntryRow {
  return { key: uuid(), date: today(), time: '', price: '', quantity: '' }
}

function toEntry(e: { date: string; price: number; quantity: number }): EntryRow {
  const { date, time } = splitDateTime(e.date)
  return { key: uuid(), date, time, price: e.price.toString(), quantity: e.quantity.toString() }
}

const inputCls = 'border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-500 mb-0.5 block'

interface EntrySectionProps {
  type: 'buyEntries' | 'sellEntries'
  label: string
  required?: boolean
  entries: EntryRow[]
  onUpdate: (type: 'buyEntries' | 'sellEntries', key: string, field: keyof EntryRow, value: string) => void
  onAdd: (type: 'buyEntries' | 'sellEntries') => void
  onRemove: (type: 'buyEntries' | 'sellEntries', key: string) => void
}

function EntrySection({ type, label, required, entries, onUpdate, onAdd, onRemove }: EntrySectionProps) {
  return (
    <fieldset className="border rounded-lg p-3 space-y-2">
      <legend className={`text-xs font-medium px-1 ${required ? 'text-gray-600' : 'text-gray-400'}`}>
        {label}{required ? ' *' : ' (선택)'}
      </legend>
      {entries.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-1">내역 없음</p>
      )}
      {entries.map((row, idx) => (
        <div key={row.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div>
            {idx === 0 && <label className={labelCls}>날짜</label>}
            <input type="date" value={row.date} onChange={e => onUpdate(type, row.key, 'date', e.target.value)} className={inputCls} />
          </div>
          <div>
            {idx === 0 && <label className={labelCls}>단가 (원)</label>}
            <input type="text" inputMode="numeric" value={row.price} onChange={e => onUpdate(type, row.key, 'price', e.target.value.replace(/,/g, ''))} className={inputCls} placeholder="75000" />
          </div>
          <div>
            {idx === 0 && <label className={labelCls}>수량</label>}
            <input type="text" inputMode="numeric" value={row.quantity} onChange={e => onUpdate(type, row.key, 'quantity', e.target.value.replace(/,/g, ''))} className={inputCls} placeholder="100" />
          </div>
          <button
            type="button"
            onClick={() => onRemove(type, row.key)}
            disabled={required && entries.length === 1}
            className="text-red-400 hover:text-red-600 disabled:text-gray-200 pb-1 text-lg leading-none"
          >×</button>
        </div>
      ))}
      <button type="button" onClick={() => onAdd(type)} className="text-xs text-blue-500 hover:text-blue-700 mt-1">
        + {type === 'buyEntries' ? '매수' : '매도'} 추가
      </button>
    </fieldset>
  )
}

export default function TradeModal({ trade, trades, accounts, defaultAccountId, defaultSymbol, defaultSymbolCode, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'direct' | 'kakao'>('direct')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mergeTarget, setMergeTarget] = useState<Trade | null>(null)

  const [form, setForm] = useState<FormState>({
    accountId: trade?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
    symbol: trade?.symbol ?? defaultSymbol ?? '',
    symbolCode: trade?.symbolCode ?? defaultSymbolCode ?? '',
    comment: trade?.comment ?? '',
    targetPrice: trade?.targetPrice ? trade.targetPrice.toString() : '',
    stopLossPrice: trade?.stopLossPrice ? trade.stopLossPrice.toString() : '',
    buyEntries: trade ? trade.buyEntries.map(toEntry) : [],
    sellEntries: trade ? trade.sellEntries.map(toEntry) : [],
  })

  const existingHolding = !trade && !mergeTarget && trades
    ? trades.find(t => t.accountId === form.accountId && t.symbol === form.symbol.trim() && !t.isCompleted) ?? null
    : null

  function mergeIntoExisting() {
    if (!existingHolding) return
    setForm(f => ({
      ...f,
      symbolCode: existingHolding.symbolCode ?? f.symbolCode,
      comment: existingHolding.comment ?? f.comment,
      buyEntries: [...existingHolding.buyEntries.map(toEntry), newRow()],
      sellEntries: existingHolding.sellEntries.map(toEntry),
    }))
    setMergeTarget(existingHolding)
  }

  function setField(key: keyof Omit<FormState, 'buyEntries' | 'sellEntries'>, value: string) {
    if (key === 'accountId' || key === 'symbol') setMergeTarget(null)
    setForm(f => ({ ...f, [key]: value }))
  }

  function updateEntry(type: 'buyEntries' | 'sellEntries', rowKey: string, field: keyof EntryRow, value: string) {
    setForm(f => ({
      ...f,
      [type]: f[type].map(r => r.key === rowKey ? { ...r, [field]: value } : r),
    }))
  }

  function addEntry(type: 'buyEntries' | 'sellEntries') {
    setForm(f => ({ ...f, [type]: [...f[type], newRow()] }))
  }

  function removeEntry(type: 'buyEntries' | 'sellEntries', rowKey: string) {
    setForm(f => ({ ...f, [type]: f[type].filter(r => r.key !== rowKey) }))
  }

  function handleParsed(parsed: ParsedTrade) {
    const row: EntryRow = {
      key: uuid(),
      date: today(),
      time: parsed.time ?? '',
      price: parsed.price.toString(),
      quantity: parsed.quantity.toString(),
    }
    setForm(f => {
      const next = { ...f, symbol: parsed.symbol, symbolCode: parsed.symbolCode ?? f.symbolCode }
      if (parsed.type === '매수') next.buyEntries = [...f.buyEntries, row]
      else next.sellEntries = [...f.sellEntries, row]
      if (parsed.accountNumber) {
        const matched = accounts.find(a => a.accountNumber.includes(parsed.accountNumber!.replace(/\*/g, '').slice(0, 4)))
        if (matched) next.accountId = matched.id
      }
      return next
    })
    setTab('direct')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.accountId || !form.symbol) {
      setError('계좌와 종목명은 필수입니다.')
      return
    }
    const validBuy = form.buyEntries.filter(r => r.date && r.price && r.quantity)
    const validSell = form.sellEntries.filter(r => r.date && r.price && r.quantity)
    if (validBuy.length === 0 && validSell.length === 0) {
      setError('매수 또는 매도 내역을 하나 이상 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        accountId: form.accountId,
        symbol: form.symbol.trim(),
        symbolCode: form.symbolCode.trim() || null,
        comment: form.comment.trim() || null,
        targetPrice: form.targetPrice ? Number(form.targetPrice.replace(/,/g, '')) : null,
        stopLossPrice: form.stopLossPrice ? Number(form.stopLossPrice.replace(/,/g, '')) : null,
        buyEntries: validBuy.map(r => ({
          date: toDateTimeStr(r.date, r.time),
          price: Number(r.price.replace(/,/g, '')),
          quantity: Number(r.quantity.replace(/,/g, '')),
        })),
        sellEntries: validSell.map(r => ({
          date: toDateTimeStr(r.date, r.time),
          price: Number(r.price.replace(/,/g, '')),
          quantity: Number(r.quantity.replace(/,/g, '')),
        })),
      }
      const url = trade ? `/api/trades/${trade.id}` : mergeTarget ? `/api/trades/${mergeTarget.id}` : '/api/trades'
      const method = (trade || mergeTarget) ? 'PATCH' : 'POST'
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        let msg = '저장 실패'
        try { const d = await res.json(); msg = d.error ?? msg } catch {}
        setError(msg)
        return
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-semibold">{trade ? '거래 수정' : mergeTarget ? `${mergeTarget.symbol} 포지션에 추가` : '새 거래 입력'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex border-b">
          {(['direct', 'kakao'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm ${tab === t ? 'border-b-2 border-blue-500 text-blue-600 font-medium' : 'text-gray-400'}`}
            >
              {t === 'direct' ? '직접 입력' : '카톡 붙여넣기'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'kakao' && <KakaoParser onParsed={handleParsed} />}

          {tab === 'direct' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {existingHolding && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-700">
                    이 계좌에 <span className="font-semibold">{existingHolding.symbol}</span> 보유중 포지션이 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={mergeIntoExisting}
                    className="text-xs px-2.5 py-1.5 bg-amber-500 text-white rounded hover:bg-amber-600 whitespace-nowrap shrink-0"
                  >
                    기존에 추가
                  </button>
                </div>
              )}
              {mergeTarget && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  기존 포지션에 추가 중 — 새 매수/매도 행을 입력 후 저장하세요.
                  <button type="button" onClick={() => { setMergeTarget(null); setForm(f => ({ ...f, buyEntries: [], sellEntries: [] })) }} className="ml-2 underline text-blue-500">취소</button>
                </div>
              )}
              <div>
                <label className={labelCls}>계좌 *</label>
                <select value={form.accountId} onChange={e => setField('accountId', e.target.value)} className={inputCls}>
                  <option value="">계좌 선택</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nickname || `${a.broker} ${a.accountNumber}`}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>종목명 *</label>
                  <input value={form.symbol} onChange={e => setField('symbol', e.target.value)} className={inputCls} placeholder="삼성전자" />
                </div>
                <div>
                  <label className={labelCls}>종목코드</label>
                  <input value={form.symbolCode} onChange={e => setField('symbolCode', e.target.value)} className={inputCls} placeholder="005930" />
                </div>
              </div>

              <EntrySection type="sellEntries" label="매도 내역" entries={form.sellEntries} onUpdate={updateEntry} onAdd={addEntry} onRemove={removeEntry} />
              <EntrySection type="buyEntries" label="매수 내역" entries={form.buyEntries} onUpdate={updateEntry} onAdd={addEntry} onRemove={removeEntry} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>목표가</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.targetPrice}
                    onChange={e => setField('targetPrice', e.target.value.replace(/,/g, ''))}
                    className={inputCls}
                    placeholder="매도 목표가"
                  />
                </div>
                <div>
                  <label className={labelCls}>손절가</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.stopLossPrice}
                    onChange={e => setField('stopLossPrice', e.target.value.replace(/,/g, ''))}
                    className={inputCls}
                    placeholder="손절 가격"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>코멘트</label>
                <textarea
                  value={form.comment}
                  onChange={e => setField('comment', e.target.value)}
                  className={`${inputCls} h-20 resize-none`}
                  placeholder="매매 이유, 전략 등..."
                  maxLength={500}
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded text-gray-500 hover:bg-gray-50">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
