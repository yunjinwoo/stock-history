import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enrichCoinTrade, uuid } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const trades = await prisma.coinTrade.findMany({
    where: { ...(search ? { symbol: { contains: search } } : {}) },
    include: { buyEntries: { orderBy: { date: 'asc' } }, sellEntries: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

  let enriched = trades.map(enrichCoinTrade)
  if (status === '보유중') enriched = enriched.filter(t => !t.isCompleted)
  if (status === '매도완료') enriched = enriched.filter(t => t.isCompleted)

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { symbol, comment, buyEntries = [], sellEntries = [] } = body

  if (!symbol) return NextResponse.json({ error: '종목명은 필수입니다.' }, { status: 400 })
  if (buyEntries.length === 0 && sellEntries.length === 0)
    return NextResponse.json({ error: '매수 또는 매도 내역을 하나 이상 입력해주세요.' }, { status: 400 })

  const now = new Date().toISOString()
  const makeEntries = (entries: { date: string; price: number; quantity: number }[]) =>
    entries.map(e => ({ id: uuid(), date: e.date, price: Number(e.price), quantity: Number(e.quantity), createdAt: now }))

  const existing = await prisma.coinTrade.findFirst({ where: { symbol } })

  let trade
  if (existing) {
    await prisma.coinBuyEntry.createMany({ data: makeEntries(buyEntries).map(e => ({ ...e, tradeId: existing.id })) })
    await prisma.coinSellEntry.createMany({ data: makeEntries(sellEntries).map(e => ({ ...e, tradeId: existing.id })) })
    await prisma.coinTrade.update({ where: { id: existing.id }, data: { updatedAt: now } })
    trade = await prisma.coinTrade.findUnique({
      where: { id: existing.id },
      include: { buyEntries: { orderBy: { date: 'asc' } }, sellEntries: { orderBy: { date: 'asc' } } },
    })
  } else {
    trade = await prisma.coinTrade.create({
      data: {
        id: uuid(), symbol, comment: comment || null, createdAt: now, updatedAt: now,
        buyEntries: { create: makeEntries(buyEntries) },
        sellEntries: { create: makeEntries(sellEntries) },
      },
      include: { buyEntries: true, sellEntries: true },
    })
  }

  return NextResponse.json(enrichCoinTrade(trade!), { status: 201 })
}
