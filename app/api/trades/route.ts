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

type EntryInput = { date: string; price: number; quantity: number }

function makeEntries(entries: EntryInput[], now: string) {
  return entries.map(e => ({
    id: crypto.randomUUID(),
    date: e.date,
    price: Number(e.price),
    quantity: Number(e.quantity),
    createdAt: now,
  }))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { accountId, symbol, symbolCode, comment, buyEntries = [], sellEntries = [] } = body

  if (!accountId || !symbol || buyEntries.length === 0) {
    return NextResponse.json({ error: '계좌, 종목명, 매수 내역은 필수입니다.' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // 같은 계좌+종목 거래가 있으면 새 내역만 추가 (별도 레코드 생성 안 함)
  const existing = await prisma.trade.findFirst({ where: { accountId, symbol } })

  if (existing) {
    const trade = await prisma.trade.update({
      where: { id: existing.id },
      data: {
        symbolCode: symbolCode || existing.symbolCode || null,
        updatedAt: now,
        buyEntries: { create: makeEntries(buyEntries, now) },
        sellEntries: { create: makeEntries(sellEntries, now) },
      },
      include: { buyEntries: { orderBy: { date: 'asc' } }, sellEntries: { orderBy: { date: 'asc' } } },
    })
    return NextResponse.json(enrichTrade(trade), { status: 200 })
  }

  const trade = await prisma.trade.create({
    data: {
      id: crypto.randomUUID(),
      accountId, symbol,
      symbolCode: symbolCode || null,
      comment: comment || null,
      createdAt: now, updatedAt: now,
      buyEntries: { create: makeEntries(buyEntries, now) },
      sellEntries: { create: makeEntries(sellEntries, now) },
    },
    include: { buyEntries: true, sellEntries: true },
  })

  return NextResponse.json(enrichTrade(trade), { status: 201 })
}
