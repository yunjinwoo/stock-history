import { describe, it, expect } from 'vitest'
import { evaluateTrade, periodRange, summarizeReview, lastSellDay, type ReviewTradeInput } from './review'

// 매수 10,000원 기준 거래. sells: [가격, 수량][]
function trade(sells: [number, number][], opts: Partial<ReviewTradeInput> & { buyQty?: number } = {}): ReviewTradeInput {
  const buyQty = opts.buyQty ?? sells.reduce((s, [, q]) => s + q, 0)
  const avgBuyPrice = 10000
  const sellQty = sells.reduce((s, [, q]) => s + q, 0)
  const sellAmount = sells.reduce((s, [p, q]) => s + p * q, 0)
  const profitAmount = sellAmount - avgBuyPrice * sellQty
  return {
    targetPrice: 11000,
    stopLossPrice: 9500,
    plannedHoldingPeriod: '1주일',
    planExceeded: false,
    exitReason: null,
    isCompleted: sellQty >= buyQty && buyQty > 0,
    avgBuyPrice,
    profitAmount,
    profitRate: sellQty > 0 ? (profitAmount / (avgBuyPrice * sellQty)) * 100 : 0,
    sellEntries: sells.map(([price, quantity], i) => ({ date: `2026-11-1${i}T10:00:00`, price, quantity })),
    ...opts,
  }
}

describe('evaluateTrade', () => {
  it('목표가에 팔면 계획 준수 + 좋은 매매', () => {
    const r = evaluateTrade(trade([[11200, 10]]))
    expect(r.targetHit).toBe(true)
    expect(r.finalTargetMet).toBe(true)
    expect(r.status).toBe('followed')
    expect(r.quadrant).toBe('good')
  })

  it('부분 매도만 목표가 도달 — 도달과 최종 달성을 구분', () => {
    const r = evaluateTrade(trade([[11000, 5], [10200, 5]]))
    expect(r.targetHit).toBe(true)
    expect(r.finalTargetMet).toBe(false)
    expect(r.avgSellPrice).toBe(10600)
  })

  it('보유기간 초과 수익 거래 → 운 좋은 매매', () => {
    const r = evaluateTrade(trade([[10300, 10]], { planExceeded: true }))
    expect(r.deviations).toEqual(['보유 초과'])
    expect(r.quadrant).toBe('lucky')
  })

  it('손절가 근처(허용폭 1%p 안)에서 손절 → 좋은 손실', () => {
    // 손절가 9,500 / 허용폭 100원 → 9,400까지 준수
    const r = evaluateTrade(trade([[9400, 10]]))
    expect(r.stopHit).toBe(true)
    expect(r.deviations).toEqual([])
    expect(r.quadrant).toBe('goodLoss')
  })

  it('손절가보다 한참 아래에서 팔면 손절 늦음 → 나쁜 매매', () => {
    const r = evaluateTrade(trade([[8800, 10]]))
    expect(r.deviations).toEqual(['손절 늦음'])
    expect(r.quadrant).toBe('bad')
  })

  it('목표 전 공포·조기 매도로 판 수익 거래는 조기 익절', () => {
    expect(evaluateTrade(trade([[10300, 10]], { exitReason: '공포' })).deviations).toEqual(['조기 익절'])
    expect(evaluateTrade(trade([[10300, 10]], { exitReason: '조기 매도' })).deviations).toEqual(['조기 익절'])
    // 추세 이탈로 판 건 계획 이탈이 아님
    expect(evaluateTrade(trade([[10300, 10]], { exitReason: '추세 이탈' })).deviations).toEqual([])
  })

  it('계획이 하나도 없으면 noPlan, 매트릭스에서 제외', () => {
    const r = evaluateTrade(trade([[10300, 10]], { targetPrice: null, stopLossPrice: null, plannedHoldingPeriod: null, planExceeded: null }))
    expect(r.status).toBe('noPlan')
    expect(r.quadrant).toBeNull()
    expect(r.targetHit).toBeNull()
    expect(r.stopHit).toBeNull()
  })

  it('보유중 거래는 매트릭스에 넣지 않음', () => {
    const r = evaluateTrade(trade([[10300, 5]], { buyQty: 10 }))
    expect(r.quadrant).toBeNull()
  })

  it('청산 이유가 목표가 도달인데 실제로 도달 못했으면 경고', () => {
    expect(evaluateTrade(trade([[10300, 10]], { exitReason: '목표가 도달' })).exitReasonMismatch).not.toBeNull()
    expect(evaluateTrade(trade([[11000, 10]], { exitReason: '목표가 도달' })).exitReasonMismatch).toBeNull()
  })

  it('매도 내역이 없으면 도달 판정 없음', () => {
    const r = evaluateTrade(trade([], { buyQty: 10 }))
    expect(r.targetHit).toBeNull()
    expect(r.avgSellPrice).toBeNull()
  })
})

describe('summarizeReview', () => {
  const list = [
    trade([[11200, 10]]),                       // good  +12%
    trade([[10300, 10]], { planExceeded: true }), // lucky +3%
    trade([[9400, 10]]),                        // goodLoss -6%
    trade([[8800, 10]]),                        // bad -12%
    trade([[10500, 10]], { targetPrice: null, stopLossPrice: null, plannedHoldingPeriod: null, planExceeded: null }), // noPlan +5%
  ].map(t => ({ ...t, review: evaluateTrade(t) }))
  const s = summarizeReview(list)

  it('기본 성과', () => {
    expect(s.count).toBe(5)
    expect(s.winRate).toBe(60)
    expect(s.avgWinRate).toBeCloseTo((12 + 3 + 5) / 3, 5)
    expect(s.avgLossRate).toBeCloseTo(-9, 5)
    expect(s.payoffRatio).toBeCloseTo((20 / 3) / 9, 5)
    expect(s.expectancyRate).toBeCloseTo((12 + 3 - 6 - 12 + 5) / 5, 5)
  })

  it('계획 준수율은 계획 있는 거래만 분모', () => {
    expect(s.plannedCount).toBe(4)
    expect(s.noPlanCount).toBe(1)
    expect(s.adherenceRate).toBe(50)
  })

  it('매트릭스·준수/이탈·손절 비교', () => {
    expect(s.quadrants.good.count).toBe(1)
    expect(s.quadrants.lucky.count).toBe(1)
    expect(s.quadrants.goodLoss.count).toBe(1)
    expect(s.quadrants.bad.count).toBe(1)
    expect(s.followed.avgRate).toBeCloseTo(3, 5)
    expect(s.deviated.avgRate).toBeCloseTo(-4.5, 5)
    expect(s.stopKeptLoss.avgRate).toBeCloseTo(-6, 5)
    expect(s.lateStopLoss.avgRate).toBeCloseTo(-12, 5)
    expect(s.deviationCounts).toEqual({ '보유 초과': 1, '손절 늦음': 1, '조기 익절': 0 })
  })

  it('빈 목록', () => {
    const e = summarizeReview([])
    expect(e.count).toBe(0)
    expect(e.winRate).toBeNull()
    expect(e.adherenceRate).toBeNull()
    expect(e.payoffRatio).toBeNull()
  })
})

describe('periodRange', () => {
  const thu = new Date(2026, 10, 19) // 2026-11-19 목
  it('이번 주는 월~일', () => {
    expect(periodRange('week', thu)).toEqual({ start: '2026-11-16', end: '2026-11-22' })
    expect(periodRange('week', new Date(2026, 10, 22))).toEqual({ start: '2026-11-16', end: '2026-11-22' }) // 일요일
  })
  it('이번 달·지난달', () => {
    expect(periodRange('month', thu)).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(periodRange('lastMonth', thu)).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(periodRange('lastMonth', new Date(2026, 0, 5))).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })
})

describe('lastSellDay', () => {
  it('가장 늦은 매도일', () => {
    expect(lastSellDay({ sellEntries: [{ date: '2026-11-03T09:00:00' }, { date: '2026-11-10T15:00:00' }] })).toBe('2026-11-10')
    expect(lastSellDay({ sellEntries: [] })).toBeNull()
  })
})
