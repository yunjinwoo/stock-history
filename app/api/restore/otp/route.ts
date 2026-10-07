import { NextResponse } from 'next/server'
import { issueRestoreOtp } from '@/lib/restoreAuth'

// 복원 인증번호를 슬랙으로 발송
export async function POST() {
  const r = await issueRestoreOtp()
  if (r.ok) return NextResponse.json({ ok: true, expiresAt: r.expiresAt })
  if (r.reason === 'not-configured') {
    return NextResponse.json({ error: '서버에 슬랙 웹훅이 설정되지 않아 인증번호를 보낼 수 없습니다.' }, { status: 503 })
  }
  if (r.reason === 'too-soon') {
    return NextResponse.json({ error: `${r.retryAfterSec}초 뒤에 다시 요청해주세요.` }, { status: 429 })
  }
  return NextResponse.json({ error: '슬랙 발송에 실패했습니다.' }, { status: 502 })
}
