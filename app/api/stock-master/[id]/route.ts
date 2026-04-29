import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { symbol, symbolCode } = await req.json()
  const now = new Date().toISOString()

  const master = await prisma.stockMaster.update({
    where: { id },
    data: {
      ...(symbol && { symbol: symbol.trim() }),
      ...(symbolCode && { symbolCode: symbolCode.trim() }),
      updatedAt: now,
    },
  })

  // 기존 trades 일괄 업데이트
  await prisma.trade.updateMany({
    where: { symbol: master.symbol },
    data: { symbolCode: master.symbolCode, updatedAt: now },
  })

  return NextResponse.json(master)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.stockMaster.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
