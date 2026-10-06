import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichTrade } from '@/lib/utils'

type BatchItem = {
  accountId: string
  symbol: string
  symbolCode?: string | null
  type: '매수' | '매도'
  date: string
  price: number
  quantity: number
}

// 카톡 알림 여러 건을 한 번에 저장.
// 같은 계좌·종목의 보유중 거래가 있으면 거기에 매수/매도 항목을 추가하고, 없으면 새 거래를 만든다.
// 입력 순서대로 처리하므로 같은 묶음 안의 매수 → 매도도 한 거래로 이어진다.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const items: BatchItem[] = Array.isArray(body?.items) ? body.items : []

  if (items.length === 0) {
    return NextResponse.json({ error: '저장할 항목이 없습니다.' }, { status: 400 })
  }
  for (const it of items) {
    if (!it.accountId || !it.symbol?.trim() || !it.date || !(Number(it.price) > 0) || !(Number(it.quantity) > 0) || (it.type !== '매수' && it.type !== '매도')) {
      return NextResponse.json({ error: '계좌·종목·구분·날짜·단가·수량을 모두 확인해주세요.' }, { status: 400 })
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let created = 0
    let appended = 0

    for (const it of items) {
      const now = new Date().toISOString()
      const symbol = it.symbol.trim()
      const entry = { id: crypto.randomUUID(), date: it.date, price: Number(it.price), quantity: Number(it.quantity), createdAt: now }

      const master = await tx.stockMaster.findUnique({ where: { symbol } })
      if (it.symbolCode && !master) {
        await tx.stockMaster.create({
          data: { id: crypto.randomUUID(), symbol, symbolCode: it.symbolCode, createdAt: now, updatedAt: now },
        })
      }

      const candidates = await tx.trade.findMany({
        where: { accountId: it.accountId, symbol },
        include: { buyEntries: true, sellEntries: true },
        orderBy: { createdAt: 'desc' },
      })
      const open = candidates.find(t => !enrichTrade({ ...t, images: [] }).isCompleted)

      if (open) {
        if (it.type === '매수') await tx.buyEntry.create({ data: { ...entry, tradeId: open.id } })
        else await tx.sellEntry.create({ data: { ...entry, tradeId: open.id } })
        await tx.trade.update({
          where: { id: open.id },
          data: { updatedAt: now, ...(!open.symbolCode && it.symbolCode ? { symbolCode: it.symbolCode } : {}) },
        })
        appended++
      } else {
        await tx.trade.create({
          data: {
            id: crypto.randomUUID(),
            accountId: it.accountId,
            symbol,
            symbolCode: it.symbolCode || master?.symbolCode || null,
            createdAt: now,
            updatedAt: now,
            ...(it.type === '매수' ? { buyEntries: { create: [entry] } } : { sellEntries: { create: [entry] } }),
          },
        })
        created++
      }
    }

    return { created, appended }
  })

  return NextResponse.json(result, { status: 201 })
}
