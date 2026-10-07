import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { exec } from 'child_process'
import path from 'path'
import { prisma } from '@/lib/db'
import { checkRestorePassword } from '@/lib/restoreAuth'

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const auth = checkRestorePassword(formData.get('password'))
  if (auth === 'not-configured') {
    return NextResponse.json({ error: '서버에 복원 비밀번호가 설정되지 않아 복원할 수 없습니다.' }, { status: 503 })
  }
  if (auth === 'wrong') {
    // 무작위 대입을 늦추기 위해 잠깐 대기
    await new Promise(r => setTimeout(r, 1000))
    return NextResponse.json({ error: '복원 비밀번호가 맞지 않습니다.' }, { status: 401 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

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
