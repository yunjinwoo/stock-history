import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 여러 거래의 전략을 한 번에 지정/해제 (strategyId: null 이면 해제)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const tradeIds: string[] = Array.isArray(body?.tradeIds) ? body.tradeIds.filter((x: unknown) => typeof x === 'string') : []
  const strategyId: string | null = body?.strategyId || null

  if (tradeIds.length === 0) {
    return NextResponse.json({ error: '거래를 하나 이상 선택해주세요.' }, { status: 400 })
  }
  if (strategyId && !(await prisma.strategy.findUnique({ where: { id: strategyId } }))) {
    return NextResponse.json({ error: '없는 전략입니다.' }, { status: 404 })
  }

  const { count } = await prisma.trade.updateMany({
    where: { id: { in: tradeIds } },
    data: { strategyId, updatedAt: new Date().toISOString() },
  })
  return NextResponse.json({ count })
}
