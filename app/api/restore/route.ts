import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { exec } from 'child_process'
import path from 'path'
import { prisma } from '@/lib/db'
import { verifyRestoreOtp } from '@/lib/restoreAuth'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const auth = verifyRestoreOtp(formData.get('otp'))
  if (auth !== 'ok') {
    // 무작위 대입을 늦추기 위해 잠깐 대기
    if (auth === 'wrong') await new Promise(r => setTimeout(r, 1000))
    const msg = auth === 'wrong' ? '인증번호가 맞지 않습니다.' : auth === 'expired' ? '인증번호가 만료됐습니다. 다시 받아주세요.' : '먼저 인증번호를 받아주세요.'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const dbPath = path.resolve(process.cwd(), 'data/stock-history.db')

  await prisma.$disconnect()
  writeFileSync(dbPath, buffer)

  await new Promise<void>((resolve, reject) => {
    exec(
      'prisma db push --schema=prisma/schema.prisma --accept-data-loss',
      { cwd: process.cwd() },
      (err) => (err ? reject(err) : resolve()),
    )
  })

  return NextResponse.json({ ok: true })
}
