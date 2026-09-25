import { NextRequest, NextResponse } from 'next/server'

// 같은 서버의 upbit-alert(Flask, 5000 포트)에 서버 안에서 직접 묻는다 — upbit-alert는 루프백 요청만 받는다.
const UPBIT_ALERT_URL = process.env.UPBIT_ALERT_URL ?? 'http://127.0.0.1:5000'
const TOKEN = process.env.UPBIT_ALERT_JOURNAL_TOKEN ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol이 필요합니다.' }, { status: 400 })

  const qs = new URLSearchParams({ symbol, mode: 'live' })
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (from) qs.set('from', from)
  if (to) qs.set('to', to)

  try {
    const res = await fetch(`${UPBIT_ALERT_URL}/api/journal/fills?${qs}`, {
      headers: TOKEN ? { 'X-Journal-Token': TOKEN } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const body = await res.json()
    if (!res.ok || body.status !== 'success')
      return NextResponse.json({ error: body.message ?? `upbit-alert 응답 ${res.status}` }, { status: 502 })
    return NextResponse.json({ fills: body.fills })
  } catch (e) {
    return NextResponse.json({ error: `upbit-alert에 연결하지 못했습니다: ${(e as Error).message}` }, { status: 502 })
  }
}
