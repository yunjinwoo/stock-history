import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichCoinTrade, uuid } from '@/lib/utils'

type EntryInput = { date: string; price: number; quantity: number }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { symbol, comment, buyEntries = [], sellEntries = [] } = body
  const now = new Date().toISOString()

  const trade = await prisma.$transaction(async (tx) => {
    await tx.coinBuyEntry.deleteMany({ where: { tradeId: id } })
    await tx.coinSellEntry.deleteMany({ where: { tradeId: id } })
    return tx.coinTrade.update({
      where: { id },
      data: {
        symbol, comment: comment || null, updatedAt: now,
        buyEntries: { create: buyEntries.map((e: EntryInput) => ({ id: uuid(), date: e.date, price: Number(e.price), quantity: Number(e.quantity), createdAt: now })) },
        sellEntries: { create: sellEntries.map((e: EntryInput) => ({ id: uuid(), date: e.date, price: Number(e.price), quantity: Number(e.quantity), createdAt: now })) },
      },
      include: { buyEntries: true, sellEntries: true },
    })
  })

  return NextResponse.json(enrichCoinTrade(trade))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.coinTrade.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
