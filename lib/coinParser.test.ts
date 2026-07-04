import { describe, it, expect } from 'vitest'
import { parsePastedText } from './coinParser'

describe('parsePastedText', () => {
  it('parses inline date/time format (기존 형식)', () => {
    const text = `2026.04.28 10:32
BTC
KRW
매수
0.01000000BTC
85,000,000KRW
850,000원
체결
주문번호
12345`
    const results = parsePastedText(text)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      date: '2026-04-28T10:32:00',
      symbol: 'BTC',
      type: '매수',
      quantity: 0.01,
      price: 85000000,
    })
  })

  it('parses split date/time + SYMBOL/KRW market format (거래소 체결내역)', () => {
    const text = `2026.05.09
10:35
PYTH/KRW
매도
89.40
104,143
1,164.91870614
2026.02.15
08:57
PYTH/KRW
매수
85.80
86,177
1,004.39174225
2025.09.19
01:03
PYTH/KRW
매수
240.0
371,690
1,548.70481425`
    const results = parsePastedText(text)
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({
      date: '2026-05-09T10:35:00',
      symbol: 'PYTH',
      type: '매도',
      price: 89.4,
      quantity: 1164.91870614,
    })
    expect(results[1]).toEqual({
      date: '2026-02-15T08:57:00',
      symbol: 'PYTH',
      type: '매수',
      price: 85.8,
      quantity: 1004.39174225,
    })
    expect(results[2]).toEqual({
      date: '2025-09-19T01:03:00',
      symbol: 'PYTH',
      type: '매수',
      price: 240,
      quantity: 1548.70481425,
    })
  })

  it('returns empty array for blank text', () => {
    expect(parsePastedText('')).toEqual([])
  })

  it('returns empty array for unrelated text', () => {
    expect(parsePastedText('아무 상관없는 텍스트입니다.\n두 번째 줄입니다.')).toEqual([])
  })
})
