import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const IMAGES_DIR = join(process.cwd(), '..', 'data', 'images')

export async function POST(req: NextRequest) {
  const tradeId = req.nextUrl.searchParams.get('tradeId')
  const memoId = req.nextUrl.searchParams.get('memoId')
  if (!tradeId && !memoId) return NextResponse.json({ error: 'tradeId 또는 memoId 필수' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp']
  if (!allowed.includes(ext)) return NextResponse.json({ error: '이미지 파일만 가능합니다.' }, { status: 400 })

  await mkdir(IMAGES_DIR, { recursive: true })
  const filename = `${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(join(IMAGES_DIR, filename), buffer)

  const now = new Date().toISOString()

  if (memoId) {
    const image = await prisma.memoImage.create({
      data: { id: crypto.randomUUID(), memoId, filename, createdAt: now },
    })
    return NextResponse.json(image, { status: 201 })
  }

  const image = await prisma.tradeImage.create({
    data: { id: crypto.randomUUID(), tradeId: tradeId!, filename, createdAt: now },
  })
  return NextResponse.json(image, { status: 201 })
}
