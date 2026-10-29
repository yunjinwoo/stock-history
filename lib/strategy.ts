import type { Strategy } from './types'

// 회차 계산에 필요한 거래 필드만 (enrichTrade 결과의 부분집합)
export interface CycleTradeInput {
  id: string
  symbol: string
  profitAmount: number
  profitRate: number
  holdingDays: number
  isCompleted: boolean
  buyEntries: { date: string }[]
  sellEntries: { date: string }[]
  createdAt: string
}

type StrategyRules = Pick<Strategy, 'targetPct' | 'stopLossPct' | 'plannedDays' | 'feePct'>

export type Deviation = '보유 초과' | '손절 늦음' | '조기 익절' | '목표 달성'

// '목표 달성'만 좋은 표시, 나머지는 계획 이탈
export const BAD_DEVIATIONS: Deviation[] = ['보유 초과', '손절 늦음', '조기 익절']

export interface Cycle<T extends CycleTradeInput = CycleTradeInput> {
  no: number
  trade: T
  startDate: string
  endDate: string
  win: boolean
  netRate: number         // 수수료 반영 수익률 (%)
  cumRate: number         // 실제 누적 복리 수익률 (%)
  planCumRate: number     // 승패는 같고 목표/손절 비율대로 했다면의 누적 복리 수익률 (%)
  deviations: Deviation[]
}

export interface StrategySummary {
  count: number
  wins: number
  winRate: number
  avgWinRate: number
  avgLossRate: number
  cumRate: number
  planCumRate: number
  adherenceRate: number   // 계획 이탈 없는 회차 비율 (%)
  finalAmount: number | null
  planFinalAmount: number | null
}

function firstBuyDate(t: CycleTradeInput): string {
  if (t.buyEntries.length === 0) return t.createdAt
  return t.buyEntries.reduce((min, e) => e.date < min ? e.date : min, t.buyEntries[0].date)
}

function lastSellDate(t: CycleTradeInput): string {
  if (t.sellEntries.length === 0) return firstBuyDate(t)
  return t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date)
}

export function ruleText(s: StrategyRules): string {
  return [
    s.targetPct != null && `익절 +${s.targetPct}%`,
    s.stopLossPct != null && `손절 -${s.stopLossPct}%`,
    s.plannedDays != null && `${s.plannedDays}일 보유`,
    s.feePct != null && `수수료 ${s.feePct}%`,
  ].filter(Boolean).join(' · ')
}

// 엑셀 시뮬레이션과 같은 방식: (1 + 수익률) × (1 - 수수료) - 1
export function applyFee(ratePct: number, feePct?: number | null): number {
  const fee = (feePct ?? 0) / 100
  return ((1 + ratePct / 100) * (1 - fee) - 1) * 100
}

export function findDeviations(t: Pick<CycleTradeInput, 'profitRate' | 'holdingDays' | 'isCompleted'>, rules: StrategyRules): Deviation[] {
  const result: Deviation[] = []
  if (rules.plannedDays != null && t.holdingDays > rules.plannedDays) result.push('보유 초과')
  if (!t.isCompleted) return result
  if (rules.stopLossPct != null && t.profitRate < -rules.stopLossPct) result.push('손절 늦음')
  if (rules.targetPct != null && t.profitRate > 0) {
    result.push(t.profitRate >= rules.targetPct ? '목표 달성' : '조기 익절')
  }
  return result
}

// 완료된 거래를 마지막 매도일 순으로 회차를 매긴다
export function buildCycles<T extends CycleTradeInput>(trades: T[], rules: StrategyRules): Cycle<T>[] {
  const done = trades
    .filter(t => t.isCompleted)
    .map(t => ({ t, start: firstBuyDate(t), end: lastSellDate(t) }))
    .sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start))

  let cum = 1
  let planCum = 1
  return done.map(({ t, start, end }, i) => {
    const win = t.profitAmount > 0
    const netRate = applyFee(t.profitRate, rules.feePct)
    cum *= 1 + netRate / 100

    // 목표/손절이 없으면 실제 수익률을 그대로 계획값으로 쓴다
    const planRate = win
      ? (rules.targetPct ?? t.profitRate)
      : (rules.stopLossPct != null ? -rules.stopLossPct : t.profitRate)
    planCum *= 1 + applyFee(planRate, rules.feePct) / 100

    return {
      no: i + 1,
      trade: t,
      startDate: start.slice(0, 10),
      endDate: end.slice(0, 10),
      win,
      netRate,
      cumRate: (cum - 1) * 100,
      planCumRate: (planCum - 1) * 100,
      deviations: findDeviations(t, rules),
    }
  })
}

export function summarizeCycles(cycles: Cycle[], seedMoney?: number | null): StrategySummary {
  const wins = cycles.filter(c => c.win)
  const losses = cycles.filter(c => !c.win)
  const avg = (xs: number[]) => xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
  const last = cycles[cycles.length - 1]
  const cumRate = last?.cumRate ?? 0
  const planCumRate = last?.planCumRate ?? 0
  const clean = cycles.filter(c => !c.deviations.some(d => BAD_DEVIATIONS.includes(d)))

  return {
    count: cycles.length,
    wins: wins.length,
    winRate: cycles.length > 0 ? (wins.length / cycles.length) * 100 : 0,
    avgWinRate: avg(wins.map(c => c.netRate)),
    avgLossRate: avg(losses.map(c => c.netRate)),
    cumRate,
    planCumRate,
    adherenceRate: cycles.length > 0 ? (clean.length / cycles.length) * 100 : 0,
    finalAmount: seedMoney ? seedMoney * (1 + cumRate / 100) : null,
    planFinalAmount: seedMoney ? seedMoney * (1 + planCumRate / 100) : null,
  }
}
