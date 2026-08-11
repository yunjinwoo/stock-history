'use client'

import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import type { Trade, Account } from '@/lib/types'
import { formatKRW } from '@/lib/utils'

const TYPE_STYLE: Record<string, string> = {
  코스피: 'bg-blue-50 text-blue-600 border-blue-200',
  코스닥: 'bg-green-50 text-green-600 border-green-200',
  ETF: 'bg-purple-50 text-purple-600 border-purple-200',
}

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

const RIGHT_ALIGN_COLS = new Set(['price', 'quantity', 'amount'])

const columnHelper = createColumnHelper<FeedRow>()

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

  function accountLabel(trade: Trade): string {
    const account = accountMap[trade.accountId]
    return account ? (account.nickname || `${account.broker} ${account.accountNumber}`) : '알 수 없는 계좌'
  }

  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])

  const columns = useMemo(() => [
    columnHelper.accessor('type', {
      header: '구분',
      cell: info => (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${info.getValue() === '매수' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor(row => row.trade.symbol, {
      id: 'symbol',
      header: '종목',
      cell: info => {
        const row = info.row.original
        const isLatest = row.createdAt === latestCreatedAt
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
            <span className="font-medium break-words">{row.trade.symbol}</span>
          </div>
        )
      },
    }),
    columnHelper.accessor(row => accountLabel(row.trade), {
      id: 'account',
      header: '계좌',
      cell: info => <span className="text-sm text-gray-600">{info.getValue()}</span>,
    }),
    columnHelper.accessor(row => row.trade.isCompleted, {
      id: 'status',
      header: '상태',
      cell: info => (
        !info.getValue() ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">보유중</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">완료</span>
        )
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: '일시',
      cell: info => (
        <>
          <div className="text-gray-500 text-xs">{info.row.original.date.slice(0, 10)}</div>
          <div className="text-gray-400 text-xs mt-0.5">입력 {dayjs(info.getValue()).format('MM/DD HH:mm')}</div>
        </>
      ),
    }),
    columnHelper.accessor('price', {
      header: '단가',
      cell: info => <span className="break-words">{formatKRW(info.getValue())}</span>,
    }),
    columnHelper.accessor('quantity', {
      header: '수량',
      cell: info => <span className="whitespace-nowrap">{info.getValue()}주</span>,
    }),
    columnHelper.accessor('amount', {
      header: '금액',
      cell: info => <span className="break-words">{formatKRW(info.getValue())}</span>,
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
  ], [accountMap, symbolTypeMap, latestCreatedAt, onEdit, onDelete])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (data.length === 0) {
    return (
      <p className="text-center text-gray-400 py-16 text-sm">
        거래 기록이 없습니다<br />새 거래를 입력해보세요
      </p>
    )
  }

  return (
    <div className="w-full rounded-lg border bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-16" />
            <col />
            <col className="w-32" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-28" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-28" />
          </colgroup>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="text-xs text-gray-400 border-b bg-gray-50">
                {headerGroup.headers.map(header => {
                  const sortDir = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 font-normal ${RIGHT_ALIGN_COLS.has(header.id) ? 'text-right' : 'text-left'} ${header.id === 'type' || header.id === 'status' ? 'text-center' : ''} ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-600' : ''}`}
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
            {table.getRowModel().rows.map(row => {
              const isLatest = row.original.createdAt === latestCreatedAt
              return (
                <tr key={row.id} className={`hover:bg-gray-50 align-top ${isLatest ? 'bg-blue-50/50' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={`px-3 py-2.5 ${RIGHT_ALIGN_COLS.has(cell.column.id) ? 'text-right' : ''} ${cell.column.id === 'status' ? 'text-center' : ''} ${cell.column.id === 'symbol' ? 'min-w-0' : ''}`}
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
    </div>
  )
}
