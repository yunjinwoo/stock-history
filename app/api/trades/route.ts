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
  if (search) where.symbol = { contains: search }

  const trades = await prisma.trade.findMany({
    where,
    include: { buyEntries: { orderBy: { date: 'asc' } }, sellEntries: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

  let enriched = trades.map(enrichTrade)
  if (status === '보유중') enriched = enriched.filter(t => !t.isCompleted)
  if (status === '매도완료') enriched = enriched.filter(t => t.isCompleted)

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { accountId, symbol, symbolCode, comment, buyEntries = [], sellEntries = [] } = body

  if (!accountId || !symbol || buyEntries.length === 0) {
    return NextResponse.json({ error: '계좌, 종목명, 매수 내역은 필수입니다.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const makeEntries = (entries: { date: string; price: number; quantity: number }[]) =>
    entries.map(e => ({ id: crypto.randomUUID(), date: e.date, price: Number(e.price), quantity: Number(e.quantity), createdAt: now }))

  const trade = await prisma.trade.create({
    data: {
      id: crypto.randomUUID(),
      accountId, symbol,
      symbolCode: symbolCode || null,
      comment: comment || null,
      createdAt: now, updatedAt: now,
      buyEntries: { create: makeEntries(buyEntries) },
      sellEntries: { create: makeEntries(sellEntries) },
    },
    include: { buyEntries: true, sellEntries: true },
  })

  return NextResponse.json(enrichTrade(trade), { status: 201 })
}
