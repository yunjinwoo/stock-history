'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { MemoImage } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import MemoImageZone from '@/components/MemoImageZone'

const CATEGORIES = ['원칙', '전략', '시장', '종목', '일지', '기타'] as const

const CATEGORY_COLORS: Record<string, string> = {
  원칙: 'bg-red-50 text-red-600 border-red-200',
  전략: 'bg-purple-50 text-purple-600 border-purple-200',
  시장: 'bg-blue-50 text-blue-600 border-blue-200',
  종목: 'bg-green-50 text-green-600 border-green-200',
  일지: 'bg-orange-50 text-orange-600 border-orange-200',
  기타: 'bg-gray-100 text-gray-500 border-gray-200',
}

interface Memo {
  id: string
  content: string
  showOnMain: boolean
  showOnCoin: boolean
  rating: number | null
  category: string | null
  images: MemoImage[]
  createdAt: string
  updatedAt: string
}

function CategoryPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-gray-400 mr-1">분류</span>
      {CATEGORIES.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(value === c ? null : c)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            value === c ? CATEGORY_COLORS[c] : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function RatingPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-gray-400 mr-1">평점</span>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className={`w-7 h-7 text-xs rounded transition-colors ${
            value === n
              ? 'bg-yellow-400 text-white font-semibold'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {n}
        </button>
      ))}
      {value != null && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-300 hover:text-gray-500 ml-1">
          초기화
        </button>
      )}
    </div>
  )
}

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [newContent, setNewContent] = useState('')
  const [newRating, setNewRating] = useState<number | null>(null)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editRating, setEditRating] = useState<number | null>(null)
  const [editCategory, setEditCategory] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [imagesMap, setImagesMap] = useState<Record<string, MemoImage[]>>({})
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
      body: JSON.stringify({ content: newContent, rating: newRating, category: newCategory }),
    })
    setNewContent('')
    setNewRating(null)
    setNewCategory(null)
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
      body: JSON.stringify({ content: editContent, rating: editRating, category: editCategory }),
    })
    setEditId(null)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('메모를 삭제하시겠습니까?')) return
    await apiFetch(`/api/memos/${id}`, { method: 'DELETE' })
    load()
  }

  function getImages(memo: Memo): MemoImage[] {
    return imagesMap[memo.id] ?? memo.images
  }

  function updateImages(memoId: string, images: MemoImage[]) {
    setImagesMap(prev => ({ ...prev, [memoId]: images }))
  }

  const filtered = categoryFilter ? memos.filter(m => m.category === categoryFilter) : memos

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">메모 관리</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">← 돌아가기</Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 새 메모 추가 */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">새 메모</p>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="잊지 말아야 할 것을 입력하세요..."
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 h-36 resize-none"
          />
          <CategoryPicker value={newCategory} onChange={setNewCategory} />
          <RatingPicker value={newRating} onChange={setNewRating} />
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>

        {/* 분류 필터 */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              categoryFilter === null ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
            }`}
          >
            전체 <span className={`ml-0.5 ${categoryFilter === null ? 'text-white/70' : 'text-gray-400'}`}>{memos.length}</span>
          </button>
          {CATEGORIES.map(c => {
            const count = memos.filter(m => m.category === c).length
            if (count === 0) return null
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  categoryFilter === c ? CATEGORY_COLORS[c] : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {c} <span className="ml-0.5 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* 메모 목록 */}
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">메모가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(memo => (
              <div key={memo.id} className="bg-white rounded-lg border">
                <div className="px-4 py-3">
                  {editId === memo.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 h-20 resize-none"
                      />
                      <CategoryPicker value={editCategory} onChange={setEditCategory} />
                      <RatingPicker value={editRating} onChange={setEditRating} />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditId(null)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1 border rounded">취소</button>
                        <button onClick={() => handleEdit(memo)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {memo.category && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[memo.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {memo.category}
                            </span>
                          )}
                          {memo.rating != null && (
                            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">★ {memo.rating}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{memo.content}</p>
                        <div className="flex gap-3 mt-1.5">
                          <span className="text-xs text-gray-300">등록 {memo.createdAt.slice(0, 10)}</span>
                          {memo.updatedAt !== memo.createdAt && (
                            <span className="text-xs text-gray-300">수정 {memo.updatedAt.slice(0, 10)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleToggle(memo, 'showOnMain')}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            memo.showOnMain ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {memo.showOnMain ? '주식 📌' : '주식 숨김'}
                        </button>
                        <button
                          onClick={() => handleToggle(memo, 'showOnCoin')}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            memo.showOnCoin ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {memo.showOnCoin ? '코인 📌' : '코인 숨김'}
                        </button>
                        <button
                          onClick={() => { setEditId(memo.id); setEditContent(memo.content); setEditRating(memo.rating); setEditCategory(memo.category) }}
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

                {/* 이미지 영역 */}
                <div className="px-4 pb-3 border-t bg-gray-50 pt-3">
                  <MemoImageZone
                    memoId={memo.id}
                    images={getImages(memo)}
                    onUpdate={imgs => updateImages(memo.id, imgs)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
