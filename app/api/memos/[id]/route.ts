import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()
  const memo = await prisma.memo.update({
    where: { id },
    data: {
      ...(body.content !== undefined && { content: body.content.trim() }),
      ...(body.showOnMain !== undefined && { showOnMain: body.showOnMain }),
      ...(body.showOnCoin !== undefined && { showOnCoin: body.showOnCoin }),
      ...(body.rating !== undefined && { rating: body.rating != null ? Number(body.rating) : null }),
      ...(body.category !== undefined && { category: body.category ?? null }),
      ...(body.symbol !== undefined && { symbol: body.symbol ?? null }),
      ...(body.alertDate !== undefined && { alertDate: body.alertDate ?? null }),
      updatedAt: now,
    },
    include: { images: { orderBy: { createdAt: 'asc' } } },
  })
  return NextResponse.json(memo)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.memo.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
