'use client'

import { useState } from 'react'
import type { Strategy } from '@/lib/types'
import { apiFetch } from '@/lib/api'

interface Props {
  strategy?: Strategy | null
  onSaved: (s: Strategy) => void
  onCancel?: () => void
}

type FormState = Record<'name' | 'description' | 'targetPct' | 'stopLossPct' | 'plannedDays' | 'seedMoney' | 'feePct', string>

// 10일 스윙 복리 시뮬레이션 엑셀(v4) 기본값
const SWING_PRESET: FormState = {
  name: '10일 스윙',
  description: '1~3일 분할매수, 7~9일 분할매도',
  targetPct: '2.5',
  stopLossPct: '1.5',
  plannedDays: '10',
  seedMoney: '5000000',
  feePct: '0.15',
}

const str = (v: number | string | null | undefined) => v == null ? '' : String(v)
const inputCls = 'border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-500 mb-0.5 block'

export default function StrategyForm({ strategy, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({
    name: str(strategy?.name),
    description: str(strategy?.description),
    targetPct: str(strategy?.targetPct),
    stopLossPct: str(strategy?.stopLossPct),
    plannedDays: str(strategy?.plannedDays),
    seedMoney: str(strategy?.seedMoney),
    feePct: str(strategy?.feePct),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: k === 'name' || k === 'description' ? e.target.value : e.target.value.replace(/,/g, '') }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('전략 이름을 입력해주세요.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await apiFetch(strategy ? `/api/strategies/${strategy.id}` : '/api/strategies', {
        method: strategy ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? '저장 실패'); return }
      onSaved(d)
      if (!strategy) setForm({ name: '', description: '', targetPct: '', stopLossPct: '', plannedDays: '', seedMoney: '', feePct: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-700">{strategy ? '전략 수정' : '새 전략'}</h2>
        {!strategy && (
          <button type="button" onClick={() => setForm(SWING_PRESET)} className="text-xs text-blue-500 hover:text-blue-700">
            10일 스윙 예시로 채우기
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
        <div>
          <label className={labelCls}>이름 *</label>
          <input value={form.name} onChange={set('name')} className={inputCls} placeholder="10일 스윙" />
        </div>
        <div>
          <label className={labelCls}>설명</label>
          <input value={form.description} onChange={set('description')} className={inputCls} placeholder="진입·청산 규칙" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <label className={labelCls}>익절 목표 (%)</label>
          <input inputMode="decimal" value={form.targetPct} onChange={set('targetPct')} className={inputCls} placeholder="2.5" />
        </div>
        <div>
          <label className={labelCls}>손절 기준 (%)</label>
          <input inputMode="decimal" value={form.stopLossPct} onChange={set('stopLossPct')} className={inputCls} placeholder="1.5" />
        </div>
        <div>
          <label className={labelCls}>계획 보유일</label>
          <input inputMode="numeric" value={form.plannedDays} onChange={set('plannedDays')} className={inputCls} placeholder="10" />
        </div>
        <div>
          <label className={labelCls}>시작 금액 (원)</label>
          <input inputMode="numeric" value={form.seedMoney} onChange={set('seedMoney')} className={inputCls} placeholder="5000000" />
        </div>
        <div>
          <label className={labelCls}>수수료·세금 (%)</label>
          <input inputMode="decimal" value={form.feePct} onChange={set('feePct')} className={inputCls} placeholder="0.15" />
        </div>
      </div>
      <p className="text-xs text-gray-400">손절 기준은 양수로 적어요 (1.5 → -1.5%에서 손절). 비워 둔 항목은 이탈 판정과 계획 곡선에서 빠져요.</p>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border rounded text-gray-500 hover:bg-gray-50">취소</button>}
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '저장 중...' : strategy ? '저장' : '추가'}
        </button>
      </div>
    </form>
  )
}
