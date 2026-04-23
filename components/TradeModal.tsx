'use client'

import { useState } from 'react'
import type { Trade, Account } from '@/lib/types'
import type { ParsedTrade } from '@/lib/kakaoParser'
import KakaoParser from './KakaoParser'
import { apiFetch } from '@/lib/api'

interface Props {
  trade: Trade | null
  accounts: Account[]
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
  buyEntries: EntryRow[]
  sellEntries: EntryRow[]
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function newRow(): EntryRow {
  return { key: crypto.randomUUID(), date: today(), time: '', price: '', quantity: '' }
}

function splitDateTime(dt: string): { date: string; time: string } {
  const [date, timePart] = dt.split('T')
  return { date: date ?? '', time: timePart ? timePart.slice(0, 5) : '' }
}

function toEntry(e: { date: string; price: number; quantity: number }): EntryRow {
  const { date, time } = splitDateTime(e.date)
  return { key: crypto.randomUUID(), date, time, price: e.price.toString(), quantity: e.quantity.toString() }
}

function toDateTimeStr(date: string, time: string) {
  return time ? `${date}T${time}:00` : `${date}T00:00:00`
}

export default function TradeModal({ trade, accounts, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'direct' | 'kakao'>('direct')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormState>({
    accountId: trade?.accountId ?? accounts[0]?.id ?? '',
    symbol: trade?.symbol ?? '',
    symbolCode: trade?.symbolCode ?? '',
    comment: trade?.comment ?? '',
    buyEntries: trade ? trade.buyEntries.map(toEntry) : [newRow()],
    sellEntries: trade ? trade.sellEntries.map(toEntry) : [],
  })

  function setField(key: keyof Omit<FormState, 'buyEntries' | 'sellEntries'>, value: string) {
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
      key: crypto.randomUUID(),
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
    if (!form.accountId || !form.symbol || form.buyEntries.length === 0) {
      setError('계좌, 종목명, 매수 내역은 필수입니다.')
      return
    }
    const invalidBuy = form.buyEntries.find(r => !r.date || !r.price || !r.quantity)
    if (invalidBuy) { setError('매수 내역의 날짜·단가·수량을 모두 입력해주세요.'); return }
    const invalidSell = form.sellEntries.find(r => !r.date || !r.price || !r.quantity)
    if (invalidSell) { setError('매도 내역의 날짜·단가·수량을 모두 입력해주세요.'); return }

    setSaving(true)
    try {
      const payload = {
        accountId: form.accountId,
        symbol: form.symbol.trim(),
        symbolCode: form.symbolCode.trim() || null,
        comment: form.comment.trim() || null,
        buyEntries: form.buyEntries.map(r => ({
          date: toDateTimeStr(r.date, r.time),
          price: Number(r.price),
          quantity: Number(r.quantity),
        })),
        sellEntries: form.sellEntries.map(r => ({
          date: toDateTimeStr(r.date, r.time),
          price: Number(r.price),
          quantity: Number(r.quantity),
        })),
      }
      const url = trade ? `/api/trades/${trade.id}` : '/api/trades'
      const method = trade ? 'PATCH' : 'POST'
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? '저장 실패'); return }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400'
  const labelCls = 'text-xs text-gray-500 mb-0.5 block'

  function EntrySection({ type, label, required }: { type: 'buyEntries' | 'sellEntries'; label: string; required?: boolean }) {
    const entries = form[type]
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
              <input type="date" value={row.date} onChange={e => updateEntry(type, row.key, 'date', e.target.value)} className={inputCls} />
            </div>
            <div>
              {idx === 0 && <label className={labelCls}>단가 (원)</label>}
              <input type="number" value={row.price} onChange={e => updateEntry(type, row.key, 'price', e.target.value)} className={inputCls} placeholder="75000" min="1" />
            </div>
            <div>
              {idx === 0 && <label className={labelCls}>수량</label>}
              <input type="number" value={row.quantity} onChange={e => updateEntry(type, row.key, 'quantity', e.target.value)} className={inputCls} placeholder="100" min="1" />
            </div>
            <button
              type="button"
              onClick={() => removeEntry(type, row.key)}
              disabled={required && entries.length === 1}
              className="text-red-400 hover:text-red-600 disabled:text-gray-200 pb-1 text-lg leading-none"
            >×</button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => addEntry(type)}
          className="text-xs text-blue-500 hover:text-blue-700 mt-1"
        >
          + {type === 'buyEntries' ? '매수' : '매도'} 추가
        </button>
      </fieldset>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h2 className="font-semibold">{trade ? '거래 수정' : '새 거래 입력'}</h2>
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

              <EntrySection type="buyEntries" label="매수 내역" required />
              <EntrySection type="sellEntries" label="매도 내역" />

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
