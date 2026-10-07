import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink } from 'fs/promises'
import { gunzipSync } from 'zlib'
import path from 'path'
import { BACKUP_DB_DIR, BACKUP_NAME_RE } from '@/lib/backups'

type Params = { params: Promise<{ name: string }> }

// 압축을 풀어 .db 로 내려줌 → '백업 파일로 복원'에 바로 쓸 수 있음
export async function GET(_req: NextRequest, { params }: Params) {
  const { name } = await params
  if (!BACKUP_NAME_RE.test(name)) return NextResponse.json({ error: '잘못된 파일 이름' }, { status: 400 })
  try {
    const db = gunzipSync(await readFile(path.join(BACKUP_DB_DIR, name)))
    return new NextResponse(db, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name.replace(/\.gz$/, '')}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { name } = await params
  if (!BACKUP_NAME_RE.test(name)) return NextResponse.json({ error: '잘못된 파일 이름' }, { status: 400 })
  try {
    await unlink(path.join(BACKUP_DB_DIR, name))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
  }
}
