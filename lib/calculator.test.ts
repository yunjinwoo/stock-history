import { describe, it, expect } from 'vitest'
import { averageDown, qtyForTargetAvg, stopLossByPrice, stopLossByRate, stopLossByAmount, positionSize } from './calculator'

const holding = { price: 10000, qty: 100 } // 평단 1만원 100주

describe('averageDown', () => {
  it('8천원에 100주 추가하면 평단 9천원', () => {
    const r = averageDown(holding, [{ price: 8000, qty: 100 }], 8000)!
    expect(r.totalQty).toBe(200)
    expect(r.avgPrice).toBe(9000)
    expect(r.addedCost).toBe(800000)
    expect(r.avgDropRate).toBeCloseTo(-10, 10)
    expect(r.profitRateAt).toBeCloseTo(-11.111, 3)
    expect(r.profitAt).toBe(-200000)
    expect(r.breakevenRiseRate).toBeCloseTo(12.5, 10)
  })
  it('여러 회차와 빈 행을 함께 처리', () => {
    const r = averageDown(holding, [{ price: 9000, qty: 50 }, { price: 0, qty: 10 }, { price: 8000, qty: 50 }])!
    expect(r.totalQty).toBe(200)
    expect(r.avgPrice).toBe(9250)
    expect(r.profitRateAt).toBeNull()
  })
  it('보유분이 없으면 null', () => {
    expect(averageDown({ price: 0, qty: 100 }, [])).toBeNull()
    expect(averageDown({ price: 10000, qty: 0 }, [])).toBeNull()
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
