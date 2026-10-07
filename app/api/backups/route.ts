import { NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import { BACKUP_DB_DIR, BACKUP_NAME_RE } from '@/lib/backups'

export const dynamic = 'force-dynamic'

// 서버 자동 백업(scripts/backup.sh) 파일 목록, 최신순
export async function GET() {
  let names: string[] = []
  try {
    names = (await readdir(BACKUP_DB_DIR)).filter(n => BACKUP_NAME_RE.test(n))
  } catch {
    return NextResponse.json({ files: [] })
  }
  const files = await Promise.all(names.map(async name => {
    const s = await stat(path.join(BACKUP_DB_DIR, name))
    return { name, size: s.size, createdAt: s.mtime.toISOString() }
  }))
  files.sort((a, b) => b.name.localeCompare(a.name))
  return NextResponse.json({ files })
}
