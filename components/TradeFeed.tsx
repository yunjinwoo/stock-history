'use client'

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import type { Trade, Account } from '@/lib/types'
import { formatKRW } from '@/lib/utils'

const TYPE_STYLE: Record<string, string> = {
  코스피: 'bg-blue-50 text-blue-600 border-blue-200',
  코스닥: 'bg-green-50 text-green-600 border-green-200',
  ETF: 'bg-purple-50 text-purple-600 border-purple-200',
}

const PAGE_SIZE_OPTIONS = [50, 100, 300] as const

interface Props {
  trades: Trade[]
  accounts: Account[]
  symbolTypeMap?: Record<string, string>
  onEdit: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

interface FeedRow {
  key: string
  trade: Trade
  type: '매수' | '매도'
  date: string
  price: number
  quantity: number
  amount: number
  createdAt: string
}

type NumRange = [number | undefined, number | undefined]
type DateRange = [string | undefined, string | undefined]

const RIGHT_ALIGN_COLS = new Set(['price', 'quantity', 'amount'])

const columnHelper = createColumnHelper<FeedRow>()

function exactFilter<T>(row: { getValue: (id: string) => unknown }, columnId: string, filterValue: T) {
  return filterValue == null ? true : row.getValue(columnId) === filterValue
}

// 거래일(YYYY-MM-DD) 기준 범위 필터 — 문자열 사전순 비교로 충분
function dateRangeFilter(row: { original: FeedRow }, _columnId: string, filterValue: DateRange | undefined) {
  if (!filterValue) return true
  const [from, to] = filterValue
  const d = row.original.date.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

function updateRange<T>(old: [T | undefined, T | undefined] | undefined, index: 0 | 1, value: T | undefined): [T | undefined, T | undefined] | undefined {
  const next: [T | undefined, T | undefined] = index === 0 ? [value, old?.[1]] : [old?.[0], value]
  return next[0] == null && next[1] == null ? undefined : next
}

function NumberRangeFilter({ column, unit }: { column: Column<FeedRow, unknown> | undefined; unit: string }) {
  const value = (column?.getFilterValue() as NumRange | undefined) ?? [undefined, undefined]
  const inputCls = 'border rounded px-1.5 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value[0] ?? ''}
        onChange={e => column?.setFilterValue((old: NumRange | undefined) => updateRange(old, 0, e.target.value === '' ? undefined : Number(e.target.value)))}
        placeholder="최소"
        className={inputCls}
      />
      <span className="text-gray-300 text-xs">~</span>
      <input
        type="number"
        value={value[1] ?? ''}
        onChange={e => column?.setFilterValue((old: NumRange | undefined) => updateRange(old, 1, e.target.value === '' ? undefined : Number(e.target.value)))}
        placeholder="최대"
        className={inputCls}
      />
      <span className="text-[10px] text-gray-400">{unit}</span>
    </div>
  )
}

interface PaginationBarProps {
  table: ReturnType<typeof useReactTable<FeedRow>>
  pageIndex: number
  pageSize: number
  rangeStart: number
  rangeEnd: number
  filteredCount: number
}

function PaginationBar({ table, pageIndex, pageSize, rangeStart, rangeEnd, filteredCount }: PaginationBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span className="tabular-nums">{rangeStart}–{rangeEnd} / {filteredCount}건</span>
      <select
        value={pageSize}
        onChange={e => table.setPageSize(Number(e.target.value))}
        className="border rounded px-1.5 py-1 bg-white focus:outline-none"
      >
        {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}개씩</option>)}
      </select>
      <div className="flex items-center gap-1">
        <button
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="w-6 h-6 flex items-center justify-center rounded border disabled:opacity-30 hover:bg-white"
        >«</button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="w-6 h-6 flex items-center justify-center rounded border disabled:opacity-30 hover:bg-white"
        >‹</button>
        <span className="px-1.5 tabular-nums">{pageIndex + 1} / {Math.max(1, table.getPageCount())}</span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="w-6 h-6 flex items-center justify-center rounded border disabled:opacity-30 hover:bg-white"
        >›</button>
        <button
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="w-6 h-6 flex items-center justify-center rounded border disabled:opacity-30 hover:bg-white"
        >»</button>
      </div>
    </div>
  )
}

function DateRangeFilter({ column }: { column: Column<FeedRow, unknown> | undefined }) {
  const value = (column?.getFilterValue() as DateRange | undefined) ?? [undefined, undefined]
  const inputCls = 'border rounded px-1.5 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-400'
  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value[0] ?? ''}
        onChange={e => column?.setFilterValue((old: DateRange | undefined) => updateRange(old, 0, e.target.value || undefined))}
        className={inputCls}
      />
      <span className="text-gray-300 text-xs">~</span>
      <input
        type="date"
        value={value[1] ?? ''}
        onChange={e => column?.setFilterValue((old: DateRange | undefined) => updateRange(old, 1, e.target.value || undefined))}
        className={inputCls}
      />
    </div>
  )
}

export default function TradeFeed({ trades, accounts, symbolTypeMap = {}, onEdit, onDelete }: Props) {
  const accountMap = useMemo(() => {
    const map: Record<string, Account> = {}
    accounts.forEach(a => { map[a.id] = a })
    return map
  }, [accounts])

  const data: FeedRow[] = useMemo(() => trades.flatMap(trade => [
    ...trade.buyEntries.map(e => ({ key: e.id, trade, type: '매수' as const, date: e.date, price: e.price, quantity: e.quantity, amount: e.price * e.quantity, createdAt: e.createdAt })),
    ...trade.sellEntries.map(e => ({ key: e.id, trade, type: '매도' as const, date: e.date, price: e.price, quantity: e.quantity, amount: e.price * e.quantity, createdAt: e.createdAt })),
  ]), [trades])

  // 가장 최근에 저장된 항목 — 마지막으로 입력/수정한 내역을 바로 확인할 수 있도록 강조
  const latestCreatedAt = useMemo(
    () => data.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), data[0]?.createdAt ?? ''),
    [data],
  )

  // 거래(포지션) 단위 번호 — 매수/매도 내역이 같은 거래로 묶여있는지 한눈에 보기 위함
  // 거래 생성 순서(오래된 순)로 번호를 매겨서 필터·정렬을 바꿔도 번호가 흔들리지 않게 함
  const tradeNoMap = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const map: Record<string, number> = {}
    sorted.forEach((t, i) => { map[t.id] = i + 1 })
    return map
  }, [trades])

  function accountLabel(trade: Trade): string {
    const account = accountMap[trade.accountId]
    return account ? (account.nickname || `${account.broker} ${account.accountNumber}`) : '알 수 없는 계좌'
  }

  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const activeTradeNo = columnFilters.find(f => f.id === 'tradeNo')?.value as number | undefined
  const activeSymbol = columnFilters.find(f => f.id === 'symbol')?.value as string | undefined
  const activeAccount = columnFilters.find(f => f.id === 'account')?.value as string | undefined

  function toggleTradeNoFilter(no: number) {
    setColumnFilters(prev => {
      const isActive = prev.find(f => f.id === 'tradeNo')?.value === no
      const rest = prev.filter(f => f.id !== 'tradeNo')
      return isActive ? rest : [...rest, { id: 'tradeNo', value: no }]
    })
  }

  function toggleSymbolFilter(symbol: string) {
    setColumnFilters(prev => {
      const isActive = prev.find(f => f.id === 'symbol')?.value === symbol
      const rest = prev.filter(f => f.id !== 'symbol')
      return isActive ? rest : [...rest, { id: 'symbol', value: symbol }]
    })
  }

  function toggleAccountFilter(account: string) {
    setColumnFilters(prev => {
      const isActive = prev.find(f => f.id === 'account')?.value === account
      const rest = prev.filter(f => f.id !== 'account')
      return isActive ? rest : [...rest, { id: 'account', value: account }]
    })
  }

  const columns = useMemo(() => [
    columnHelper.accessor(row => accountLabel(row.trade), {
      id: 'account',
      header: '계좌',
      filterFn: exactFilter,
      cell: info => {
        const value = info.getValue()
        const isActive = activeAccount === value
        return (
          <button
            type="button"
            onClick={() => toggleAccountFilter(value)}
            className={`text-sm text-left break-words rounded px-0.5 -mx-0.5 transition-colors ${isActive ? 'text-blue-600 bg-blue-50 underline' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'}`}
            title="클릭하면 이 계좌의 내역만 필터링합니다"
          >{value}</button>
        )
      },
    }),
    columnHelper.accessor('type', {
      header: '구분',
      filterFn: exactFilter,
      cell: info => (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${info.getValue() === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('quantity', {
      header: '수량',
      filterFn: 'inNumberRange',
      cell: info => <span className="whitespace-nowrap">{info.getValue()}주</span>,
    }),
    columnHelper.accessor('price', {
      header: '단가',
      filterFn: 'inNumberRange',
      cell: info => <span className="break-words">{formatKRW(info.getValue())}</span>,
    }),
    columnHelper.accessor('amount', {
      header: '금액',
      filterFn: 'inNumberRange',
      cell: info => <span className="break-words">{formatKRW(info.getValue())}</span>,
    }),
    columnHelper.accessor(row => row.trade.isCompleted, {
      id: 'status',
      header: '상태',
      filterFn: exactFilter,
      cell: info => (
        !info.getValue() ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">보유중</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">완료</span>
        )
      ),
    }),
    columnHelper.accessor(row => tradeNoMap[row.trade.id] ?? 0, {
      id: 'tradeNo',
      header: '거래#',
      filterFn: exactFilter,
      cell: info => {
        const value = info.getValue()
        const isActive = activeTradeNo === value
        return (
          <button
            type="button"
            onClick={() => toggleTradeNoFilter(value)}
            className={`text-xs tabular-nums px-1.5 py-0.5 rounded transition-colors ${isActive ? 'bg-blue-500 text-white font-medium' : 'text-gray-400 hover:bg-gray-200'}`}
            title="클릭하면 같은 거래(포지션)의 내역만 필터링합니다"
          >#{value}</button>
        )
      },
    }),
    columnHelper.accessor(row => row.trade.symbol, {
      id: 'symbol',
      header: '종목',
      filterFn: exactFilter,
      cell: info => {
        const row = info.row.original
        const isLatest = row.createdAt === latestCreatedAt
        const isActiveSymbol = activeSymbol === row.trade.symbol
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {isLatest && (
              <span className="text-[10px] font-semibold text-white bg-blue-500 px-1.5 py-0.5 rounded-full shrink-0">최신</span>
            )}
            {symbolTypeMap[row.trade.symbol] && (
              <span className={`text-[10px] px-1 py-0.5 rounded border font-medium shrink-0 ${TYPE_STYLE[symbolTypeMap[row.trade.symbol]] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {symbolTypeMap[row.trade.symbol]}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleSymbolFilter(row.trade.symbol)}
              className={`font-medium break-words text-left rounded px-0.5 -mx-0.5 transition-colors ${isActiveSymbol ? 'text-blue-600 bg-blue-50 underline' : 'hover:text-blue-600 hover:bg-gray-100'}`}
              title="클릭하면 이 종목의 내역만 필터링합니다"
            >{row.trade.symbol}</button>
            <a
              href={
                row.trade.symbolCode
                  ? `https://finance.naver.com/item/fchart.naver?code=${row.trade.symbolCode}`
                  : `https://finance.naver.com/search/search.naver?query=${encodeURIComponent(row.trade.symbol)}&endUrl=&encoding=UTF-8`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-700 text-xs font-bold shrink-0"
              title="네이버 금융 차트 열기"
            >N</a>
            {row.trade.symbolCode && (
              <>
                <a
                  href={`https://www.tradingview.com/chart/?symbol=KRX%3A${row.trade.symbolCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-600 text-xs shrink-0"
                  title="트레이딩뷰 차트 열기"
                >📈</a>
                <a
                  href={`https://tossinvest.com/stocks/A${row.trade.symbolCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3182F6] hover:opacity-70 text-xs font-bold shrink-0"
                  title="토스증권 열기"
                >T</a>
              </>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('createdAt', {
      header: '일시',
      filterFn: dateRangeFilter,
      cell: info => (
        <>
          <div className="text-gray-500 text-xs">{info.row.original.date.slice(0, 10)}</div>
          <div className="text-gray-400 text-xs mt-0.5">입력 {dayjs(info.getValue()).format('MM/DD HH:mm')}</div>
        </>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: info => {
        const row = info.row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEdit(row.trade)}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border rounded whitespace-nowrap"
            >수정</button>
            <button
              onClick={() => {
                if (confirm(`"${row.trade.symbol}" 거래를 삭제하시겠습니까?\n(이 종목의 모든 매수/매도 내역이 함께 삭제됩니다)`)) onDelete(row.trade)
              }}
              className="text-xs text-red-300 hover:text-red-500 px-2 py-1 border border-red-100 rounded whitespace-nowrap"
            >삭제</button>
          </div>
        )
      },
      enableSorting: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [accountMap, symbolTypeMap, latestCreatedAt, tradeNoMap, activeTradeNo, activeSymbol, activeAccount, onEdit, onDelete])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const original = row.original
      const haystack = `${original.trade.symbol} ${accountLabel(original.trade)}`.toLowerCase()
      return haystack.includes(String(filterValue).toLowerCase())
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  })

  const [isExporting, setIsExporting] = useState(false)

  async function exportExcel() {
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      // 현재 정렬·필터가 적용된 전체(페이지 무관) 결과를 내보냄
      const rows = table.getSortedRowModel().rows.map((row, i) => {
        const r = row.original
        return {
          No: i + 1,
          구분: r.type,
          종목: r.trade.symbol,
          계좌: accountLabel(r.trade),
          상태: r.trade.isCompleted ? '완료' : '보유중',
          거래일: r.date.slice(0, 10),
          입력시각: dayjs(r.createdAt).format('YYYY-MM-DD HH:mm'),
          단가: r.price,
          수량: r.quantity,
          금액: r.amount,
        }
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '거래내역')
      XLSX.writeFile(wb, `trade-feed-${dayjs().format('YYYYMMDD-HHmm')}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }

  if (data.length === 0) {
    return (
      <p className="text-center text-gray-400 py-16 text-sm">
        거래 기록이 없습니다<br />새 거래를 입력해보세요
      </p>
    )
  }

  const typeFilter = (table.getColumn('type')?.getFilterValue() as string | undefined) ?? null
  const statusFilter = (table.getColumn('status')?.getFilterValue() as boolean | undefined) ?? null
  const hasActiveFilter = !!globalFilter || columnFilters.length > 0

  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const rangeStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, filteredCount)

  return (
    <div className="w-full rounded-lg border bg-white overflow-hidden">
      {/* 필터 툴바 — 구분/상태/검색 */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b bg-gray-50/60">
        <input
          type="text"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="종목·계좌 검색"
          className="border rounded px-2.5 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex border rounded overflow-hidden text-xs">
          {(['all', '매수', '매도'] as const).map(v => (
            <button
              key={v}
              onClick={() => table.getColumn('type')?.setFilterValue(v === 'all' ? undefined : v)}
              className={`px-2.5 py-1.5 ${(v === 'all' ? typeFilter == null : typeFilter === v) ? 'bg-gray-200 text-gray-800 font-medium' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            >
              {v === 'all' ? '전체' : v}
            </button>
          ))}
        </div>
        <div className="flex border rounded overflow-hidden text-xs">
          {([{ label: '전체', value: null }, { label: '보유중', value: false }, { label: '완료', value: true }] as const).map(v => (
            <button
              key={v.label}
              onClick={() => table.getColumn('status')?.setFilterValue(v.value === null ? undefined : v.value)}
              className={`px-2.5 py-1.5 ${statusFilter === v.value ? 'bg-gray-200 text-gray-800 font-medium' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {activeAccount != null && (
          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-2.5 pr-1.5 py-1">
            계좌 {activeAccount}만 보는 중
            <button
              onClick={() => setColumnFilters(prev => prev.filter(f => f.id !== 'account'))}
              className="hover:text-blue-900 px-1"
            >✕</button>
          </span>
        )}
        {activeSymbol != null && (
          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-2.5 pr-1.5 py-1">
            종목 {activeSymbol}만 보는 중
            <button
              onClick={() => setColumnFilters(prev => prev.filter(f => f.id !== 'symbol'))}
              className="hover:text-blue-900 px-1"
            >✕</button>
          </span>
        )}
        {activeTradeNo != null && (
          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-2.5 pr-1.5 py-1">
            거래 #{activeTradeNo}만 보는 중
            <button
              onClick={() => setColumnFilters(prev => prev.filter(f => f.id !== 'tradeNo'))}
              className="hover:text-blue-900 px-1"
            >✕</button>
          </span>
        )}
        {hasActiveFilter && (
          <button
            onClick={() => { setGlobalFilter(''); setColumnFilters([]) }}
            className="text-xs text-gray-400 hover:text-red-400"
          >필터 초기화</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {hasActiveFilter ? `${filteredCount}건 (전체 ${data.length}건)` : `${data.length}건`}
        </span>
      </div>

      {/* 범위 필터 — 일시/단가/수량/금액 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5 border-b bg-white">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-7 shrink-0">일시</span>
          <DateRangeFilter column={table.getColumn('createdAt')} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-7 shrink-0">단가</span>
          <NumberRangeFilter column={table.getColumn('price')} unit="원" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-7 shrink-0">수량</span>
          <NumberRangeFilter column={table.getColumn('quantity')} unit="주" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 w-7 shrink-0">금액</span>
          <NumberRangeFilter column={table.getColumn('amount')} unit="원" />
        </div>
      </div>

      {/* 상단 페이지 정보 + 엑셀 다운로드 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-gray-50/60">
        <PaginationBar table={table} pageIndex={pageIndex} pageSize={pageSize} rangeStart={rangeStart} rangeEnd={rangeEnd} filteredCount={filteredCount} />
        <button
          onClick={exportExcel}
          disabled={isExporting || filteredCount === 0}
          className="text-xs px-2.5 py-1.5 rounded border text-green-600 border-green-200 hover:bg-green-50 disabled:opacity-50 whitespace-nowrap"
        >
          {isExporting ? '내보내는 중...' : '📊 엑셀 다운로드'}
        </button>
      </div>

      {filteredCount === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">조건에 맞는 내역이 없습니다</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-12" />
              <col className="w-16" />
              <col className="w-16" />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-20" />
              <col className="w-14" />
              <col />
              <col className="w-32" />
              <col className="w-28" />
            </colgroup>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="text-xs text-gray-400 border-b bg-gray-50">
                  <th className="px-3 py-2 font-normal text-center">No</th>
                  {headerGroup.headers.map(header => {
                    const sortDir = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        className={`px-3 py-2 font-normal ${RIGHT_ALIGN_COLS.has(header.id) ? 'text-right' : 'text-left'} ${header.id === 'type' || header.id === 'status' || header.id === 'tradeNo' ? 'text-center' : ''} ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-600' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ''}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {table.getRowModel().rows.map((row, i) => {
                const isLatest = row.original.createdAt === latestCreatedAt
                const isCompleted = row.original.trade.isCompleted
                const rowNo = pageIndex * pageSize + i + 1
                // 완료(흰 배경, 눈에 덜 띔) vs 보유중(회색 배경, 뚜렷하게 구분)
                const statusBg = isCompleted ? 'hover:bg-gray-50' : 'bg-gray-100 hover:bg-gray-200'
                const latestRing = isLatest ? 'ring-1 ring-inset ring-blue-300' : ''
                return (
                  <tr key={row.id} className={`align-top ${statusBg} ${latestRing}`}>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 tabular-nums">{rowNo}</td>
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={`px-3 py-2.5 ${RIGHT_ALIGN_COLS.has(cell.column.id) ? 'text-right' : ''} ${cell.column.id === 'status' || cell.column.id === 'tradeNo' ? 'text-center' : ''} ${cell.column.id === 'symbol' ? 'min-w-0' : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 하단 페이지네이션 */}
      {filteredCount > 0 && (
        <div className="px-3 py-2 border-t bg-gray-50/60">
          <PaginationBar table={table} pageIndex={pageIndex} pageSize={pageSize} rangeStart={rangeStart} rangeEnd={rangeEnd} filteredCount={filteredCount} />
        </div>
      )}
    </div>
  )
}
