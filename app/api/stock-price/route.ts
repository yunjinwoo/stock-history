import { NextRequest, NextResponse } from 'next/server'

// 같은 서버의 upbit-alert(Flask, 5000 포트)에 nginx를 거치지 않고 직접 묻는다 — /api/coin-bot-holdings와 같은 방식.
// nginx(/upbit/)를 거치면 upbit-alert 로그인 잠금이 켜져 있을 때 401로 막힌다.
const UPBIT_ALERT_URL = process.env.UPBIT_ALERT_URL ?? 'http://127.0.0.1:5000'

export async function GET(req: NextRequest) {
  const codes = req.nextUrl.searchParams.get('codes')
  if (!codes) return NextResponse.json({ error: 'codes 파라미터가 필요합니다.' }, { status: 400 })

  try {
    const res = await fetch(`${UPBIT_ALERT_URL}/api/stock-price?codes=${encodeURIComponent(codes)}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const detail = body?.message ? ` — ${body.message}` : ''
      return NextResponse.json({ error: `현재가 조회 실패 (upbit-alert ${res.status}${detail})` }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: '현재가 서버에 연결할 수 없습니다.' }, { status: 502 })
  }
}
