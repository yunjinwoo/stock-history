// upbit-alert(같은 서버의 자동매매 앱)가 남긴 체결 기록 — /api/coin-bot-fills가 upbit-alert의
// /api/journal/fills를 그대로 전달한다. 필드 설명은 upbit-alert docs/trade-journal-api.md 참고.
export interface BotRegime { key: 'good' | 'neutral' | 'bad'; label: string }

export interface BotFill {
  id: number
  at: string               // 'YYYY-MM-DD HH:MM:SS' (서버 시각, KST)
  side: '매수' | '매도'
  decision: 'BUY' | 'DCA_BUY' | 'SELL'
  price: number | null
  qty: number | null
  amount_krw: number | null
  reason: string | null
  reason_label: string | null
  regime: BotRegime | null
  // 매도만
  pnl_krw?: number | null
  pnl_pct?: number | null
  peak_pnl_pct?: number | null
  trough_pnl_pct?: number | null
  entry_regime?: BotRegime | null
}

export interface JournalEntry { key: string; type: '매수' | '매도'; date: string; quantity: number }

// 업비트 체결 시각과 앱 기록 시각은 수십 초~1분 정도 어긋난다
const WINDOW_MS = 3 * 60 * 1000
// 수량은 소수점 반올림 차이 정도만 허용
const QTY_TOLERANCE = 0.005

function toMs(s: string): number {
  return new Date(s.replace(' ', 'T')).getTime()
}

// 일지 날짜에 시각이 없으면(예전 수정 창은 'T00:00:00'으로 저장했다) 같은 날짜로만 비교한다
function hasTime(date: string): boolean {
  return date.length > 10 && date.slice(11, 19) !== '00:00:00'
}

function qtyClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(a, b) * QTY_TOLERANCE
}

function sameSlot(entry: JournalEntry, fill: BotFill): boolean {
  if (hasTime(entry.date)) return Math.abs(toMs(entry.date) - toMs(fill.at)) <= WINDOW_MS
  return entry.date.slice(0, 10) === fill.at.slice(0, 10)
}

/**
 * 앱 체결 ↔ 일지 행 짝 맞추기. 결과: 일지 행 key → 앱 체결.
 * 업비트는 시장가 주문 하나를 여러 체결로 나눠 보여주기도 해서(CVC 13:45 매수 2줄 = 앱 주문 1건),
 * 같은 시각대의 일지 행 하나가 수량이 맞으면 그 행을, 아니면 그 시각대 행들의 합이 맞을 때 전부를 짝짓는다.
 */
export function matchBotFills(entries: JournalEntry[], fills: BotFill[]): Map<string, BotFill> {
  const matched = new Map<string, BotFill>()
  for (const fill of fills) {
    if (fill.qty == null) continue
    const cands = entries.filter(e => e.type === fill.side && !matched.has(e.key) && sameSlot(e, fill))
    const single = cands.find(e => qtyClose(e.quantity, fill.qty!))
    if (single) { matched.set(single.key, fill); continue }
    const sum = cands.reduce((s, e) => s + e.quantity, 0)
    if (cands.length > 1 && qtyClose(sum, fill.qty)) cands.forEach(e => matched.set(e.key, fill))
  }
  return matched
}
