import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols')
  if (!symbols) return NextResponse.json({ error: 'symbols 파라미터가 필요합니다.' }, { status: 400 })

  const markets = symbols.split(',').filter(Boolean).map(s => `KRW-${s}`).join(',')

  try {
    const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`)
    if (!res.ok) return NextResponse.json({ error: '현재가 조회 실패' }, { status: 502 })
    const data = await res.json()
    if (!Array.isArray(data)) return NextResponse.json({ error: '현재가 조회 실패' }, { status: 502 })

    const result = data.map(item => ({
      symbol: String(item.market).replace('KRW-', ''),
      price: item.trade_price,
      changeRate: item.signed_change_rate * 100,
    }))
    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ error: '업비트 서버에 연결할 수 없습니다.' }, { status: 502 })
  }
}
