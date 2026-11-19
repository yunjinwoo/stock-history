// 매매 복기 — 거래 계획(목표가·손절가·계획 보유기간) 대비 실제 실행 평가
// 기준 문서: docs/trade-review-direction.md, docs/trade-review-page.md

export const ENTRY_REASONS = ['추세', '돌파', '눌림목', '실적', '수급', '뉴스', '테마', '저평가', '배당', '충동매매', '물타기'] as const
export const EXIT_REASONS = ['목표가 도달', '손절', '추세 이탈', '계획 기간 만료', '공포', '욕심', '조기 매도', '다른 종목으로 이동', '현금 필요', '실수'] as const

// 손절가보다 매수가 대비 이만큼(%p) 더 내려가서 팔았으면 '손절 늦음'
export const STOP_LOSS_TOLERANCE_PCT = 1

// 수익 거래인데 목표가 전에 판 이유가 이것이면 '조기 익절'
const EARLY_EXIT_REASONS = ['조기 매도', '공포']

// 이름은 전략 화면(lib/strategy.ts Deviation)과 맞춘다
export type ReviewDeviation = '보유 초과' | '손절 늦음' | '조기 익절'

export type PlanStatus = 'followed' | 'deviated' | 'noPlan'
export type Quadrant = 'good' | 'lucky' | 'goodLoss' | 'bad'

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  good: '좋은 매매',
  lucky: '운 좋은 매매',
  goodLoss: '좋은 손실',
  bad: '나쁜 매매',
}

// 평가에 필요한 거래 필드만 (enrichTrade 결과의 부분집합)
export interface ReviewTradeInput {
  targetPrice?: number | null
  stopLossPrice?: number | null
  plannedHoldingPeriod?: string | null
  planExceeded: boolean | null
  exitReason?: string | null
  isCompleted: boolean
  avgBuyPrice: number
  profitAmount: number
  profitRate: number
  sellEntries: { date: string; price: number; quantity: number }[]
}

export interface TradeEvaluation {
  hasPlan: boolean
  avgSellPrice: number | null
  targetHit: boolean | null        // 매도 체결 중 하나라도 목표가 이상 (목표가 없으면 null)
  finalTargetMet: boolean | null   // 가중평균 매도가가 목표가 이상
  stopHit: boolean | null          // 매도 체결 중 하나라도 손절가 이하
  deviations: ReviewDeviation[]
  status: PlanStatus
  quadrant: Quadrant | null        // 완료 + 계획 있는 거래만
  exitReasonMismatch: string | null
}

function weightedAvgSell(entries: ReviewTradeInput['sellEntries']): number | null {
  const qty = entries.reduce((s, e) => s + e.quantity, 0)
  if (qty <= 0) return null
  return entries.reduce((s, e) => s + e.price * e.quantity, 0) / qty
}

export function evaluateTrade(t: ReviewTradeInput): TradeEvaluation {
  const target = t.targetPrice ?? null
  const stop = t.stopLossPrice ?? null
  const hasPlan = target != null || stop != null || !!t.plannedHoldingPeriod
  const avgSellPrice = weightedAvgSell(t.sellEntries)
  const sold = t.sellEntries.length > 0

  const targetHit = target != null && sold ? t.sellEntries.some(e => e.price >= target) : null
  const finalTargetMet = target != null && avgSellPrice != null ? avgSellPrice >= target : null
  const stopHit = stop != null && sold ? t.sellEntries.some(e => e.price <= stop) : null

  const win = t.profitAmount > 0
  const deviations: ReviewDeviation[] = []
  if (t.planExceeded === true) deviations.push('보유 초과')
  if (t.isCompleted && !win && stop != null && avgSellPrice != null) {
    const tolerance = t.avgBuyPrice * STOP_LOSS_TOLERANCE_PCT / 100
    if (avgSellPrice < stop - tolerance) deviations.push('손절 늦음')
  }
  if (t.isCompleted && win && targetHit === false && t.exitReason && EARLY_EXIT_REASONS.includes(t.exitReason)) {
    deviations.push('조기 익절')
  }

  const status: PlanStatus = !hasPlan ? 'noPlan' : deviations.length > 0 ? 'deviated' : 'followed'
  const quadrant: Quadrant | null = !t.isCompleted || status === 'noPlan'
    ? null
    : win
      ? (status === 'followed' ? 'good' : 'lucky')
      : (status === 'followed' ? 'goodLoss' : 'bad')

  const exitReasonMismatch = t.exitReason === '목표가 도달' && targetHit === false
    ? '목표가에 도달한 매도 체결이 없어요'
    : null

  return { hasPlan, avgSellPrice, targetHit, finalTargetMet, stopHit, deviations, status, quadrant, exitReasonMismatch }
}

// ---- 기간 ----

export type PeriodKind = 'week' | 'month' | 'lastMonth' | 'custom'

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 기준일(today)이 속한 기간의 시작·끝 (YYYY-MM-DD, 양 끝 포함). 주는 월요일 시작
export function periodRange(kind: Exclude<PeriodKind, 'custom'>, today: Date): { start: string; end: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  if (kind === 'week') {
    const day = today.getDay()
    const monday = new Date(y, m, today.getDate() - (day === 0 ? 6 : day - 1))
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
    return { start: ymd(monday), end: ymd(sunday) }
  }
  if (kind === 'month') return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m + 1, 0)) }
  return { start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) }
}

export function lastSellDay(t: { sellEntries: { date: string }[] }): string | null {
  if (t.sellEntries.length === 0) return null
  return t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date).slice(0, 10)
}

// ---- 요약 ----

export interface Bucket<T> {
  trades: T[]
  count: number
  profit: number
  avgRate: number | null
}

function bucket<T extends { profitAmount: number; profitRate: number }>(list: T[]): Bucket<T> {
  return {
    trades: list,
    count: list.length,
    profit: list.reduce((s, t) => s + t.profitAmount, 0),
    avgRate: list.length > 0 ? list.reduce((s, t) => s + t.profitRate, 0) / list.length : null,
  }
}

export interface ReviewSummary<T> {
  count: number
  profit: number
  winRate: number | null
  avgWinRate: number | null
  avgLossRate: number | null
  payoffRatio: number | null    // 평균 이익률 ÷ |평균 손실률|
  expectancyRate: number | null // 거래당 평균 수익률
  plannedCount: number
  noPlanCount: number
  adherenceRate: number | null  // 계획 있는 거래 중 이탈 없는 비율 (%)
  quadrants: Record<Quadrant, Bucket<T>>
  followed: Bucket<T>
  deviated: Bucket<T>
  stopKeptLoss: Bucket<T>       // 손절가가 있던 손실 거래 중 손절 늦음이 아닌 것
  lateStopLoss: Bucket<T>       // 손절 늦음
  deviationCounts: Record<ReviewDeviation, number>
}

export type Evaluated<T> = T & { review: TradeEvaluation }

export function summarizeReview<T extends ReviewTradeInput>(list: Evaluated<T>[]): ReviewSummary<Evaluated<T>> {
  const done = list.filter(t => t.isCompleted)
  const wins = done.filter(t => t.profitAmount > 0)
  const losses = done.filter(t => t.profitAmount <= 0)
  const avg = (xs: number[]) => xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null
  const avgWinRate = avg(wins.map(t => t.profitRate))
  const avgLossRate = avg(losses.map(t => t.profitRate))
  const planned = done.filter(t => t.review.status !== 'noPlan')
  const followed = planned.filter(t => t.review.status === 'followed')
  const deviated = planned.filter(t => t.review.status === 'deviated')
  const late = losses.filter(t => t.review.deviations.includes('손절 늦음'))
  const kept = losses.filter(t => t.stopLossPrice != null && !t.review.deviations.includes('손절 늦음'))

  const deviationCounts: Record<ReviewDeviation, number> = { '보유 초과': 0, '손절 늦음': 0, '조기 익절': 0 }
  done.forEach(t => t.review.deviations.forEach(d => { deviationCounts[d]++ }))

  const byQuadrant = (q: Quadrant) => bucket(done.filter(t => t.review.quadrant === q))

  return {
    count: done.length,
    profit: done.reduce((s, t) => s + t.profitAmount, 0),
    winRate: done.length > 0 ? (wins.length / done.length) * 100 : null,
    avgWinRate,
    avgLossRate,
    payoffRatio: avgWinRate != null && avgLossRate != null && avgLossRate < 0 ? avgWinRate / Math.abs(avgLossRate) : null,
    expectancyRate: avg(done.map(t => t.profitRate)),
    plannedCount: planned.length,
    noPlanCount: done.length - planned.length,
    adherenceRate: planned.length > 0 ? (followed.length / planned.length) * 100 : null,
    quadrants: { good: byQuadrant('good'), lucky: byQuadrant('lucky'), goodLoss: byQuadrant('goodLoss'), bad: byQuadrant('bad') },
    followed: bucket(followed),
    deviated: bucket(deviated),
    stopKeptLoss: bucket(kept),
    lateStopLoss: bucket(late),
    deviationCounts,
  }
}
