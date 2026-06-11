import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { exec } from 'child_process'
import path from 'path'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
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
