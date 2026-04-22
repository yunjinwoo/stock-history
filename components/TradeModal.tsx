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

interface FormState {
  accountId: string
  symbol: string
  symbolCode: string
  buyDate: string
  buyTime: string
  buyPrice: string
  buyQuantity: string
  sellDate: string
  sellTime: string
  sellPrice: string
  sellQuantity: string
  comment: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toDateTimeStr(date: string, time: string) {
  return time ? `${date}T${time}:00` : `${date}T00:00:00`
}

function splitDateTime(dt?: string | null) {
  if (!dt) return { date: '', time: '' }
  const [date, timePart] = dt.split('T')
  return { date: date ?? '', time: timePart ? timePart.slice(0, 5) : '' }
}

export default function TradeModal({ trade, accounts, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'direct' | 'kakao'>('direct')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const buyDT = splitDateTime(trade?.buyDate)
  const sellDT = splitDateTime(trade?.sellDate)

  const [form, setForm] = useState<FormState>({
    accountId: trade?.accountId ?? accounts[0]?.id ?? '',
    symbol: trade?.symbol ?? '',
    symbolCode: trade?.symbolCode ?? '',
    buyDate: buyDT.date || today(),
    buyTime: buyDT.time,
    buyPrice: trade?.buyPrice?.toString() ?? '',
    buyQuantity: trade?.buyQuantity?.toString() ?? '',
    sellDate: sellDT.date,
    sellTime: sellDT.time,
    sellPrice: trade?.sellPrice?.toString() ?? '',
    sellQuantity: trade?.sellQuantity?.toString() ?? '',
    comment: trade?.comment ?? '',
  })

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleParsed(parsed: ParsedTrade) {
    const now = today()
    setForm(f => ({
      ...f,
      symbol: parsed.symbol,
      symbolCode: parsed.symbolCode ?? f.symbolCode,
      ...(parsed.type === '매수'
        ? { buyDate: now, buyTime: parsed.time ?? '', buyPrice: parsed.price.toString(), buyQuantity: parsed.quantity.toString() }
        : { sellDate: now, sellTime: parsed.time ?? '', sellPrice: parsed.price.toString(), sellQuantity: parsed.quantity.toString() }
      ),
    }))
    // 파싱 후 계좌 자동 매칭
    if (parsed.accountNumber) {
      const matched = accounts.find(a => a.accountNumber.includes(parsed.accountNumber!.replace(/\*/g, '').slice(0, 4)))
      if (matched) setForm(f => ({ ...f, accountId: matched.id }))
    }
    setTab('direct')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.accountId || !form.symbol || !form.buyDate || !form.buyPrice || !form.buyQuantity) {
      setError('계좌, 종목명, 매수 정보는 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        accountId: form.accountId,
        symbol: form.symbol.trim(),
        symbolCode: form.symbolCode.trim() || null,
        buyDate: toDateTimeStr(form.buyDate, form.buyTime),
        buyPrice: Number(form.buyPrice),
        buyQuantity: Number(form.buyQuantity),
        sellDate: form.sellDate ? toDateTimeStr(form.sellDate, form.sellTime) : null,
        sellPrice: form.sellPrice ? Number(form.sellPrice) : null,
        sellQuantity: form.sellQuantity ? Number(form.sellQuantity) : null,
        comment: form.comment.trim() || null,
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
                <select value={form.accountId} onChange={e => set('accountId', e.target.value)} className={inputCls}>
                  <option value="">계좌 선택</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nickname || `${a.broker} ${a.accountNumber}`}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>종목명 *</label>
                  <input value={form.symbol} onChange={e => set('symbol', e.target.value)} className={inputCls} placeholder="삼성전자" />
                </div>
                <div>
                  <label className={labelCls}>종목코드</label>
                  <input value={form.symbolCode} onChange={e => set('symbolCode', e.target.value)} className={inputCls} placeholder="005930" />
                </div>
              </div>

              <fieldset className="border rounded-lg p-3 space-y-3">
                <legend className="text-xs font-medium text-gray-600 px-1">매수 정보 *</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>날짜</label>
                    <input type="date" value={form.buyDate} onChange={e => set('buyDate', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>시간</label>
                    <input type="time" value={form.buyTime} onChange={e => set('buyTime', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>수량</label>
                    <input type="number" value={form.buyQuantity} onChange={e => set('buyQuantity', e.target.value)} className={inputCls} placeholder="100" min="1" />
                  </div>
                  <div>
                    <label className={labelCls}>단가 (원)</label>
                    <input type="number" value={form.buyPrice} onChange={e => set('buyPrice', e.target.value)} className={inputCls} placeholder="75000" min="1" />
                  </div>
                </div>
              </fieldset>

              <fieldset className="border rounded-lg p-3 space-y-3">
                <legend className="text-xs font-medium text-gray-400 px-1">매도 정보 (선택)</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>날짜</label>
                    <input type="date" value={form.sellDate} onChange={e => set('sellDate', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>시간</label>
                    <input type="time" value={form.sellTime} onChange={e => set('sellTime', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>수량</label>
                    <input type="number" value={form.sellQuantity} onChange={e => set('sellQuantity', e.target.value)} className={inputCls} placeholder="100" min="1" />
                  </div>
                  <div>
                    <label className={labelCls}>단가 (원)</label>
                    <input type="number" value={form.sellPrice} onChange={e => set('sellPrice', e.target.value)} className={inputCls} placeholder="82000" min="1" />
                  </div>
                </div>
              </fieldset>

              <div>
                <label className={labelCls}>코멘트</label>
                <textarea
                  value={form.comment}
                  onChange={e => set('comment', e.target.value)}
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
