import dayjs from 'dayjs'
import type { Trade } from './types'
import type { Trade as PrismaTrade } from '@prisma/client'

export function calcHoldingDays(buyDate: string, sellDate?: string | null): number {
  return Math.max(0, (sellDate ? dayjs(sellDate) : dayjs()).diff(dayjs(buyDate), 'day'))
}

export function enrichTrade(t: PrismaTrade): Trade {
  return {
    ...t,
    holdingDays: calcHoldingDays(t.buyDate, t.sellDate),
    profitAmount: t.sellPrice && t.sellQuantity
      ? (t.sellPrice - t.buyPrice) * t.sellQuantity
      : undefined,
    profitRate: t.sellPrice
      ? ((t.sellPrice - t.buyPrice) / t.buyPrice) * 100
      : undefined,
  }
}

export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

export function formatRate(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}
