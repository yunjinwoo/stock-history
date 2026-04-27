import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const memos = await prisma.memo.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(memos)
}

export async function POST(req: NextRequest) {
  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const memo = await prisma.memo.create({
    data: { id: crypto.randomUUID(), content: content.trim(), showOnMain: true, createdAt: now, updatedAt: now },
  })
  return NextResponse.json(memo, { status: 201 })
}
