import { describe, it, expect } from 'vitest'
import { simulateTrades, qtyForTargetAvg, stopLossByPrice, stopLossByRate, stopLossByAmount, positionSize } from './calculator'

const holding = { price: 10000, qty: 100 } // 평단 1만원 100주

describe('simulateTrades', () => {
  it('8천원에 100주 추가 매수하면 평단 9천원', () => {
    const r = simulateTrades(holding, [{ side: 'buy', price: 8000, qty: 100 }], 1, 8000)!
    expect(r.qty).toBe(200)
    expect(r.avgPrice).toBe(9000)
    expect(r.boughtCost).toBe(800000)
    expect(r.avgChangeRate).toBeCloseTo(-10, 10)
    expect(r.profitRateAt).toBeCloseTo(-11.111, 3)
    expect(r.evalProfitAt).toBe(-200000)
    expect(r.breakevenRiseRate).toBeCloseTo(12.5, 10)
  })
  it('매도는 평단을 바꾸지 않고 실현손익만 생김', () => {
    const r = simulateTrades(holding, [{ side: 'sell', price: 11000, qty: 40 }], 1, 11000)!
    expect(r.qty).toBe(60)
    expect(r.avgPrice).toBe(10000)
    expect(r.realized).toBe(40000)
    expect(r.evalProfitAt).toBe(60000)
    expect(r.totalProfitAt).toBe(100000)
  })
  it('같은 가격 반복 매수', () => {
    const r = simulateTrades(holding, [{ side: 'buy', price: 8000, qty: 50, repeat: 2 }])!
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].avgPrice).toBeCloseTo(9333.33, 1)
    expect(r.avgPrice).toBe(9000)
  })
  it('매수·매도 묶음을 여러 번 반복 (박스권 매매)', () => {
    const steps = [{ side: 'buy' as const, price: 8000, qty: 100 }, { side: 'sell' as const, price: 8500, qty: 100 }]
    const r = simulateTrades(holding, steps, 3, 8500)!
    expect(r.rows).toHaveLength(6)
    // 1회: 평단 9000 → 9000원에 산 100주를 8500에 팔면 -50000, 평단은 그대로 9000
    expect(r.rows[1].realized).toBe(-50000)
    expect(r.qty).toBe(100)
    expect(r.avgPrice).toBeLessThan(10000)
    expect(r.realized).toBeLessThan(0)
    expect(r.breakevenPrice).toBeCloseTo(r.avgPrice - r.realized / r.qty, 6)
  })
  it('보유수량보다 많이 팔면 보유분만 매도', () => {
    const r = simulateTrades(holding, [{ side: 'sell', price: 9000, qty: 150 }])!
    expect(r.rows[0].qty).toBe(100)
    expect(r.rows[0].clipped).toBe(true)
    expect(r.qty).toBe(0)
    expect(r.realized).toBe(-100000)
  })
  it('보유 없이 새로 시작해도 계산', () => {
    const r = simulateTrades({ price: 0, qty: 0 }, [{ side: 'buy', price: 5000, qty: 10 }, { side: 'sell', price: 6000, qty: 10 }])!
    expect(r.realized).toBe(10000)
    expect(r.qty).toBe(0)
  })
  it('입력이 없으면 null', () => {
    expect(simulateTrades({ price: 0, qty: 0 }, [])).toBeNull()
    expect(simulateTrades({ price: 0, qty: 0 }, [{ side: 'buy', price: 0, qty: 10 }])).toBeNull()
  })
})

describe('qtyForTargetAvg', () => {
  it('8천원에 사서 평단 9천원 만들려면 100주', () => {
    expect(qtyForTargetAvg(holding, 8000, 9000)).toEqual({ qty: 100, cost: 800000, avgPrice: 9000 })
  })
  it('나누어떨어지지 않으면 올림', () => {
    const r = qtyForTargetAvg(holding, 7000, 9500)!
    expect(r.qty).toBe(20)
    expect(r.avgPrice).toBeLessThanOrEqual(9500)
  })
  it('불가능한 목표는 null', () => {
    expect(qtyForTargetAvg(holding, 9000, 8000)).toBeNull()  // 매수가보다 낮은 평단
    expect(qtyForTargetAvg(holding, 8000, 11000)).toBeNull() // 기존 평단보다 높은 목표
  })
})

describe('stopLoss', () => {
  it('가격으로', () => {
    const r = stopLossByPrice(holding, 9000)!
    expect(r.lossRate).toBeCloseTo(-10, 10)
    expect(r.lossAmount).toBe(-100000)
    expect(r.recoveryRate).toBeCloseTo(11.111, 3)
  })
  it('비율로', () => {
    const r = stopLossByRate(holding, 20)!
    expect(r.stopPrice).toBe(8000)
    expect(r.recoveryRate).toBeCloseTo(25, 10)
  })
  it('허용 손실금액으로', () => {
    const r = stopLossByAmount(holding, 50000)!
    expect(r.stopPrice).toBe(9500)
    expect(r.lossAmount).toBe(-50000)
  })
  it('잘못된 입력은 null', () => {
    expect(stopLossByRate(holding, 0)).toBeNull()
    expect(stopLossByRate(holding, 100)).toBeNull()
    expect(stopLossByAmount(holding, 2000000)).toBeNull()
    expect(stopLossByPrice(holding, 0)).toBeNull()
  })
})

describe('positionSize', () => {
  it('진입 1만, 손절 9천5백, 허용손실 10만 → 200주', () => {
    expect(positionSize(10000, 9500, 100000)).toEqual({ qty: 200, cost: 2000000, loss: 100000 })
  })
  it('손절가가 진입가 이상이면 null', () => {
    expect(positionSize(10000, 10000, 100000)).toBeNull()
  })
})
