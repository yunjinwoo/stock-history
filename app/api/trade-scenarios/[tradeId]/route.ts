import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await params
  const scenario = await prisma.tradeScenario.findUnique({ where: { tradeId } })
  return NextResponse.json(scenario)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await params
  const body = await req.json()
  const { currentPrice, budget, targetProfit, rows } = body
  const now = new Date().toISOString()
  const rowsJson = JSON.stringify(rows ?? [])

  const scenario = await prisma.tradeScenario.upsert({
    where: { tradeId },
    create: { tradeId, currentPrice, budget, targetProfit, rowsJson, createdAt: now, updatedAt: now },
    update: { currentPrice, budget, targetProfit, rowsJson, updatedAt: now },
  })
  return NextResponse.json(scenario)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await params
  await prisma.tradeScenario.deleteMany({ where: { tradeId } })
  return NextResponse.json({ ok: true })
}
