import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()
  const account = await prisma.account.update({
    where: { id },
    data: {
      ...(body.broker !== undefined && { broker: body.broker }),
      ...(body.accountNumber !== undefined && { accountNumber: body.accountNumber }),
      ...('nickname' in body && { nickname: body.nickname || null }),
      ...('memo' in body && { memo: body.memo || null }),
      updatedAt: now,
    },
  })
  return NextResponse.json(account)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const count = await prisma.trade.count({ where: { accountId: id } })
  if (count > 0) {
    return NextResponse.json(
      { error: `연결된 거래 ${count}건이 있습니다. 먼저 거래를 삭제해주세요.` },
      { status: 409 }
    )
  }
  await prisma.account.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
