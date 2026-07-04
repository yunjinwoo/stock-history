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
  const { accountId, symbol, symbolCode, comment, exitComment, buyEntries, sellEntries, targetPrice, stopLossPrice } = body
  const now = new Date().toISOString()

  if (symbolCode && symbol) {
    const master = await prisma.stockMaster.findUnique({ where: { symbol } })
    if (!master) {
      await prisma.stockMaster.create({
        data: { id: crypto.randomUUID(), symbol, symbolCode, createdAt: now, updatedAt: now },
      })
    }
  }

  const trade = await prisma.$transaction(async (tx) => {
    // Only delete/recreate entries if explicitly provided in body
    if (buyEntries !== undefined) {
      await tx.buyEntry.deleteMany({ where: { tradeId: id } })
    }
    if (sellEntries !== undefined) {
      await tx.sellEntry.deleteMany({ where: { tradeId: id } })
    }

    return tx.trade.update({
      where: { id },
      data: {
        ...(accountId !== undefined && { accountId }),
        ...(symbol !== undefined && { symbol }),
        ...(symbolCode !== undefined && { symbolCode: symbolCode || null }),
        ...(comment !== undefined && { comment: comment || null }),
        ...(exitComment !== undefined && { exitComment: exitComment || null }),
        ...(targetPrice !== undefined && { targetPrice: targetPrice ? Number(targetPrice) : null }),
        ...(stopLossPrice !== undefined && { stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null }),
        updatedAt: now,
        ...(buyEntries !== undefined && {
          buyEntries: {
            create: (buyEntries as EntryInput[]).map((e) => ({
              id: crypto.randomUUID(),
              date: e.date,
              price: Number(e.price),
              quantity: Number(e.quantity),
              createdAt: now,
            })),
          },
        }),
        ...(sellEntries !== undefined && {
          sellEntries: {
            create: (sellEntries as EntryInput[]).map((e) => ({
              id: crypto.randomUUID(),
              date: e.date,
              price: Number(e.price),
              quantity: Number(e.quantity),
              createdAt: now,
            })),
          },
        }),
      },
      include: { buyEntries: true, sellEntries: true, images: true },
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
