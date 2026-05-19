'use client'

import { useState, useMemo } from 'react'

interface MemoItem {
  id: string
  createdAt: string
  alertDate: string | null
  category: string | null
}

export type DateMode = 'createdAt' | 'alertDate'

interface Props {
  memos: MemoItem[]
  selectedDate: string | null
  onSelectDate: (date: string | null, mode: DateMode) => void
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']

const CATEGORY_DOT: Record<string, string> = {
  원칙: 'bg-red-400',
  전략: 'bg-purple-400',
  시장: 'bg-blue-400',
  종목: 'bg-green-400',
  일지: 'bg-orange-400',
  기타: 'bg-gray-400',
}

export default function MemoCalendar({ memos, selectedDate, onSelectDate }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [dateMode, setDateMode] = useState<DateMode>('createdAt')

  function changeMode(mode: DateMode) {
    setDateMode(mode)
    onSelectDate(null, mode)
  }

  const byDate = useMemo(() => {
    const map: Record<string, MemoItem[]> = {}
    memos.forEach(m => {
      const raw = dateMode === 'alertDate' ? m.alertDate : m.createdAt
      if (!raw) return
      const date = raw.slice(0, 10)
      ;(map[date] ??= []).push(m)
    })
    return map
  }, [memos, dateMode])

  const recentMonths = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - (5 - i), 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`
      const count = Object.entries(byDate)
        .filter(([d]) => d.startsWith(prefix))
        .reduce((sum, [, items]) => sum + items.length, 0)
      return { year: y, month: m, label: `${m + 1}월`, count }
    })
  }, [byDate, year, month])

  const startDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  const todayKey = today.toISOString().slice(0, 10)

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    onSelectDate(null, dateMode)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    onSelectDate(null, dateMode)
  }

  return (
    <div className="space-y-3">
      {/* 최근 6개월 메모 건수 */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-6 divide-x">
          {recentMonths.map(m => {
            const isCurrent = m.year === year && m.month === month
            return (
              <button
                key={`${m.year}-${m.month}`}
                onClick={() => { setYear(m.year); setMonth(m.month); onSelectDate(null, dateMode) }}
                className={`px-2 py-3 text-center transition-colors hover:bg-gray-50 ${isCurrent ? 'bg-gray-50' : ''}`}
              >
                <p className={`text-xs mb-1 ${isCurrent ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{m.label}</p>
                {m.count === 0
                  ? <p className="text-xs text-gray-300">-</p>
                  : <p className="text-xs font-medium text-blue-500">{m.count}건</p>
                }
              </button>
            )
          })}
        </div>
      </div>

      {/* 월 네비게이션 + 날짜 기준 토글 */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-lg">‹</button>
        <span className="font-semibold">{year}년 {month + 1}월</span>
        <div className="flex items-center gap-2">
          <div className="flex border rounded overflow-hidden text-xs">
            <button
              onClick={() => changeMode('createdAt')}
              className={`px-2.5 py-1.5 transition-colors ${dateMode === 'createdAt' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >작성일</button>
            <button
              onClick={() => changeMode('alertDate')}
              className={`px-2.5 py-1.5 transition-colors ${dateMode === 'alertDate' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
            >🔔 알림일</button>
          </div>
          <button onClick={nextMonth} className="px-3 py-1.5 text-gray-400 hover:text-gray-700 text-lg">›</button>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {DOW_LABELS.map((d, i) => (
            <div key={d} className={`py-2 text-center text-xs font-medium ${i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : 'text-gray-500'}`}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x border-b last:border-b-0">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="min-h-[56px] bg-gray-50/50" />
              const key = dateKey(day)
              const dayMemos = byDate[key] ?? []
              const hasMemos = dayMemos.length > 0
              const isToday = key === todayKey
              const isSelected = key === selectedDate
              const isSun = di === 6
              const isSat = di === 5
              const categories = Array.from(new Set(dayMemos.map(m => m.category).filter(Boolean))) as string[]
              const isAlert = dateMode === 'alertDate'

              return (
                <div
                  key={di}
                  onClick={() => hasMemos && onSelectDate(isSelected ? null : key, dateMode)}
                  className={`min-h-[56px] p-1.5 flex flex-col transition-colors
                    ${hasMemos ? 'cursor-pointer hover:bg-gray-50' : ''}
                    ${isSelected ? (isAlert ? 'bg-orange-50 ring-1 ring-inset ring-orange-200' : 'bg-blue-50 ring-1 ring-inset ring-blue-200') : ''}`}
                >
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-0.5
                    ${isToday ? 'bg-gray-800 text-white font-bold'
                      : isSun ? 'text-red-400'
                      : isSat ? 'text-blue-400'
                      : 'text-gray-600'}`}>
                    {day}
                  </span>
                  {hasMemos && (
                    <>
                      <span className={`text-[10px] font-medium ${isAlert ? 'text-orange-500' : 'text-blue-500'}`}>{dayMemos.length}건</span>
                      <div className="flex gap-0.5 flex-wrap mt-0.5">
                        {categories.slice(0, 4).map(c => (
                          <span key={c} className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[c] ?? 'bg-gray-400'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
