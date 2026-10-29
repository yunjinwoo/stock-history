import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { numOrNull } from '@/lib/utils'

export async function GET() {
  const list = await prisma.strategy.findMany({
    include: { _count: { select: { trades: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(list.map(({ _count, ...s }) => ({ ...s, tradeCount: _count.trades })))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: '전략 이름은 필수입니다.' }, { status: 400 })

  const now = new Date().toISOString()
  const plannedDays = numOrNull(body.plannedDays)
  const strategy = await prisma.strategy.create({
    data: {
      id: crypto.randomUUID(),
      name,
      description: body.description?.trim() || null,
      targetPct: numOrNull(body.targetPct),
      stopLossPct: numOrNull(body.stopLossPct),
      plannedDays: plannedDays != null ? Math.round(plannedDays) : null,
      seedMoney: numOrNull(body.seedMoney),
      feePct: numOrNull(body.feePct),
      createdAt: now,
      updatedAt: now,
    },
  })
  return NextResponse.json({ ...strategy, tradeCount: 0 }, { status: 201 })
}
