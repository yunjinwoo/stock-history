import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichTrade } from '@/lib/utils'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()
  const trade = await prisma.trade.update({
    where: { id },
    data: {
      accountId: body.accountId,
      symbol: body.symbol,
      symbolCode: body.symbolCode || null,
      buyDate: body.buyDate,
      buyPrice: Number(body.buyPrice),
      buyQuantity: Number(body.buyQuantity),
      sellDate: body.sellDate || null,
      sellPrice: body.sellPrice ? Number(body.sellPrice) : null,
      sellQuantity: body.sellQuantity ? Number(body.sellQuantity) : null,
      comment: body.comment || null,
      updatedAt: now,
    },
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
