import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const accounts = await prisma.account.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const { broker, accountNumber, nickname, memo } = await req.json()
  if (!broker || !accountNumber) {
    return NextResponse.json({ error: '증권사명과 계좌번호는 필수입니다.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const account = await prisma.account.create({
    data: { id: crypto.randomUUID(), broker, accountNumber, nickname: nickname || null, memo: memo || null, createdAt: now, updatedAt: now },
  })
  return NextResponse.json(account, { status: 201 })
}
