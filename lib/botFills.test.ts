import { describe, it, expect } from 'vitest'
import { matchBotFills, type BotFill, type JournalEntry } from './botFills'

function fill(id: number, side: '매수' | '매도', at: string, qty: number): BotFill {
  return {
    id, at, side, decision: side === '매수' ? 'BUY' : 'SELL', price: 1, qty, amount_krw: qty,
    reason: null, reason_label: null, regime: null,
  }
}

describe('matchBotFills', () => {
  it('시각(±3분)과 수량이 맞는 행을 짝짓는다', () => {
    const entries: JournalEntry[] = [
      { key: 'a', type: '매수', date: '2026-09-24T13:26:00', quantity: 4.74214582 },
      { key: 'b', type: '매도', date: '2026-09-24T16:13:00', quantity: 4.74214582 },
    ]
    const m = matchBotFills(entries, [fill(1, '매수', '2026-09-24 13:25:41', 4.74214582), fill(2, '매도', '2026-09-24 16:14:10', 4.742)])
    expect(m.get('a')?.id).toBe(1)
    expect(m.get('b')?.id).toBe(2)
  })

  it('매수/매도가 다르면 짝짓지 않는다', () => {
    const entries: JournalEntry[] = [{ key: 'a', type: '매도', date: '2026-09-24T13:26:00', quantity: 1 }]
    expect(matchBotFills(entries, [fill(1, '매수', '2026-09-24 13:26:00', 1)]).size).toBe(0)
  })

  it('3분 넘게 차이 나면 짝짓지 않는다(수동 매매)', () => {
    const entries: JournalEntry[] = [{ key: 'a', type: '매수', date: '2026-09-24T13:30:00', quantity: 1 }]
    expect(matchBotFills(entries, [fill(1, '매수', '2026-09-24 13:20:00', 1)]).size).toBe(0)
  })

  it('업비트가 나눠 보여준 체결 여러 줄의 합이 앱 주문 1건과 맞으면 전부 짝짓는다', () => {
    const entries: JournalEntry[] = [
      { key: 'a', type: '매수', date: '2026-09-24T13:45:00', quantity: 410.17775229 },
      { key: 'b', type: '매수', date: '2026-09-24T13:45:00', quantity: 498.9131568 },
    ]
    const m = matchBotFills(entries, [fill(1, '매수', '2026-09-24 13:45:12', 909.09090909)])
    expect(m.get('a')?.id).toBe(1)
    expect(m.get('b')?.id).toBe(1)
  })

  it('시각이 없는(00:00:00) 행은 같은 날짜로만 비교한다', () => {
    const entries: JournalEntry[] = [{ key: 'a', type: '매수', date: '2026-09-20T00:00:00', quantity: 4.2583392 }]
    const m = matchBotFills(entries, [fill(1, '매수', '2026-09-20 15:25:00', 4.2583392), fill(2, '매수', '2026-09-21 00:01:00', 4.2583392)])
    expect(m.get('a')?.id).toBe(1)
  })

  it('한 행은 한 체결에만 짝지어진다', () => {
    const entries: JournalEntry[] = [{ key: 'a', type: '매수', date: '2026-09-24T09:00:00', quantity: 1 }]
    const m = matchBotFills(entries, [fill(1, '매수', '2026-09-24 09:00:00', 1), fill(2, '매수', '2026-09-24 09:01:00', 1)])
    expect(m.get('a')?.id).toBe(1)
    expect(m.size).toBe(1)
  })
})
