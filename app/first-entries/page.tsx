'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import type { Trade } from '@/lib/types'
import { apiFetch } from '@/lib/api'

interface SymbolFirstEntry {
  symbol: string
  symbolCode: string | null
  firstDate: string   // YYYY-MM-DD
  lastDate: string    // YYYY-MM-DD (가장 최근 체결일)
  entryCount: number  // 해당 종목의 전체 매수+매도 내역(Entry) 건수
}

const DORMANT_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

// 거래 횟수(전체 매수+매도 Entry 건수) 구간별 시각적 비중 — 값이 클수록 진하고 크게 표시
const ENTRY_COUNT_TIERS = [
  { min: 11, cls: 'text-base font-bold px-2.5 py-1.5 bg-red-100 text-red-700 border-red-300' },
  { min: 7,  cls: 'text-sm font-semibold px-2 py-1.5 bg-purple-100 text-purple-700 border-purple-300' },
  { min: 4,  cls: 'text-sm font-medium px-2 py-1 bg-blue-100 text-blue-700 border-blue-300' },
  { min: 2,  cls: 'text-xs px-1.5 py-1 bg-blue-50 text-blue-600 border-blue-200' },
  { min: 0,  cls: 'text-xs px-1.5 py-1 bg-gray-50 text-gray-500 border-gray-200' },
] as const

function tierFor(count: number) {
  return ENTRY_COUNT_TIERS.find(t => count >= t.min)!
}

export default function FirstEntriesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [dormantMonths, setDormantMonths] = useState<number | null>(null)
  const [chartSymbol, setChartSymbol] = useState<{ symbol: string; symbolCode: string } | null>(null)

  useEffect(() => {
    apiFetch('/api/trades')
      .then(r => r.json())
      .then((d: unknown) => Array.isArray(d) && setTrades(d as Trade[]))
      .finally(() => setLoading(false))
  }, [])

  // 종목별로 전체 계좌·거래를 합산해 최초/최근 진입일 + 전체 체결 건수 계산
  const bySymbol = useMemo(() => {
    const map = new Map<string, SymbolFirstEntry>()
    for (const t of trades) {
      const entries = [...t.buyEntries, ...t.sellEntries]
      for (const e of entries) {
        const date = e.date.slice(0, 10)
        const cur = map.get(t.symbol)
        if (!cur) {
          map.set(t.symbol, { symbol: t.symbol, symbolCode: t.symbolCode ?? null, firstDate: date, lastDate: date, entryCount: 1 })
        } else {
          cur.entryCount++
          if (date < cur.firstDate) cur.firstDate = date
          if (date > cur.lastDate) cur.lastDate = date
          if (!cur.symbolCode && t.symbolCode) cur.symbolCode = t.symbolCode
        }
      }
    }
    return Array.from(map.values())
  }, [trades])

  // "N개월간 거래 없음" 필터 — 마지막 체결일 기준으로 오늘까지 N개월 이상 지난 종목만
  const filteredBySymbol = useMemo(() => {
    if (dormantMonths == null) return bySymbol
    return bySymbol.filter(item => dayjs().diff(dayjs(item.lastDate), 'month') >= dormantMonths)
  }, [bySymbol, dormantMonths])

  // 최초 진입월(연-월) 기준으로 그룹핑, 그 안에서 다시 날짜(일) 단위로 세분화. 최신순 정렬
  const groups = useMemo(() => {
    const monthMap = new Map<string, Map<string, SymbolFirstEntry[]>>()
    for (const item of filteredBySymbol) {
      const month = item.firstDate.slice(0, 7)
      const dayMap = monthMap.get(month) ?? new Map<string, SymbolFirstEntry[]>()
      const list = dayMap.get(item.firstDate) ?? []
      list.push(item)
      dayMap.set(item.firstDate, list)
      monthMap.set(month, dayMap)
    }
    return Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, dayMap]) => ({
        month,
        days: Array.from(dayMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, items]) => ({
            date,
            items: items.sort((a, b) => b.entryCount - a.entryCount),
          })),
      }))
  }, [filteredBySymbol])

  function formatMonth(month: string): string {
    const [y, m] = month.split('-')
    return `${y}년 ${Number(m)}월`
  }

  function formatDay(date: string): string {
    return `${Number(date.slice(8, 10))}일`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 뒤로</Link>
        <h1 className="text-lg font-bold">최초진입 타임라인</h1>
        <span className="text-xs text-gray-400 ml-auto">
          {dormantMonths != null ? `${groups.reduce((s, g) => s + g.days.reduce((s2, d) => s2 + d.items.length, 0), 0)} / ` : ''}종목 {bySymbol.length}개
        </span>
      </header>

      <div className="px-4 py-5 max-w-6xl mx-auto flex gap-4 items-start">
        <div className="w-1/2 min-w-0">
          {loading ? (
            <p className="text-center text-gray-400 py-16 text-sm">불러오는 중...</p>
          ) : groups.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">
              {dormantMonths != null ? '조건에 해당하는 종목이 없습니다' : '거래 기록이 없습니다'}
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map(({ month, days }) => (
                <div key={month}>
                  <p className="text-sm font-semibold text-gray-700 mb-1.5">{formatMonth(month)}</p>
                  <div className="space-y-1.5 border-b pb-3">
                    {days.map(({ date, items }) => (
                      <div key={date} className="flex gap-3">
                        <div className="w-10 shrink-0 text-xs text-gray-400 pt-1">{formatDay(date)}</div>
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {items.map(item => {
                            const tier = tierFor(item.entryCount)
                            return (
                              <span
                                key={item.symbol}
                                className={`inline-flex items-baseline gap-1 rounded border ${tier.cls}`}
                                title={`최초 진입 ${item.firstDate} · 최근 체결 ${item.lastDate} · 전체 체결 ${item.entryCount}건`}
                              >
                                {item.symbolCode ? (
                                  <button
                                    type="button"
                                    onClick={() => setChartSymbol({ symbol: item.symbol, symbolCode: item.symbolCode! })}
                                    className="hover:underline"
                                  >{item.symbol}</button>
                                ) : (
                                  item.symbol
                                )}
                                <span className="opacity-60 text-[10px]">{item.entryCount}건</span>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-1/2 shrink-0 sticky top-16 space-y-3">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 mb-2">거래없음 필터</p>
            <div className="grid grid-cols-4 gap-2">
              {DORMANT_MONTH_OPTIONS.map(m => (
                <button
                  key={m}
                  onClick={() => setDormantMonths(v => v === m ? null : m)}
                  className={`text-center text-sm py-2.5 rounded border ${
                    dormantMonths === m
                      ? 'bg-orange-100 text-orange-700 border-orange-300 font-semibold'
                      : 'text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >{m}</button>
              ))}
            </div>
            {dormantMonths != null && (
              <button
                onClick={() => setDormantMonths(null)}
                className="w-full text-center text-sm py-2 rounded border text-gray-400 border-gray-200 hover:border-gray-400 mt-2"
              >필터 해제</button>
            )}
          </div>

          {chartSymbol && (
            <div className="bg-white border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium truncate">{chartSymbol.symbol}</p>
                <button onClick={() => setChartSymbol(null)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">닫기 ×</button>
              </div>
              <a
                href={`https://finance.naver.com/item/fchart.naver?code=${chartSymbol.symbolCode}`}
                target="_blank"
                rel="noopener noreferrer"
                title="네이버 금융에서 차트 크게 보기"
              >
                <img
                  src={`https://ssl.pstatic.net/imgfinance/chart/item/candle/day/${chartSymbol.symbolCode}.png`}
                  alt={`${chartSymbol.symbol} 일봉 차트`}
                  className="w-full rounded border hover:opacity-90"
                />
              </a>
              <a
                href={`https://www.tradingview.com/chart/?symbol=KRX%3A${chartSymbol.symbolCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1.5 text-xs text-blue-500 hover:text-blue-700"
                title="트레이딩뷰 차트 열기"
              >📈 트레이딩뷰에서 보기</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
