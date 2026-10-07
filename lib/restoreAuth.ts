import { readFileSync } from 'fs'
import { timingSafeEqual, createHash } from 'crypto'
import os from 'os'
import path from 'path'

// 복원 비밀번호: 환경변수 RESTORE_PASSWORD, 없으면 서버의 ~/stock-history/.restore-password 파일
// (배포 시 GitHub Secret RESTORE_PASSWORD 로 이 파일을 만듦 — deploy.yml)
export function getRestorePassword(): string | null {
  if (process.env.RESTORE_PASSWORD) return process.env.RESTORE_PASSWORD
  try {
    const p = readFileSync(path.join(os.homedir(), 'stock-history', '.restore-password'), 'utf8').trim()
    return p || null
  } catch {
    return null
  }
}

export function checkRestorePassword(input: unknown): 'ok' | 'not-configured' | 'wrong' {
  const expected = getRestorePassword()
  if (!expected) return 'not-configured'
  if (typeof input !== 'string' || !input) return 'wrong'
  // 길이와 무관하게 상수 시간 비교
  const a = createHash('sha256').update(input).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b) ? 'ok' : 'wrong'
}
