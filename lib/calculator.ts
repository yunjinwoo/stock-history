// 손절·물타기 계산기 — 순수 계산 함수 (수수료·세금 제외)

export interface Lot {
  price: number
  qty: number
}

export type Side = 'buy' | 'sell'

export interface TradeStep {
  side: Side
  price: number
  qty: number
  repeat?: number  // 같은 가격·수량으로 몇 번 거래했는지 (기본 1)
}

export interface SimRow {
  cycle: number       // 전체 반복 몇 번째 (1부터)
  step: number        // 회차 번호 (1부터)
  side: Side
  price: number
  qty: number         // 실제 체결 수량 (매도는 보유수량을 넘지 않음)
  clipped: boolean    // 매도 수량이 보유수량보다 많아 잘림
  avgPrice: number    // 거래 후 평단
  holdQty: number     // 거래 후 보유수량
  realized: number    // 이 거래의 실현손익
  realizedTotal: number
}

export interface SimResult {
  rows: SimRow[]
  truncated: boolean     // 행이 너무 많아 일부만 담음 (계산은 끝까지 함)
  avgPrice: number
  qty: number
  boughtQty: number
  boughtCost: number     // 추가 매수에 들어간 금액
  soldQty: number
  soldAmount: number
  realized: number       // 누적 실현손익
  avgChangeRate: number | null     // 시작 평단 대비 평단 변화율(%)
  evalProfitAt: number | null      // 기준가 기준 평가손익 (남은 보유분)
  profitRateAt: number | null      // 기준가 기준 평단 손익률(%)
  totalProfitAt: number | null     // 실현 + 평가
  breakevenPrice: number | null    // 실현손익까지 합쳐 본전이 되는 가격
  breakevenRiseRate: number | null // 기준가에서 본전가까지 필요한 상승률(%)
}

const MAX_ROWS = 300

// 이동평균 방식: 매수하면 평단이 바뀌고, 매도는 평단을 바꾸지 않고 (매도가 - 평단)만큼 실현손익이 생김
export function simulateTrades(holding: Lot, steps: TradeStep[], cycles = 1, refPrice?: number | null): SimResult | null {
  const startPrice = holding.price > 0 && holding.qty > 0 ? holding.price : 0
  let qty = startPrice > 0 ? holding.qty : 0
  let cost = startPrice * qty
  let boughtQty = 0, boughtCost = 0, soldQty = 0, soldAmount = 0, realized = 0
  const rows: SimRow[] = []
  let truncated = false
  const valid = steps
    .map((s, i) => ({ ...s, step: i + 1, repeat: Math.max(1, Math.floor(s.repeat ?? 1)) }))
    .filter(s => s.price > 0 && s.qty > 0)
  if (valid.length === 0 && qty === 0) return null
  const nCycles = Math.max(1, Math.floor(cycles))

  for (let c = 1; c <= nCycles; c++) {
    for (const s of valid) {
      for (let r = 0; r < s.repeat; r++) {
        let filled = s.qty
        let clipped = false
        let gain = 0
        if (s.side === 'buy') {
          qty += filled
          cost += filled * s.price
          boughtQty += filled
          boughtCost += filled * s.price
        } else {
          if (filled > qty) { filled = qty; clipped = true }
          const avg = qty > 0 ? cost / qty : 0
          gain = (s.price - avg) * filled
          cost -= avg * filled
          qty -= filled
          if (qty === 0) cost = 0
          soldQty += filled
          soldAmount += filled * s.price
          realized += gain
        }
        if (rows.length < MAX_ROWS) {
          rows.push({
            cycle: c, step: s.step, side: s.side, price: s.price, qty: filled, clipped,
            avgPrice: qty > 0 ? cost / qty : 0, holdQty: qty, realized: gain, realizedTotal: realized,
          })
        } else truncated = true
      }
    }
  }

  const avgPrice = qty > 0 ? cost / qty : 0
  const ref = refPrice != null && refPrice > 0 ? refPrice : null
  const evalProfitAt = ref != null ? (ref - avgPrice) * qty : null
  const breakevenPrice = qty > 0 ? avgPrice - realized / qty : null
  return {
    rows, truncated, avgPrice, qty, boughtQty, boughtCost, soldQty, soldAmount, realized,
    avgChangeRate: startPrice > 0 && qty > 0 ? (avgPrice / startPrice - 1) * 100 : null,
    evalProfitAt,
    profitRateAt: ref != null && qty > 0 ? (ref / avgPrice - 1) * 100 : null,
    totalProfitAt: evalProfitAt != null ? evalProfitAt + realized : null,
    breakevenPrice,
    breakevenRiseRate: ref != null && breakevenPrice != null ? (breakevenPrice / ref - 1) * 100 : null,
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
