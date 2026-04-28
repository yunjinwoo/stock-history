import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichCoinTrade, uuid } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { symbol, type, date, price, quantity } = body

  if (!symbol || !type || !date || price == null || quantity == null)
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  if (type !== '매수' && type !== '매도')
    return NextResponse.json({ error: '구분은 매수 또는 매도여야 합니다.' }, { status: 400 })

  const now = new Date().toISOString()
  const p = Number(price)
  const q = Number(quantity)
  const entry = { id: uuid(), date, price: p, quantity: q, createdAt: now }

  const existing = await prisma.coinTrade.findFirst({ where: { symbol } })

  let trade
  if (existing) {
    const dupWhere = { tradeId: existing.id, date, price: p, quantity: q }
    const dup = type === '매수'
      ? await prisma.coinBuyEntry.findFirst({ where: dupWhere })
      : await prisma.coinSellEntry.findFirst({ where: dupWhere })
    if (!dup) {
      if (type === '매수') await prisma.coinBuyEntry.create({ data: { ...entry, tradeId: existing.id } })
      else await prisma.coinSellEntry.create({ data: { ...entry, tradeId: existing.id } })
      await prisma.coinTrade.update({ where: { id: existing.id }, data: { updatedAt: now } })
    }
    trade = await prisma.coinTrade.findUnique({
      where: { id: existing.id },
      include: { buyEntries: { orderBy: { date: 'asc' } }, sellEntries: { orderBy: { date: 'asc' } } },
    })
  } else {
    trade = await prisma.coinTrade.create({
      data: {
        id: uuid(), symbol, comment: null, createdAt: now, updatedAt: now,
        buyEntries: { create: type === '매수' ? [entry] : [] },
        sellEntries: { create: type === '매도' ? [entry] : [] },
      },
      include: { buyEntries: true, sellEntries: true },
    })
  }

  return NextResponse.json(enrichCoinTrade(trade!), { status: 201 })
}
