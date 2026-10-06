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

// 여러 알림이 한 번에 붙여넣어졌을 때 각 알림의 시작 위치를 찾는 헤더 패턴
const HEADER_PATTERNS = [/\[한국투자증권 체결안내\]/g, /\[KB증권\]/g, /\[키움\]체결통보/g]

function splitNotifications(text: string): string[] {
  const starts = new Set<number>()
  for (const re of HEADER_PATTERNS) {
    for (const m of text.matchAll(re)) starts.add(m.index!)
  }
  // 083계열은 헤더가 없어 첫 줄(계좌명, 없으면 계좌번호)을 시작점으로 사용
  const unknownStart = /^계좌명\s*:/m.test(text) ? /^계좌명\s*:/gm : /^계좌번호\s*:/gm
  for (const m of text.matchAll(unknownStart)) starts.add(m.index!)

  const sorted = [...starts].sort((a, b) => a - b)
  if (sorted.length === 0) return [text]
  return sorted.map((start, i) => text.slice(start, sorted[i + 1] ?? text.length))
}

/** 여러 건의 알림을 한 번에 파싱. 인식 못한 조각은 건너뜀 (실패 시 빈 배열) */
export function parseKakaoNotifications(text: string): ParsedTrade[] {
  if (!text?.trim()) return []
  return splitNotifications(text)
    .map(chunk => parseKakaoNotification(chunk))
    .filter((r): r is ParsedTrade => r !== null)
}

/** 파싱된 계좌번호(마스킹 포함)·증권사로 등록된 계좌를 찾음. 못 찾으면 undefined */
export function matchAccountId(
  accounts: { id: string; broker: string; accountNumber: string }[],
  parsed: Pick<ParsedTrade, 'broker' | 'accountNumber'>,
): string | undefined {
  if (parsed.accountNumber) {
    const head = parsed.accountNumber.replace(/\*/g, '').slice(0, 4)
    const matched = head.length >= 2 ? accounts.find(a => a.accountNumber.includes(head)) : undefined
    if (matched) return matched.id
  }
  const sameBroker = accounts.filter(a => a.broker.replace(/\s/g, '').includes(parsed.broker.replace(/증권$/, '')))
  return sameBroker.length === 1 ? sameBroker[0].id : undefined
}
