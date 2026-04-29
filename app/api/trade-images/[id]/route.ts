import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { unlink } from 'fs/promises'
import { join } from 'path'

const IMAGES_DIR = join(process.cwd(), '..', 'data', 'images')

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const image = await prisma.tradeImage.findUnique({ where: { id } })
  if (!image) return NextResponse.json({ error: '없음' }, { status: 404 })

  await prisma.tradeImage.delete({ where: { id } })
  try {
    await unlink(join(IMAGES_DIR, image.filename))
  } catch {
    // 파일이 이미 없어도 DB 삭제는 완료
  }

  return NextResponse.json({ ok: true })
}
