import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichTrade } from '@/lib/utils'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const buyEntryIds: string[] = Array.isArray(body.buyEntryIds) ? body.buyEntryIds : []
  const sellEntryIds: string[] = Array.isArray(body.sellEntryIds) ? body.sellEntryIds : []

  if (buyEntryIds.length === 0 && sellEntryIds.length === 0) {
    return NextResponse.json({ error: '분리할 내역을 선택해주세요.' }, { status: 400 })
  }

  const original = await prisma.trade.findUnique({
    where: { id },
    include: { buyEntries: true, sellEntries: true },
  })
  if (!original) {
    return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 })
  }

  const remainingCount =
    original.buyEntries.filter(e => !buyEntryIds.includes(e.id)).length +
    original.sellEntries.filter(e => !sellEntryIds.includes(e.id)).length
  if (remainingCount === 0) {
    return NextResponse.json({ error: '원래 거래에 최소 1건은 남아있어야 합니다.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)

  const result = await prisma.$transaction(async (tx) => {
    const newTrade = await tx.trade.create({
      data: {
        id: crypto.randomUUID(),
        accountId: original.accountId,
        symbol: original.symbol,
        symbolCode: original.symbolCode,
        comment: `${today} 기존 포지션에서 일부 내역 분리됨`,
        createdAt: now,
        updatedAt: now,
      },
    })

    if (buyEntryIds.length > 0) {
      await tx.buyEntry.updateMany({
        where: { id: { in: buyEntryIds }, tradeId: id },
        data: { tradeId: newTrade.id },
      })
    }
    if (sellEntryIds.length > 0) {
      await tx.sellEntry.updateMany({
        where: { id: { in: sellEntryIds }, tradeId: id },
        data: { tradeId: newTrade.id },
      })
    }

    await tx.trade.update({
      where: { id },
      data: {
        comment: original.comment
          ? `${original.comment}\n[${today}] 일부 내역을 새 거래로 분리함`
          : `[${today}] 일부 내역을 새 거래로 분리함`,
        updatedAt: now,
      },
    })

    const [updatedOriginal, fullNewTrade] = await Promise.all([
      tx.trade.findUniqueOrThrow({ where: { id }, include: { buyEntries: true, sellEntries: true, images: true } }),
      tx.trade.findUniqueOrThrow({ where: { id: newTrade.id }, include: { buyEntries: true, sellEntries: true, images: true } }),
    ])
    return { originalTrade: updatedOriginal, newTrade: fullNewTrade }
  })

  return NextResponse.json({
    originalTrade: enrichTrade(result.originalTrade),
    newTrade: enrichTrade(result.newTrade),
  })
}
