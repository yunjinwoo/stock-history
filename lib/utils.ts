import dayjs from 'dayjs'
import type { Trade, CoinTrade, HoldingPlan } from './types'
import { HOLDING_PLAN_DAYS } from './types'
import type { Trade as PrismaTrade, BuyEntry, SellEntry, TradeImage, CoinTrade as PrismaCoinTrade, CoinBuyEntry, CoinSellEntry } from '@prisma/client'

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

type TradeWithEntries = PrismaTrade & { buyEntries: BuyEntry[]; sellEntries: SellEntry[]; images: TradeImage[] }

export function calcHoldingDays(from: string, to?: string | null): number {
  return Math.max(0, (to ? dayjs(to) : dayjs()).diff(dayjs(from), 'day'))
}

function calcPlanExceeded(plannedHoldingPeriod: string | null | undefined, holdingDays: number): boolean | null {
  if (!plannedHoldingPeriod) return null
  const maxDays = HOLDING_PLAN_DAYS[plannedHoldingPeriod as HoldingPlan]
  return maxDays != null ? holdingDays > maxDays : null
}

export function enrichTrade(t: TradeWithEntries): Trade {
  const totalBuyQuantity = t.buyEntries.reduce((s, e) => s + e.quantity, 0)
  const totalBuyAmount = t.buyEntries.reduce((s, e) => s + e.price * e.quantity, 0)
  const avgBuyPrice = totalBuyQuantity > 0 ? totalBuyAmount / totalBuyQuantity : 0

  const totalSellQuantity = t.sellEntries.reduce((s, e) => s + e.quantity, 0)
  const totalSellAmount = t.sellEntries.reduce((s, e) => s + e.price * e.quantity, 0)

  const remainingQuantity = totalBuyQuantity - totalSellQuantity
  const isCompleted = totalBuyQuantity > 0 && remainingQuantity <= 0

  const profitAmount = totalSellAmount - avgBuyPrice * totalSellQuantity
  const profitRate = totalSellQuantity > 0 && avgBuyPrice > 0
    ? (profitAmount / (avgBuyPrice * totalSellQuantity)) * 100
    : 0

  const firstBuy = t.buyEntries.length > 0
    ? t.buyEntries.reduce((min, e) => e.date < min ? e.date : min, t.buyEntries[0].date)
    : t.createdAt
  const lastSell = isCompleted && t.sellEntries.length > 0
    ? t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date)
    : null
  const holdingDays = calcHoldingDays(firstBuy, lastSell)

  return {
    ...t,
    avgBuyPrice,
    totalBuyQuantity,
    totalSellQuantity,
    remainingQuantity,
    totalBuyAmount,
    totalSellAmount,
    profitAmount,
    profitRate,
    holdingDays,
    isCompleted,
    planExceeded: calcPlanExceeded(t.plannedHoldingPeriod, holdingDays),
  }
}

type CoinTradeWithEntries = PrismaCoinTrade & { buyEntries: CoinBuyEntry[]; sellEntries: CoinSellEntry[] }

export function enrichCoinTrade(t: CoinTradeWithEntries): CoinTrade {
  const totalBuyQuantity = t.buyEntries.reduce((s, e) => s + e.quantity, 0)
  const totalBuyAmount = t.buyEntries.reduce((s, e) => s + e.price * e.quantity, 0)
  const avgBuyPrice = totalBuyQuantity > 0 ? totalBuyAmount / totalBuyQuantity : 0

  const totalSellQuantity = t.sellEntries.reduce((s, e) => s + e.quantity, 0)
  const totalSellAmount = t.sellEntries.reduce((s, e) => s + e.price * e.quantity, 0)

  const remainingQuantity = totalBuyQuantity - totalSellQuantity
  const isCompleted = totalBuyQuantity > 0 && remainingQuantity <= 0

  const profitAmount = totalSellAmount - avgBuyPrice * totalSellQuantity
  const profitRate = totalSellQuantity > 0 && avgBuyPrice > 0
    ? (profitAmount / (avgBuyPrice * totalSellQuantity)) * 100
    : 0

  const firstBuy = t.buyEntries.length > 0
    ? t.buyEntries.reduce((min, e) => e.date < min ? e.date : min, t.buyEntries[0].date)
    : t.createdAt
  const lastSell = isCompleted && t.sellEntries.length > 0
    ? t.sellEntries.reduce((max, e) => e.date > max ? e.date : max, t.sellEntries[0].date)
    : null

  return {
    ...t,
    avgBuyPrice,
    totalBuyQuantity,
    totalSellQuantity,
    remainingQuantity,
    totalBuyAmount,
    totalSellAmount,
    profitAmount,
    profitRate,
    holdingDays: calcHoldingDays(firstBuy, lastSell),
    isCompleted,
    planExceeded: calcPlanExceeded(t.plannedHoldingPeriod, calcHoldingDays(firstBuy, lastSell)),
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatQty(n: number): string {
  return n % 1 === 0 ? n.toString() : n.toFixed(8).replace(/\.?0+$/, '')
}

export function lastEntryDate(trade: {
  buyEntries: { date: string }[]
  sellEntries: { date: string }[]
  createdAt: string
}): string {
  const all = [...trade.buyEntries, ...trade.sellEntries]
  if (all.length === 0) return trade.createdAt
  return all.reduce((max, e) => e.date > max ? e.date : max, all[0].date)
}

export function splitDateTime(dt: string): { date: string; time: string } {
  const [date, timePart] = dt.split('T')
  return { date: date ?? '', time: timePart ? timePart.slice(0, 5) : '' }
}

export function toDateTimeStr(date: string, time: string): string {
  return time ? `${date}T${time}:00` : `${date}T00:00:00`
}

export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

export function planStatus(trade: { plannedHoldingPeriod?: string | null; planExceeded: boolean | null }): { label: string; tone: 'neutral' | 'good' | 'bad' } | null {
  if (!trade.plannedHoldingPeriod) return null
  if (trade.planExceeded == null) return { label: trade.plannedHoldingPeriod, tone: 'neutral' }
  return trade.planExceeded
    ? { label: `${trade.plannedHoldingPeriod} 초과`, tone: 'bad' }
    : { label: `${trade.plannedHoldingPeriod} 이내`, tone: 'good' }
}

export function formatRate(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '-'
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}
