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

  const existing = await prisma.coinTrade.findFirst({
    where: { symbol },
    include: { buyEntries: true, sellEntries: true },
  })

  const isDupBuy = (e: { date: string; price: number; quantity: number }) =>
    existing?.buyEntries.some(x => x.date === e.date && x.price === e.price && x.quantity === e.quantity) ?? false
  const isDupSell = (e: { date: string; price: number; quantity: number }) =>
    existing?.sellEntries.some(x => x.date === e.date && x.price === e.price && x.quantity === e.quantity) ?? false

  let trade
  if (existing) {
    const newBuys = makeEntries(buyEntries).filter(e => !isDupBuy(e))
    const newSells = makeEntries(sellEntries).filter(e => !isDupSell(e))
    if (newBuys.length > 0) await prisma.coinBuyEntry.createMany({ data: newBuys.map(e => ({ ...e, tradeId: existing.id })) })
    if (newSells.length > 0) await prisma.coinSellEntry.createMany({ data: newSells.map(e => ({ ...e, tradeId: existing.id })) })
    if (newBuys.length > 0 || newSells.length > 0)
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
