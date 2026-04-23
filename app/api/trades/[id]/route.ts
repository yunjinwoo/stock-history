import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichTrade } from '@/lib/utils'

type EntryInput = { date: string; price: number; quantity: number }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { accountId, symbol, symbolCode, comment, buyEntries = [], sellEntries = [] } = body
  const now = new Date().toISOString()

  const trade = await prisma.$transaction(async (tx) => {
    await tx.buyEntry.deleteMany({ where: { tradeId: id } })
    await tx.sellEntry.deleteMany({ where: { tradeId: id } })
    return tx.trade.update({
      where: { id },
      data: {
        accountId,
        symbol,
        symbolCode: symbolCode || null,
        comment: comment || null,
        updatedAt: now,
        buyEntries: {
          create: buyEntries.map((e: EntryInput) => ({
            id: crypto.randomUUID(),
            date: e.date,
            price: Number(e.price),
            quantity: Number(e.quantity),
            createdAt: now,
          })),
        },
        sellEntries: {
          create: sellEntries.map((e: EntryInput) => ({
            id: crypto.randomUUID(),
            date: e.date,
            price: Number(e.price),
            quantity: Number(e.quantity),
            createdAt: now,
          })),
        },
      },
      include: { buyEntries: true, sellEntries: true },
    })
  })

  return NextResponse.json(enrichTrade(trade))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.trade.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
