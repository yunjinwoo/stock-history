import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()

  // symbols 업데이트: 기존 삭제 후 새로 삽입
  if (body.symbols !== undefined) {
    await prisma.memoSymbol.deleteMany({ where: { memoId: id } })
    if (Array.isArray(body.symbols) && body.symbols.length > 0) {
      await prisma.memoSymbol.createMany({
        data: (body.symbols as string[]).map(s => ({
          id: crypto.randomUUID(),
          memoId: id,
          symbol: s,
        })),
      })
    }
  }

  const memo = await prisma.memo.update({
    where: { id },
    data: {
      ...(body.content !== undefined && { content: body.content.trim() }),
      ...(body.showOnMain !== undefined && { showOnMain: body.showOnMain }),
      ...(body.showOnCoin !== undefined && { showOnCoin: body.showOnCoin }),
      ...(body.rating !== undefined && { rating: body.rating != null ? Number(body.rating) : null }),
      ...(body.category !== undefined && { category: body.category ?? null }),
      ...(body.alertDate !== undefined && { alertDate: body.alertDate ?? null }),
      ...(body.reviewedAt !== undefined && { reviewedAt: body.reviewedAt ?? null }),
      ...(body.createdAt !== undefined && { createdAt: body.createdAt }),
      updatedAt: now,
    },
    include: {
      images: { orderBy: { createdAt: 'asc' } },
      symbols: { orderBy: { symbol: 'asc' } },
    },
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
