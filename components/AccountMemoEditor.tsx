'use client'

import { useState } from 'react'
import type { Account } from '@/lib/types'

interface Props {
  account: Account
  onUpdated: (updated: Account) => void
}

export default function AccountMemoEditor({ account, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [memo, setMemo] = useState(account.memo ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdated(updated)
      setEditing(false)
    }
    setSaving(false)
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="text-sm text-gray-500 flex-1 min-h-[1.5rem]">
          {account.memo || <span className="text-gray-300">메모 없음</span>}
        </p>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-400 hover:text-blue-600 shrink-0">편집</button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <textarea
        value={memo}
        onChange={e => setMemo(e.target.value)}
        className="w-full border rounded p-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="계좌 전략, 성격 등..."
        autoFocus
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={() => { setMemo(account.memo ?? ''); setEditing(false) }} className="text-xs border px-3 py-1 rounded text-gray-500 hover:bg-gray-50">
          취소
        </button>
        {account.memo && (
          <button onClick={() => { setMemo(''); }} className="text-xs text-red-400 hover:text-red-600 ml-auto">삭제</button>
        )}
      </div>
    </div>
  )
}
