'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { MemoImage } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import MemoImageZone from '@/components/MemoImageZone'
import MemoCalendar, { type DateMode } from '@/components/MemoCalendar'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const MDPreview = dynamic(() => import('@uiw/react-md-editor').then(m => m.default.Markdown), { ssr: false })

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
  symbol: string | null
  alertDate: string | null
  images: MemoImage[]
  createdAt: string
  updatedAt: string
}

function stripMarkdown(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim()
}

function CategoryPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-gray-400 mr-1">분류</span>
      {CATEGORIES.map(c => (
        <button key={c} type="button" onClick={() => onChange(value === c ? null : c)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${value === c ? CATEGORY_COLORS[c] : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'}`}>
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
        <button key={n} type="button" onClick={() => onChange(value === n ? null : n)}
          className={`w-7 h-7 text-xs rounded transition-colors ${value === n ? 'bg-yellow-400 text-white font-semibold' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {n}
        </button>
      ))}
      {value != null && <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-300 hover:text-gray-500 ml-1">초기화</button>}
    </div>
  )
}

function AlertDatePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">🔔 알림</span>
      <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)}
        className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400" />
      {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-300 hover:text-gray-500">초기화</button>}
    </div>
  )
}

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [imagesMap, setImagesMap] = useState<Record<string, MemoImage[]>>({})
  const [saving, setSaving] = useState(false)

  // 모달 상태
  const [modalMode, setModalMode] = useState<'closed' | 'add' | 'view' | 'edit'>('closed')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 폼 상태
  const [formContent, setFormContent] = useState('')
  const [formRating, setFormRating] = useState<number | null>(null)
  const [formCategory, setFormCategory] = useState<string | null>(null)
  const [formAlertDate, setFormAlertDate] = useState<string | null>(null)
  const [formCreatedAt, setFormCreatedAt] = useState<string>('')

  // 열람 고정
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [pinnedHeight, setPinnedHeight] = useState(280)
  const pinnedDragRef = useRef<{ startY: number; startH: number } | null>(null)

  function togglePin(id: string) {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function startPinnedResize(e: React.MouseEvent) {
    e.preventDefault()
    pinnedDragRef.current = { startY: e.clientY, startH: pinnedHeight }
    function onMove(ev: MouseEvent) {
      if (!pinnedDragRef.current) return
      const delta = ev.clientY - pinnedDragRef.current.startY
      setPinnedHeight(Math.max(120, Math.min(700, pinnedDragRef.current.startH + delta)))
    }
    function onUp() {
      pinnedDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startPinnedResizeTouch(e: React.TouchEvent) {
    const startY = e.touches[0].clientY
    const startH = pinnedHeight
    function onMove(ev: TouchEvent) {
      const delta = ev.touches[0].clientY - startY
      setPinnedHeight(Math.max(120, Math.min(700, startH + delta)))
    }
    function onEnd() {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
  }

  // 필터·정렬 상태
  const [sortOption, setSortOption] = useState<'createdAt_desc' | 'createdAt_asc' | 'updatedAt_desc' | 'rating_desc' | 'alertDate_asc'>('createdAt_desc')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [symbolFilter, setSymbolFilter] = useState<string | null>(null)
  const [alertFilter, setAlertFilter] = useState(false)
  const [pinFilter, setPinFilter] = useState<'stock' | 'coin' | null>(null)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [dateFilterMode, setDateFilterMode] = useState<DateMode>('createdAt')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')

  const today = new Date().toISOString().slice(0, 10)
  const selectedMemo = memos.find(m => m.id === selectedId) ?? null

  async function load() {
    const data = await apiFetch('/api/memos').then(r => r.json())
    if (Array.isArray(data)) setMemos(data)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setFormContent(''); setFormRating(null); setFormCategory(null)
    setFormAlertDate(null); setFormCreatedAt(''); setSelectedId(null)
    setModalMode('add')
  }

  function openView(memo: Memo) {
    setSelectedId(memo.id)
    setModalMode('view')
  }

  function openEdit(memo: Memo) {
    setSelectedId(memo.id)
    setFormContent(memo.content); setFormRating(memo.rating)
    setFormCategory(memo.category); setFormAlertDate(memo.alertDate)
    setFormCreatedAt(memo.createdAt.slice(0, 10))
    setModalMode('edit')
  }

  function closeModal() { setModalMode('closed'); setSelectedId(null) }

  async function handleAdd() {
    if (!formContent.trim()) return
    setSaving(true)
    await apiFetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: formContent, rating: formRating, category: formCategory, alertDate: formAlertDate }),
    })
    setSaving(false)
    await load()
    closeModal()
  }

  async function handleToggle(memo: Memo, field: 'showOnMain' | 'showOnCoin') {
    await apiFetch(`/api/memos/${memo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !memo[field] }),
    })
    load()
  }

  async function handleEdit() {
    if (!selectedMemo || !formContent.trim()) return
    await apiFetch(`/api/memos/${selectedMemo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: formContent, rating: formRating, category: formCategory, alertDate: formAlertDate, createdAt: formCreatedAt || undefined }),
    })
    setModalMode('view')
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('메모를 삭제하시겠습니까?')) return
    await apiFetch(`/api/memos/${id}`, { method: 'DELETE' })
    closeModal()
    load()
  }

  function getImages(memo: Memo): MemoImage[] { return imagesMap[memo.id] ?? memo.images }
  function updateImages(memoId: string, images: MemoImage[]) {
    setImagesMap(prev => ({ ...prev, [memoId]: images }))
  }

  const symbolsWithMemos = useMemo(() => {
    const set = new Set<string>()
    memos.forEach(m => { if (m.symbol) set.add(m.symbol) })
    return Array.from(set).sort()
  }, [memos])

  const alertCount = useMemo(() => memos.filter(m => m.alertDate).length, [memos])
  const stockPinCount = useMemo(() => memos.filter(m => m.showOnMain).length, [memos])
  const coinPinCount = useMemo(() => memos.filter(m => m.showOnCoin).length, [memos])

  const filtered = useMemo(() => {
    const list = memos.filter(m => {
      if (categoryFilter && m.category !== categoryFilter) return false
      if (symbolFilter && m.symbol !== symbolFilter) return false
      if (alertFilter && !m.alertDate) return false
      if (pinFilter === 'stock' && !m.showOnMain) return false
      if (pinFilter === 'coin' && !m.showOnCoin) return false
      if (dateFilter) {
        const field = dateFilterMode === 'alertDate' ? m.alertDate : m.createdAt
        if (!field || field.slice(0, 10) !== dateFilter) return false
      }
      return true
    })
    return list.sort((a, b) => {
      switch (sortOption) {
        case 'createdAt_asc':  return a.createdAt.localeCompare(b.createdAt)
        case 'updatedAt_desc': return b.updatedAt.localeCompare(a.updatedAt)
        case 'rating_desc':    return (b.rating ?? 0) - (a.rating ?? 0)
        case 'alertDate_asc':  return (a.alertDate ?? '9999').localeCompare(b.alertDate ?? '9999')
        default:               return b.createdAt.localeCompare(a.createdAt)
      }
    })
  }, [memos, categoryFilter, symbolFilter, alertFilter, pinFilter, dateFilter, dateFilterMode, sortOption])

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold">메모 관리</h1>
        <div className="flex items-center gap-2">
          <div className="flex border rounded overflow-hidden">
            <button onClick={() => { setViewMode('list'); setDateFilter(null) }}
              className={`text-xs px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>≡</button>
            <button onClick={() => setViewMode('calendar')}
              className={`text-xs px-2.5 py-1.5 ${viewMode === 'calendar' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}>📅</button>
          </div>
          <button onClick={openAdd} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700">
            + 새 메모
          </button>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded border">← 돌아가기</Link>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* 달력 */}
        {viewMode === 'calendar' && (
          <MemoCalendar
            memos={memos}
            selectedDate={dateFilter}
            onSelectDate={(date, mode) => { setDateFilter(date); setDateFilterMode(mode) }}
          />
        )}

        {/* 열람 영역 */}
        {pinnedIds.length > 0 && (
          <div>
            <div className="border rounded-lg bg-white overflow-hidden flex flex-col" style={{ height: pinnedHeight }}>
              <div className="flex-none flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                <span className="text-xs font-medium text-gray-600">
                  열람 중 <span className="text-gray-400">{pinnedIds.length}개</span>
                </span>
                <button onClick={() => setPinnedIds([])} className="text-xs text-gray-400 hover:text-gray-600">전체 닫기</button>
              </div>
              <div className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden p-3">
                {pinnedIds.map(id => {
                  const memo = memos.find(m => m.id === id)
                  if (!memo) return null
                  return (
                    <div key={id} className="flex-none w-[36rem] border rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {memo.category && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[memo.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {memo.category}
                            </span>
                          )}
                          {memo.rating != null && <span className="text-xs text-yellow-500">★ {memo.rating}</span>}
                        </div>
                        <button onClick={() => togglePin(id)} className="flex-none text-gray-300 hover:text-gray-500 text-base leading-none">✕</button>
                      </div>
                      <div data-color-mode="light" className="flex-1 overflow-y-auto">
                        <MDPreview source={memo.content} style={{ background: 'transparent', fontSize: '0.8rem' }} />
                      </div>
                      <p className="text-xs text-gray-300 border-t pt-1.5 flex-none">{memo.createdAt.slice(0, 10)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* 드래그 핸들 */}
            <div
              onMouseDown={startPinnedResize}
              onTouchStart={startPinnedResizeTouch}
              className="h-3 flex items-center justify-center cursor-row-resize group select-none"
            >
              <div className="w-16 h-1 rounded-full bg-gray-200 group-hover:bg-gray-400 transition-colors" />
            </div>
          </div>
        )}

        {/* 날짜 필터 표시 */}
        {dateFilter && (
          <div className="flex items-center gap-2 px-1">
            <span className={`text-xs font-medium ${dateFilterMode === 'alertDate' ? 'text-orange-600' : 'text-blue-600'}`}>
              {dateFilterMode === 'alertDate' ? '🔔' : '📅'} {dateFilter}
            </span>
            <span className="text-xs text-gray-300">{dateFilterMode === 'alertDate' ? '알림일' : '작성일'}</span>
            <button onClick={() => setDateFilter(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ 해제</button>
          </div>
        )}

        {/* 필터 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value as typeof sortOption)}
              className="text-xs border rounded px-2 py-1.5 bg-white text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 mr-2"
            >
              <option value="createdAt_desc">작성일 최신순</option>
              <option value="createdAt_asc">작성일 오래된순</option>
              <option value="updatedAt_desc">수정일 최신순</option>
              <option value="rating_desc">평점 높은순</option>
              <option value="alertDate_asc">알림일 빠른순</option>
            </select>
            <button onClick={() => setCategoryFilter(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${categoryFilter === null ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-400 border-gray-200'}`}>
              전체 <span className="opacity-60">{memos.length}</span>
            </button>
            {CATEGORIES.map(c => {
              const count = memos.filter(m => m.category === c).length
              if (count === 0) return null
              return (
                <button key={c} onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${categoryFilter === c ? CATEGORY_COLORS[c] : 'bg-white text-gray-400 border-gray-200'}`}>
                  {c} <span className="opacity-60">{count}</span>
                </button>
              )
            })}
            {alertCount > 0 && (
              <button onClick={() => setAlertFilter(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${alertFilter ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-white text-gray-400 border-gray-200'}`}>
                🔔 알림 <span className="opacity-60">{alertCount}</span>
              </button>
            )}
            {stockPinCount > 0 && (
              <button onClick={() => setPinFilter(pinFilter === 'stock' ? null : 'stock')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${pinFilter === 'stock' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-white text-gray-400 border-gray-200'}`}>
                주식 📌 <span className="opacity-60">{stockPinCount}</span>
              </button>
            )}
            {coinPinCount > 0 && (
              <button onClick={() => setPinFilter(pinFilter === 'coin' ? null : 'coin')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${pinFilter === 'coin' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-gray-400 border-gray-200'}`}>
                코인 📌 <span className="opacity-60">{coinPinCount}</span>
              </button>
            )}
            {symbolsWithMemos.map(s => (
              <button key={s} onClick={() => setSymbolFilter(symbolFilter === s ? null : s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${symbolFilter === s ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white text-gray-400 border-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 그리드 */}
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">메모가 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(memo => {
              const isAlertActive = memo.alertDate != null && memo.alertDate <= today
              const preview = stripMarkdown(memo.content)
              return (
                <div
                  key={memo.id}
                  onClick={() => openView(memo)}
                  className="bg-white rounded-lg border p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all flex flex-col gap-2 min-h-[120px]"
                >
                  {/* 상단: 배지 행 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {memo.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[memo.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {memo.category}
                      </span>
                    )}
                    {memo.symbol && (
                      <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded">{memo.symbol}</span>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                      {memo.rating != null && <span className="text-xs text-yellow-500">★ {memo.rating}</span>}
                      <button
                        onClick={e => { e.stopPropagation(); togglePin(memo.id) }}
                        title="열람 영역에 고정"
                        className={`text-sm leading-none transition-colors ${pinnedIds.includes(memo.id) ? 'text-blue-500' : 'text-gray-200 hover:text-gray-400'}`}
                      >📌</button>
                    </div>
                  </div>

                  {/* 내용 미리보기 */}
                  <p className="text-sm text-gray-700 flex-1 line-clamp-4 leading-relaxed">{preview}</p>

                  {/* 하단: 아이콘 + 날짜 */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-300 mt-auto pt-1 border-t">
                    {isAlertActive && <span className="text-orange-400">🔔</span>}
                    {memo.alertDate && !isAlertActive && <span>🔔</span>}
                    {memo.showOnMain && <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-1 py-0.5 rounded text-[10px]">주식</span>}
                    {memo.showOnCoin && <span className="bg-blue-50 text-blue-600 border border-blue-200 px-1 py-0.5 rounded text-[10px]">코인</span>}
                    <span className="ml-auto">{memo.createdAt.slice(0, 10)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 모달 */}
      {modalMode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl w-[92vw] max-w-3xl max-h-[88vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium text-gray-700">
                {modalMode === 'add' ? '새 메모' : modalMode === 'edit' ? '메모 수정' : (selectedMemo?.category ?? '메모')}
              </span>
              <div className="flex items-center gap-2">
                {modalMode === 'view' && selectedMemo && (
                  <>
                    <button onClick={() => openEdit(selectedMemo)} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border rounded">수정</button>
                    <button onClick={() => handleDelete(selectedMemo.id)} className="text-xs text-red-300 hover:text-red-500 px-2 py-1 border border-red-100 rounded">삭제</button>
                  </>
                )}
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1">✕</button>
              </div>
            </div>

            {/* 뷰 모드 */}
            {modalMode === 'view' && selectedMemo && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedMemo.symbol && <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">{selectedMemo.symbol}</span>}
                  {selectedMemo.category && <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[selectedMemo.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>{selectedMemo.category}</span>}
                  {selectedMemo.rating != null && <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">★ {selectedMemo.rating}</span>}
                  {selectedMemo.alertDate && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${selectedMemo.alertDate <= today ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      🔔 {selectedMemo.alertDate}
                    </span>
                  )}
                </div>
                <div data-color-mode="light">
                  <MDPreview source={selectedMemo.content} style={{ background: 'transparent', fontSize: '0.875rem' }} />
                </div>
                <div className="flex gap-3 text-xs text-gray-300">
                  <span>등록 {selectedMemo.createdAt.slice(0, 10)}</span>
                  {selectedMemo.updatedAt !== selectedMemo.createdAt && <span>수정 {selectedMemo.updatedAt.slice(0, 10)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(selectedMemo, 'showOnMain')}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selectedMemo.showOnMain ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-200 text-gray-400'}`}>
                    {selectedMemo.showOnMain ? '주식 📌' : '주식 숨김'}
                  </button>
                  <button onClick={() => handleToggle(selectedMemo, 'showOnCoin')}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${selectedMemo.showOnCoin ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-400'}`}>
                    {selectedMemo.showOnCoin ? '코인 📌' : '코인 숨김'}
                  </button>
                </div>
                <div className="border-t pt-3">
                  <MemoImageZone memoId={selectedMemo.id} images={getImages(selectedMemo)} onUpdate={imgs => updateImages(selectedMemo.id, imgs)} />
                </div>
              </div>
            )}

            {/* 추가 / 수정 모드 */}
            {(modalMode === 'add' || modalMode === 'edit') && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div data-color-mode="light">
                  <MDEditor value={formContent} onChange={v => setFormContent(v ?? '')} preview="edit" height={260} visibleDragbar={false} />
                </div>
                <CategoryPicker value={formCategory} onChange={setFormCategory} />
                <RatingPicker value={formRating} onChange={setFormRating} />
                <AlertDatePicker value={formAlertDate} onChange={setFormAlertDate} />
                {modalMode === 'edit' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">작성일</span>
                    <input type="date" value={formCreatedAt} onChange={e => setFormCreatedAt(e.target.value)}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={closeModal} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 border rounded">취소</button>
                  <button onClick={modalMode === 'add' ? handleAdd : handleEdit} disabled={saving || !formContent.trim()}
                    className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40">
                    {modalMode === 'add' ? '추가' : '저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
