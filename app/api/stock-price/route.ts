import { NextRequest, NextResponse } from 'next/server'

const UPSTREAM_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000/api/stock-price'
  : 'http://localhost/upbit/api/stock-price'

export async function GET(req: NextRequest) {
  const codes = req.nextUrl.searchParams.get('codes')
  if (!codes) return NextResponse.json({ error: 'codes 파라미터가 필요합니다.' }, { status: 400 })

  try {
    const res = await fetch(`${UPSTREAM_URL}?codes=${encodeURIComponent(codes)}`)
    if (!res.ok) return NextResponse.json({ error: '현재가 조회 실패' }, { status: 502 })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: '현재가 서버에 연결할 수 없습니다.' }, { status: 502 })
  }
}
