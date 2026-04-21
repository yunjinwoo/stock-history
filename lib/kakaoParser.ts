export interface ParsedTrade {
  broker: string
  type: '매수' | '매도'
  symbol: string
  symbolCode?: string
  quantity: number
  price: number
  time?: string
  accountNumber?: string
}

const toNum = (s: string | undefined): number =>
  Number(s?.replace(/,/g, '') ?? '0')

function parseKoreaInvestment(text: string): ParsedTrade | null {
  const typeMatch = text.match(/\*매매구분:[현금\s]*(매수|매도)/)
  const symbolMatch = text.match(/\*종목명:(.+?)\((\d+)\)/)
  const qtyMatch = text.match(/\*체결수량:([\d,]+)주/)
  const priceMatch = text.match(/\*체결단가:([\d,]+)원/)
  const timeMatch = text.match(/체결안내\](\d{1,2}:\d{2})/)
  const accountMatch = text.match(/\*계좌번호:([^\n\r]+)/)

  if (!typeMatch || !symbolMatch || !qtyMatch || !priceMatch) return null

  return {
    broker: '한국투자증권',
    type: typeMatch[1] as '매수' | '매도',
    symbol: symbolMatch[1].trim(),
    symbolCode: symbolMatch[2],
    quantity: toNum(qtyMatch[1]),
    price: toNum(priceMatch[1]),
    time: timeMatch?.[1],
    accountNumber: accountMatch?.[1]?.trim(),
  }
}

function parseKB(text: string): ParsedTrade | null {
  const symbolMatch = text.match(/■ 종목명:\s*(.+)/)
  const qtyMatch = text.match(/■ 주문수량:\s*([\d,]+)주/)
  const priceMatch = text.match(/■ 체결금액:\s*([\d,]+)원/)
  const typeMatch = text.match(/■ 내용:\s*(매수|매도)체결/)
  const accountMatch = text.match(/■ 계좌:\s*([^\n\r]+)/)

  if (!symbolMatch || !qtyMatch || !priceMatch || !typeMatch) return null

  return {
    broker: 'KB증권',
    type: typeMatch[1] as '매수' | '매도',
    symbol: symbolMatch[1].trim(),
    quantity: toNum(qtyMatch[1]),
    price: toNum(priceMatch[1]),
    accountNumber: accountMatch?.[1]?.trim(),
  }
}

function parseUnknown083(text: string): ParsedTrade | null {
  const symbolMatch = text.match(/종목명\s*:\s*(.+)/)
  const codeMatch = text.match(/종목코드\s*:\s*(\d+)/)
  const typeMatch = text.match(/체결구분\s*:\s*(매수|매도)/)
  const qtyMatch = text.match(/체결수량\s*:\s*([\d,]+)주/)
  const priceMatch = text.match(/체결단가\s*:\s*([\d,]+)원/)
  const accountMatch = text.match(/계좌번호\s*:\s*([^\n\r]+)/)

  if (!symbolMatch || !typeMatch || !qtyMatch || !priceMatch) return null

  return {
    broker: '미확인증권',
    type: typeMatch[1] as '매수' | '매도',
    symbol: symbolMatch[1].trim(),
    symbolCode: codeMatch?.[1],
    quantity: toNum(qtyMatch[1]),
    price: toNum(priceMatch[1]),
    accountNumber: accountMatch?.[1]?.trim(),
  }
}

function parseKiwoom(text: string): ParsedTrade | null {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 3) return null

  const symbol = lines[1]
  const tradeMatch = lines[2]?.match(/(매수|매도)([\d,]+)주/)
  const priceMatch = lines[3]?.match(/평균단가([\d,]+)원/)

  if (!symbol || !tradeMatch || !priceMatch) return null

  return {
    broker: '키움증권',
    type: tradeMatch[1] as '매수' | '매도',
    symbol,
    quantity: toNum(tradeMatch[2]),
    price: toNum(priceMatch[1]),
  }
}

export function parseKakaoNotification(text: string): ParsedTrade | null {
  if (!text?.trim()) return null

  if (text.includes('한국투자증권 체결안내')) return parseKoreaInvestment(text)
  if (text.includes('[KB증권]')) return parseKB(text)
  if (text.includes('[키움]체결통보')) return parseKiwoom(text)
  if (text.includes('체결구분') && text.includes('체결단가') && !text.includes('[')) return parseUnknown083(text)

  return null
}
