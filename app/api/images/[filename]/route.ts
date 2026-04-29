import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const IMAGES_DIR = join(process.cwd(), '..', 'data', 'images')

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  // 경로 탐색 공격 방지
  if (filename.includes('/') || filename.includes('..')) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  try {
    const buffer = await readFile(join(IMAGES_DIR, filename))
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'png'
    return new NextResponse(buffer, {
      headers: { 'Content-Type': MIME[ext] ?? 'image/png' },
    })
  } catch {
    return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 })
  }
}
