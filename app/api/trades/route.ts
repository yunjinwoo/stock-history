import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichTrade } from '@/lib/utils'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where: Prisma.TradeWhereInput = {}
  if (accountId) where.accountId = accountId
  if (status === '보유중') where.sellDate = null
  if (status === '매도완료') where.sellDate = { not: null }
  if (search) where.symbol = { contains: search }

  const trades = await prisma.trade.findMany({ where, orderBy: { buyDate: 'desc' } })
  return NextResponse.json(trades.map(enrichTrade))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { accountId, symbol, symbolCode, buyDate, buyPrice, buyQuantity,
          sellDate, sellPrice, sellQuantity, comment } = body

  if (!accountId || !symbol || !buyDate || !buyPrice || !buyQuantity) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const trade = await prisma.trade.create({
    data: {
      id: crypto.randomUUID(),
      accountId, symbol,
      symbolCode: symbolCode || null,
      buyDate, buyPrice: Number(buyPrice), buyQuantity: Number(buyQuantity),
      sellDate: sellDate || null,
      sellPrice: sellPrice ? Number(sellPrice) : null,
      sellQuantity: sellQuantity ? Number(sellQuantity) : null,
      comment: comment || null,
      createdAt: now, updatedAt: now,
    },
  })
  return NextResponse.json(enrichTrade(trade), { status: 201 })
}
