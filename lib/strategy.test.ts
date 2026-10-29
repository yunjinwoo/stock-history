import { describe, it, expect } from 'vitest'
import { applyFee, buildCycles, findDeviations, summarizeCycles, type CycleTradeInput } from './strategy'

function trade(id: string, buy: string, sell: string | null, profitRate: number, holdingDays: number): CycleTradeInput {
  return {
    id,
    symbol: id,
    profitAmount: profitRate * 1000,
    profitRate,
    holdingDays,
    isCompleted: sell != null,
    buyEntries: [{ date: buy }],
    sellEntries: sell ? [{ date: sell }] : [],
    createdAt: buy,
  }
}

// 엑셀 '10일 스윙' 기본값
const swing = { targetPct: 2.5, stopLossPct: 1.5, plannedDays: 10, feePct: 0.15 }

describe('applyFee', () => {
  it('엑셀 시뮬레이션과 같은 실질 수익률', () => {
    expect(applyFee(2.5, 0.15)).toBeCloseTo(2.34625, 5)
    expect(applyFee(-1.5, 0.15)).toBeCloseTo(-1.64775, 5)
  })
  it('수수료 없으면 그대로', () => {
    expect(applyFee(3, null)).toBeCloseTo(3, 10)
  })
})

describe('findDeviations', () => {
  it('목표 달성', () => {
    expect(findDeviations({ profitRate: 3, holdingDays: 8, isCompleted: true }, swing)).toEqual(['목표 달성'])
  })
  it('목표 전에 익절하면 조기 익절', () => {
    expect(findDeviations({ profitRate: 1, holdingDays: 2, isCompleted: true }, swing)).toEqual(['조기 익절'])
  })
  it('손절선을 넘겨 잃고 오래 들고 가면 둘 다 표시', () => {
    expect(findDeviations({ profitRate: -6, holdingDays: 15, isCompleted: true }, swing)).toEqual(['보유 초과', '손절 늦음'])
  })
  it('손절선 안쪽 손실은 이탈 아님', () => {
    expect(findDeviations({ profitRate: -1.2, holdingDays: 5, isCompleted: true }, swing)).toEqual([])
  })
  it('보유중이면 보유일만 본다', () => {
    expect(findDeviations({ profitRate: 0, holdingDays: 12, isCompleted: false }, swing)).toEqual(['보유 초과'])
  })
  it('규칙이 없으면 아무것도 표시 안 함', () => {
    expect(findDeviations({ profitRate: -10, holdingDays: 100, isCompleted: true }, {})).toEqual([])
  })
})

describe('buildCycles', () => {
  const trades = [
    trade('b', '2026-01-11', '2026-01-20', -1.5, 9),
    trade('a', '2026-01-01', '2026-01-09', 2.5, 8),
    trade('open', '2026-01-21', null, 0, 3),
    trade('c', '2026-01-21', '2026-01-30', 2.5, 9),
  ]

  it('완료 거래만 매도일 순으로 회차를 매긴다', () => {
    const cycles = buildCycles(trades, swing)
    expect(cycles.map(c => [c.no, c.trade.id])).toEqual([[1, 'a'], [2, 'b'], [3, 'c']])
    expect(cycles[0].startDate).toBe('2026-01-01')
    expect(cycles[0].endDate).toBe('2026-01-09')
  })

  it('계획대로 매매했으면 실제와 계획 누적이 같다', () => {
    const cycles = buildCycles(trades, swing)
    const expected = (1.0234625 * 0.9835225 * 1.0234625 - 1) * 100
    expect(cycles[2].cumRate).toBeCloseTo(expected, 6)
    expect(cycles[2].planCumRate).toBeCloseTo(expected, 6)
  })

  it('손절을 늦게 하면 실제 누적이 계획보다 낮다', () => {
    const cycles = buildCycles([trade('x', '2026-01-01', '2026-01-05', -6, 4)], swing)
    expect(cycles[0].cumRate).toBeLessThan(cycles[0].planCumRate)
    expect(cycles[0].planCumRate).toBeCloseTo(applyFee(-1.5, 0.15), 6)
  })

  it('빈 목록', () => {
    expect(buildCycles([], swing)).toEqual([])
  })
})

describe('summarizeCycles', () => {
  it('승률·이탈 없는 비율·최종 금액', () => {
    const cycles = buildCycles([
      trade('a', '2026-01-01', '2026-01-09', 3, 8),
      trade('b', '2026-01-11', '2026-01-20', -5, 9),
    ], swing)
    const s = summarizeCycles(cycles, 5_000_000)
    expect(s.count).toBe(2)
    expect(s.wins).toBe(1)
    expect(s.winRate).toBe(50)
    expect(s.adherenceRate).toBe(50)
    expect(s.finalAmount).toBeCloseTo(5_000_000 * (1 + cycles[1].cumRate / 100), 4)
  })

  it('회차가 없으면 0, 시드가 없으면 금액 없음', () => {
    const s = summarizeCycles([], null)
    expect(s).toMatchObject({ count: 0, winRate: 0, cumRate: 0, finalAmount: null })
  })
})
