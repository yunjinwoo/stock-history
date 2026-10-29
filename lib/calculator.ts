// 손절·물타기 계산기 — 순수 계산 함수 (수수료·세금 제외)

export interface Lot {
  price: number
  qty: number
}

export interface AverageDownResult {
  totalQty: number
  totalCost: number
  avgPrice: number
  addedQty: number
  addedCost: number
  avgDropRate: number           // 기존 평단 대비 새 평단 변화율(%)
  profitRateAt: number | null   // 기준가(현재가) 기준 새 평단 손익률(%)
  profitAt: number | null       // 기준가 기준 평가손익
  breakevenRiseRate: number | null // 기준가에서 새 평단까지 필요한 상승률(%)
}

function validLots(lots: Lot[]): Lot[] {
  return lots.filter(l => l.price > 0 && l.qty > 0)
}

// 기존 보유분 + 추가 매수분을 합친 평단
export function averageDown(holding: Lot, buys: Lot[], refPrice?: number | null): AverageDownResult | null {
  if (!(holding.price > 0) || !(holding.qty > 0)) return null
  const added = validLots(buys)
  const addedQty = added.reduce((s, l) => s + l.qty, 0)
  const addedCost = added.reduce((s, l) => s + l.price * l.qty, 0)
  const totalQty = holding.qty + addedQty
  const totalCost = holding.price * holding.qty + addedCost
  const avgPrice = totalCost / totalQty
  const ref = refPrice != null && refPrice > 0 ? refPrice : null
  return {
    totalQty,
    totalCost,
    avgPrice,
    addedQty,
    addedCost,
    avgDropRate: (avgPrice / holding.price - 1) * 100,
    profitRateAt: ref != null ? (ref / avgPrice - 1) * 100 : null,
    profitAt: ref != null ? (ref - avgPrice) * totalQty : null,
    breakevenRiseRate: ref != null ? (avgPrice / ref - 1) * 100 : null,
  }
}

// 매수가 buyPrice로 평단을 targetAvg까지 낮추려면 몇 주 사야 하는지 (정수 주, 올림)
// buyPrice < targetAvg < 현재 평단 일 때만 가능
export function qtyForTargetAvg(holding: Lot, buyPrice: number, targetAvg: number): { qty: number; cost: number; avgPrice: number } | null {
  if (!(holding.price > 0) || !(holding.qty > 0) || !(buyPrice > 0) || !(targetAvg > 0)) return null
  if (!(buyPrice < targetAvg && targetAvg < holding.price)) return null
  const exact = holding.qty * (holding.price - targetAvg) / (targetAvg - buyPrice)
  const qty = Math.ceil(exact - 1e-9)
  const avgPrice = (holding.price * holding.qty + buyPrice * qty) / (holding.qty + qty)
  return { qty, cost: qty * buyPrice, avgPrice }
}

export interface StopLossResult {
  stopPrice: number
  lossRate: number        // 평단 대비 손익률(%) — 음수
  lossAmount: number      // 손실금액 — 음수
  recoveryRate: number    // 손절 후 원금 회복에 필요한 상승률(%)
}

function stopResult(holding: Lot, stopPrice: number): StopLossResult {
  const lossRate = (stopPrice / holding.price - 1) * 100
  return {
    stopPrice,
    lossRate,
    lossAmount: (stopPrice - holding.price) * holding.qty,
    recoveryRate: stopPrice > 0 ? (holding.price / stopPrice - 1) * 100 : Infinity,
  }
}

// 손절가를 직접 지정
export function stopLossByPrice(holding: Lot, stopPrice: number): StopLossResult | null {
  if (!(holding.price > 0) || !(holding.qty > 0) || !(stopPrice > 0)) return null
  return stopResult(holding, stopPrice)
}

// 손절 비율(%)로 지정 — 예: 5 → 평단 -5%
export function stopLossByRate(holding: Lot, ratePct: number): StopLossResult | null {
  if (!(holding.price > 0) || !(holding.qty > 0) || !(ratePct > 0) || ratePct >= 100) return null
  return stopResult(holding, holding.price * (1 - ratePct / 100))
}

// 감당할 수 있는 최대 손실금액으로 손절가 역산
export function stopLossByAmount(holding: Lot, maxLoss: number): StopLossResult | null {
  if (!(holding.price > 0) || !(holding.qty > 0) || !(maxLoss > 0)) return null
  const stopPrice = holding.price - maxLoss / holding.qty
  if (!(stopPrice > 0)) return null
  return stopResult(holding, stopPrice)
}

// 진입가·손절가·허용 손실금액 → 살 수 있는 최대 수량 (포지션 사이징)
export function positionSize(entryPrice: number, stopPrice: number, maxLoss: number): { qty: number; cost: number; loss: number } | null {
  if (!(entryPrice > 0) || !(stopPrice > 0) || !(maxLoss > 0) || stopPrice >= entryPrice) return null
  const qty = Math.floor(maxLoss / (entryPrice - stopPrice) + 1e-9)
  return { qty, cost: qty * entryPrice, loss: qty * (entryPrice - stopPrice) }
}
