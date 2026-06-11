import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'

export async function GET() {
  const memos = await prisma.memo.findMany({
    include: { symbols: { orderBy: { symbol: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

  const rows = memos.map(m => ({
    '내용': m.content,
    '평점': m.rating ?? '',
    '분류': m.category ?? '',
    '종목태그': m.symbols.map(s => s.symbol).join(', '),
    '알림일': m.alertDate ?? '',
    '확인일': m.reviewedAt ? m.reviewedAt.slice(0, 10) : '',
    '작성일': m.createdAt.slice(0, 10),
    '수정일': m.updatedAt.slice(0, 10),
    '주식핀': m.showOnMain ? 'Y' : '',
    '코인핀': m.showOnCoin ? 'Y' : '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 60 }, { wch: 6 }, { wch: 8 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws, '메모')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="memos-${date}.xlsx"`,
    },
  })
}
