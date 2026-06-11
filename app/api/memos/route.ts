import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const memos = await prisma.memo.findMany({
    where: symbol ? { symbols: { some: { symbol } } } : undefined,
    include: {
      images: { orderBy: { createdAt: 'asc' } },
      symbols: { orderBy: { symbol: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(memos)
}

export async function POST(req: NextRequest) {
  const { content, rating, category, symbols, alertDate, showOnMain, showOnCoin } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const memo = await prisma.memo.create({
    data: {
      id: crypto.randomUUID(),
      content: content.trim(),
      showOnMain: showOnMain ?? false,
      showOnCoin: showOnCoin ?? false,
      rating: rating != null ? Number(rating) : null,
      category: category ?? null,
      alertDate: alertDate ?? null,
      createdAt: now,
      updatedAt: now,
      symbols: symbols?.length ? {
        create: (symbols as string[]).map(s => ({ id: crypto.randomUUID(), symbol: s })),
      } : undefined,
    },
    include: {
      images: true,
      symbols: { orderBy: { symbol: 'asc' } },
    },
  })
  return NextResponse.json(memo, { status: 201 })
}
