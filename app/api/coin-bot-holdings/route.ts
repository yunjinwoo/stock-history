import { NextResponse } from 'next/server'

// 같은 서버의 upbit-alert(Flask, 5000 포트)에 서버 안에서 직접 묻는다 — /api/coin-bot-fills와 같은 방식.
const UPBIT_ALERT_URL = process.env.UPBIT_ALERT_URL ?? 'http://127.0.0.1:5000'
const TOKEN = process.env.UPBIT_ALERT_JOURNAL_TOKEN ?? ''

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch(`${UPBIT_ALERT_URL}/api/journal/holdings`, {
      headers: TOKEN ? { 'X-Journal-Token': TOKEN } : {},
      cache: 'no-store',
      // 종목마다 현재가를 따로 조회해서 fills보다 오래 걸릴 수 있다
      signal: AbortSignal.timeout(15000),
    })
    const body = await res.json()
    if (!res.ok || body.status !== 'success')
      return NextResponse.json({ error: body.message ?? `upbit-alert 응답 ${res.status}` }, { status: 502 })
    return NextResponse.json({ holdings: body.holdings, current_preset: body.current_preset, cash_krw: body.cash_krw })
  } catch (e) {
    return NextResponse.json({ error: `upbit-alert에 연결하지 못했습니다: ${(e as Error).message}` }, { status: 502 })
  }
}
