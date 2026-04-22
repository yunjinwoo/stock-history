'use client'

import { useState } from 'react'
import type { Account } from '@/lib/types'
import AccountMemoEditor from './AccountMemoEditor'
import { apiFetch } from '@/lib/api'

interface Props {
  accounts: Account[]
  onRefresh: () => void
}

export default function AccountList({ accounts, onRefresh }: Props) {
  const [list, setList] = useState<Account[]>(accounts)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ broker: '', accountNumber: '', nickname: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateLocal(updated: Account) {
    setList(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.broker || !form.accountNumber) { setError('증권사명과 계좌번호는 필수입니다.'); return }
    setSaving(true)
    const res = await apiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setAdding(false)
      setForm({ broker: '', accountNumber: '', nickname: '' })
      setError('')
      onRefresh()
    } else {
      const d = await res.json()
      setError(d.error ?? '추가 실패')
    }
    setSaving(false)
  }

  async function handleDelete(account: Account) {
    if (!confirm(`"${account.broker} ${account.accountNumber}" 계좌를 삭제하시겠습니까?`)) return
    const res = await apiFetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
    if (res.ok) {
      onRefresh()
    } else {
      const d = await res.json()
      alert(d.error ?? '삭제 실패')
    }
  }

  const inputCls = 'border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">계좌 목록</h2>
        <button onClick={() => setAdding(true)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
          + 계좌 추가
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">새 계좌</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">증권사 *</label>
              <input value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))} className={inputCls} placeholder="한국투자증권" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-0.5">계좌번호 *</label>
              <input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} className={inputCls} placeholder="44****16-01" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-0.5">별명</label>
              <input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} className={inputCls} placeholder="메인 계좌" />
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded disabled:opacity-50">
              {saving ? '추가 중...' : '추가'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} className="text-sm border px-4 py-1.5 rounded text-gray-500">취소</button>
          </div>
        </form>
      )}

      {list.length === 0 && !adding && (
        <p className="text-center text-gray-400 py-8">계좌가 없습니다</p>
      )}

      {list.map(account => (
        <div key={account.id} className="bg-white border rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-medium">{account.broker}</span>
              <span className="text-gray-400 text-sm ml-2">{account.accountNumber}</span>
              {account.nickname && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{account.nickname}</span>}
            </div>
            <button onClick={() => handleDelete(account)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
          </div>
          <AccountMemoEditor account={account} onUpdated={updateLocal} />
        </div>
      ))}
    </div>
  )
}
