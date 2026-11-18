import { describe, it, expect } from 'vitest'
import { holdingZoneOf, holdingZoneStats } from './utils'

describe('holdingZoneOf', () => {
  it('경계값을 배지 색 기준과 같게 나눈다', () => {
    expect(holdingZoneOf(0)).toBe('d7')
    expect(holdingZoneOf(7)).toBe('d7')
    expect(holdingZoneOf(8)).toBe('d30')
    expect(holdingZoneOf(30)).toBe('d30')
    expect(holdingZoneOf(31)).toBe('d90')
    expect(holdingZoneOf(90)).toBe('d90')
    expect(holdingZoneOf(91)).toBe('d90+')
  })
})

describe('holdingZoneStats', () => {
  it('평균 보유일과 구역별 개수를 센다', () => {
    const r = holdingZoneStats([{ holdingDays: 3 }, { holdingDays: 10 }, { holdingDays: 20 }, { holdingDays: 200 }])
    expect(r.avgDays).toBe(58)
    expect(r.counts).toEqual({ d7: 1, d30: 2, d90: 0, 'd90+': 1 })
  })
  it('빈 목록이면 평균은 null', () => {
    expect(holdingZoneStats([]).avgDays).toBeNull()
  })
})
