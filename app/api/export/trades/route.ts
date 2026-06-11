import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'
import { enrichTrade, enrichCoinTrade } from '@/lib/utils'

export async function GET() {
  const [rawTrades, accounts, rawCoins] = await Promise.all([
    prisma.trade.findMany({
      include: { buyEntries: true, sellEntries: true, images: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.account.findMany(),
    prisma.coinTrade.findMany({
      include: { buyEntries: true, sellEntries: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  const tradeRows = rawTrades.map(t => {
    const e = enrichTrade(t)
    const acc = accountMap[t.accountId]
    const accName = acc ? (acc.nickname || `${acc.broker} ${acc.accountNumber}`) : t.accountId
    const firstBuy = t.buyEntries.length > 0
      ? t.buyEntries.reduce((min, b) => b.date < min ? b.date : min, t.buyEntries[0].date).slice(0, 10)
      : ''
    const lastSell = t.sellEntries.length > 0
      ? t.sellEntries.reduce((max, s) => s.date > max ? s.date : max, t.sellEntries[0].date).slice(0, 10)
      : ''
    return {
      '계좌': accName,
      '종목': t.symbol,
      '종목코드': t.symbolCode ?? '',
      '상태': e.isCompleted ? '완료' : '보유중',
      '평균매수가': Math.round(e.avgBuyPrice),
      '총매수금액': Math.round(e.totalBuyAmount),
      '총매도금액': Math.round(e.totalSellAmount),
      '수익금': Math.round(e.profitAmount),
      '수익률(%)': Math.round(e.profitRate * 100) / 100,
      '보유일': e.holdingDays,
      '매수일': firstBuy,
      '최종매도일': lastSell,
      '코멘트': t.comment ?? '',
    }
  })

  const coinRows = rawCoins.map(t => {
    const e = enrichCoinTrade(t)
    const firstBuy = t.buyEntries.length > 0
      ? t.buyEntries.reduce((min, b) => b.date < min ? b.date : min, t.buyEntries[0].date).slice(0, 10)
      : ''
    const lastSell = t.sellEntries.length > 0
      ? t.sellEntries.reduce((max, s) => s.date > max ? s.date : max, t.sellEntries[0].date).slice(0, 10)
      : ''
    return {
      '종목': t.symbol,
      '상태': e.isCompleted ? '완료' : '보유중',
      '평균매수가': e.avgBuyPrice,
      '총매수금액': e.totalBuyAmount,
      '총매도금액': e.totalSellAmount,
      '수익금': Math.round(e.profitAmount),
      '수익률(%)': Math.round(e.profitRate * 100) / 100,
      '보유일': e.holdingDays,
      '매수일': firstBuy,
      '최종매도일': lastSell,
      '코멘트': t.comment ?? '',
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tradeRows), '주식거래')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(coinRows), '코인거래')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="trades-${date}.xlsx"`,
    },
  })
}
