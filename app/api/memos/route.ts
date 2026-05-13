import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const memos = await prisma.memo.findMany({
    include: { images: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(memos)
}

export async function POST(req: NextRequest) {
  const { content, rating, category } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const memo = await prisma.memo.create({
    data: {
      id: crypto.randomUUID(),
      content: content.trim(),
      showOnMain: true,
      rating: rating != null ? Number(rating) : null,
      category: category ?? null,
      createdAt: now,
      updatedAt: now,
    },
    include: { images: true },
  })
  return NextResponse.json(memo, { status: 201 })
}
