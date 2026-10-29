import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { numOrNull } from '@/lib/utils'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  if (body.name !== undefined && !String(body.name).trim()) {
    return NextResponse.json({ error: '전략 이름은 필수입니다.' }, { status: 400 })
  }
  const plannedDays = numOrNull(body.plannedDays)

  const strategy = await prisma.strategy.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.targetPct !== undefined && { targetPct: numOrNull(body.targetPct) }),
      ...(body.stopLossPct !== undefined && { stopLossPct: numOrNull(body.stopLossPct) }),
      ...(body.plannedDays !== undefined && { plannedDays: plannedDays != null ? Math.round(plannedDays) : null }),
      ...(body.seedMoney !== undefined && { seedMoney: numOrNull(body.seedMoney) }),
      ...(body.feePct !== undefined && { feePct: numOrNull(body.feePct) }),
      updatedAt: new Date().toISOString(),
    },
  })
  return NextResponse.json(strategy)
}

// 삭제해도 거래는 남고 전략 지정만 풀린다 (onDelete: SetNull)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.strategy.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
