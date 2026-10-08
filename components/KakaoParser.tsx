'use client'

import { useState } from 'react'
import { parseKakaoNotifications, matchAccountId, type ParsedTrade } from '@/lib/kakaoParser'
import type { Account } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { today, toDateTimeStr, formatKRW } from '@/lib/utils'

interface Props {
  onParsed: (result: ParsedTrade) => void
  accounts: Account[]
  onBatchSaved: () => void
}

interface BatchRow {
  key: number
  parsed: ParsedTrade
  accountId: string
  date: string
  checked: boolean
}

export default function KakaoParser({ onParsed, accounts, onBatchSaved }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<BatchRow[]>([])
  const [saving, setSaving] = useState(false)

  function handleParse() {
    const results = parseKakaoNotifications(text)
    if (results.length === 0) {
      setError('인식하지 못한 형식입니다. 직접 입력 탭에서 수동으로 입력해주세요.')
      return
    }
    setError('')
    if (results.length === 1) {
      setText('')
      onParsed(results[0])
      return
    }
    // 계좌를 못 찾으면 계좌가 하나뿐일 때만 기본값으로 채우고, 아니면 직접 고르게 비워둠
    const fallback = accounts.length === 1 ? accounts[0].id : ''
    setRows(results.map((parsed, i) => ({
      key: i,
      parsed,
      accountId: matchAccountId(accounts, parsed) ?? fallback,
      date: parsed.date ?? today(),
      checked: true,
    })))
  }

  function updateRow(key: number, patch: Partial<BatchRow>) {
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r))
  }

  async function handleBatchSave() {
    const selected = rows.filter(r => r.checked)
    if (selected.length === 0) return
    if (selected.some(r => !r.accountId)) {
      setError('계좌를 선택하지 않은 항목이 있습니다.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch('/api/trades/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map(r => ({
            accountId: r.accountId,
            symbol: r.parsed.symbol,
            symbolCode: r.parsed.symbolCode ?? null,
            type: r.parsed.type,
            date: toDateTimeStr(r.date, (r.parsed.time ?? '').padStart(r.parsed.time ? 5 : 0, '0')),
            price: r.parsed.price,
            quantity: r.parsed.quantity,
          })),
        }),
      })
      if (!res.ok) {
        let msg = '저장 실패'
        try { const d = await res.json(); msg = d.error ?? msg } catch {}
        setError(msg)
        return
      }
      setText('')
      setRows([])
      onBatchSaved()
    } finally {
      setSaving(false)
    }
  }

  if (rows.length > 0) {
    const checkedCount = rows.filter(r => r.checked).length
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{rows.length}건 인식됨</p>
          <button onClick={() => setRows([])} className="text-xs text-gray-400 hover:text-gray-600">← 다시 붙여넣기</button>
        </div>
        <p className="text-xs text-gray-400">같은 계좌에 보유중인 종목이면 기존 거래에 추가되고, 아니면 새 거래로 저장됩니다.</p>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.key} className={`border rounded-lg p-2.5 space-y-2 ${r.checked ? '' : 'opacity-40'}`}>
              <div className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={r.checked} onChange={e => updateRow(r.key, { checked: e.target.checked })} />
                <span className={`text-xs px-1.5 py-0.5 rounded ${r.parsed.type === '매수' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{r.parsed.type}</span>
                <span className="font-medium">{r.parsed.symbol}</span>
                <span className="text-gray-500 text-xs ml-auto whitespace-nowrap">
                  {formatKRW(r.parsed.price)} × {r.parsed.quantity.toLocaleString()}주
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                <select
                  value={r.accountId}
                  onChange={e => updateRow(r.key, { accountId: e.target.value })}
                  className="border rounded px-2 py-1 text-xs min-w-0"
                >
                  <option value="">계좌 선택</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nickname || `${a.broker} ${a.accountNumber}`}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={r.date}
                  onChange={e => updateRow(r.key, { date: e.target.value })}
                  className="border rounded px-2 py-1 text-xs"
                />
                <span className="text-xs text-gray-400 w-10 text-right">{r.parsed.time ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <button
          onClick={handleBatchSave}
          disabled={saving || checkedCount === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded"
        >
          {saving ? '저장 중...' : `${checkedCount}건 일괄 저장`}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">지원: 한국투자증권, KB증권, 키움증권, 미확인(083계열), 토스증권 거래내역 · 여러 건을 한 번에 붙여넣을 수 있어요</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="카카오톡 알림이나 토스 거래내역을 여기에 붙여넣기 하세요"
        className="w-full border rounded p-2 text-sm h-40 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        onClick={handleParse}
        disabled={!text.trim()}
        className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 text-sm font-medium px-4 py-1.5 rounded"
      >
        파싱하기
      </button>
    </div>
  )
}
