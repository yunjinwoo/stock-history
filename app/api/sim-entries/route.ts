import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const entries = await prisma.simEntry.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest) {
  const { tradeId, price, quantity } = await req.json()
  const entry = await prisma.simEntry.create({
    data: { id: crypto.randomUUID(), tradeId, price, quantity, createdAt: new Date().toISOString() },
  })
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tradeId = searchParams.get('tradeId')
  if (!tradeId) return NextResponse.json({ error: 'tradeId required' }, { status: 400 })
  await prisma.simEntry.deleteMany({ where: { tradeId } })
  return NextResponse.json({ ok: true })
}
