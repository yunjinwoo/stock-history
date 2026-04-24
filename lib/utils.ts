import dayjs from 'dayjs'
import type { Trade } from './types'
import type { Trade as PrismaTrade, BuyEntry, SellEntry } from '@prisma/client'

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

type TradeWithEntries = PrismaTrade & { buyEntries: BuyEntry[]; sellEntries: SellEntry[] }

export function calcHoldingDays(from: string, to?: string | null): number {
  return Math.max(0, (to ? dayjs(to) : dayjs()).diff(dayjs(from), 'day'))
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
  }
}

export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

export function formatRate(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '-'
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}
