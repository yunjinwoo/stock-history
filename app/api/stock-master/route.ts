import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const list = await prisma.stockMaster.findMany({ orderBy: { symbol: 'asc' } })
  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const { symbol, symbolCode } = await req.json()
  if (!symbol || !symbolCode) {
    return NextResponse.json({ error: '종목명과 종목코드는 필수입니다.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const master = await prisma.stockMaster.upsert({
    where: { symbol },
    create: { id: crypto.randomUUID(), symbol: symbol.trim(), symbolCode: symbolCode.trim(), createdAt: now, updatedAt: now },
    update: { symbolCode: symbolCode.trim(), updatedAt: now },
  })

  // 기존 trades 중 같은 symbol 이면서 symbolCode 없는 것 일괄 업데이트
  await prisma.trade.updateMany({
    where: { symbol: master.symbol, symbolCode: null },
    data: { symbolCode: master.symbolCode, updatedAt: now },
  })

  return NextResponse.json(master, { status: 201 })
}
