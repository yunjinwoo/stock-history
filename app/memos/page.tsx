'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface Memo {
  id: string
  content: string
  showOnMain: boolean
  showOnCoin: boolean
  createdAt: string
}

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [newContent, setNewContent] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await apiFetch('/api/memos').then(r => r.json())
    if (Array.isArray(data)) setMemos(data)
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newContent.trim()) return
    setSaving(true)
    await apiFetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    })
    setNewContent('')
    setSaving(false)
    load()
  }

  async function handleToggle(memo: Memo, field: 'showOnMain' | 'showOnCoin') {
    await apiFetch(`/api/memos/${memo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !memo[field] }),
    })
    load()
  }

  async function handleEdit(memo: Memo) {
    if (!editContent.trim()) return
    await apiFetch(`/api/memos/${memo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    })
    setEditId(null)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('메모를 삭제하시겠습니까?')) return
    await apiFetch(`/api/memos/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">메모 관리</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">← 돌아가기</Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 새 메모 추가 */}
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">새 메모</p>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="잊지 말아야 할 것을 입력하세요..."
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 h-20 resize-none"
            maxLength={200}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{newContent.length}/200</span>
            <button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>

        {/* 메모 목록 */}
        {memos.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">메모가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {memos.map(memo => (
              <div key={memo.id} className="bg-white rounded-lg border px-4 py-3">
                {editId === memo.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 h-20 resize-none"
                      maxLength={200}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditId(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1 border rounded">취소</button>
                      <button onClick={() => handleEdit(memo)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">저장</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 text-sm text-gray-700 whitespace-pre-wrap">{memo.content}</div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(memo, 'showOnMain')}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          memo.showOnMain
                            ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                            : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        {memo.showOnMain ? '주식 📌' : '주식 숨김'}
                      </button>
                      <button
                        onClick={() => handleToggle(memo, 'showOnCoin')}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          memo.showOnCoin
                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        {memo.showOnCoin ? '코인 📌' : '코인 숨김'}
                      </button>
                      <button
                        onClick={() => { setEditId(memo.id); setEditContent(memo.content) }}
                        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-0.5 border rounded"
                      >수정</button>
                      <button
                        onClick={() => handleDelete(memo.id)}
                        className="text-xs text-red-300 hover:text-red-500 px-2 py-0.5 border border-red-100 rounded"
                      >삭제</button>
                    </div>
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
