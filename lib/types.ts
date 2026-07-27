export const HOLDING_PLAN_OPTIONS = ['1일', '1주일', '1달', '6개월이내', '6개월이상'] as const
export type HoldingPlan = typeof HOLDING_PLAN_OPTIONS[number]

// 계획 대비 실제 보유일수 비교 기준 (계획 라벨 → 최대 보유일)
export const HOLDING_PLAN_DAYS: Record<HoldingPlan, number> = {
  '1일': 1,
  '1주일': 7,
  '1달': 30,
  '6개월이내': 180,
  '6개월이상': Infinity,
}

// 계획별 기본 손절 기준 (계획 라벨 → 매수가 대비 손실 허용 %)
export const HOLDING_PLAN_STOP_LOSS_PCT: Record<HoldingPlan, number> = {
  '1일': 3,
  '1주일': 5,
  '1달': 8,
  '6개월이내': 15,
  '6개월이상': 20,
}

// 계획별 기본 목표 수익률 (계획 라벨 → 매수가 대비 목표 수익 %)
export const HOLDING_PLAN_TARGET_PCT: Record<HoldingPlan, number> = {
  '1일': 5,
  '1주일': 10,
  '1달': 15,
  '6개월이내': 30,
  '6개월이상': 50,
}

// 매매 점수 (1~5점, 2/4점은 수익률로 자동 계산, 1/3/5점은 수동 평가)
export const TRADE_SCORE_OPTIONS = [1, 2, 3, 4, 5] as const
export type TradeScore = typeof TRADE_SCORE_OPTIONS[number]

export const TRADE_SCORE_LABELS: Record<TradeScore, string> = {
  1: '손절 실패',
  2: '손절 준수',
  3: '무난',
  4: '목표 초과 수익',
  5: '계획대로 익절',
}

export interface Account {
  id: string
  broker: string
  accountNumber: string
  nickname?: string | null
  memo?: string | null
  createdAt: string
  updatedAt: string
}

export interface BuyEntry {
  id: string
  tradeId: string
  date: string
  price: number
  quantity: number
  createdAt: string
}

export interface SellEntry {
  id: string
  tradeId: string
  date: string
  price: number
  quantity: number
  createdAt: string
}

export interface CoinBuyEntry {
  id: string; tradeId: string; date: string; price: number; quantity: number; createdAt: string
}
export interface CoinSellEntry {
  id: string; tradeId: string; date: string; price: number; quantity: number; createdAt: string
}
export interface CoinTrade {
  id: string
  symbol: string
  comment?: string | null
  plannedHoldingPeriod?: string | null
  tradeScore?: number | null
  createdAt: string
  updatedAt: string
  buyEntries: CoinBuyEntry[]
  sellEntries: CoinSellEntry[]
  avgBuyPrice: number
  totalBuyQuantity: number
  totalSellQuantity: number
  remainingQuantity: number
  totalBuyAmount: number
  totalSellAmount: number
  profitAmount: number
  profitRate: number
  holdingDays: number
  isCompleted: boolean
  planExceeded: boolean | null
}

export interface TradeImage {
  id: string
  tradeId: string
  filename: string
  createdAt: string
}

export interface MemoImage {
  id: string
  memoId: string
  filename: string
  createdAt: string
}

export interface Trade {
  id: string
  accountId: string
  symbol: string
  symbolCode?: string | null
  comment?: string | null
  exitComment?: string | null
  targetPrice?: number | null
  stopLossPrice?: number | null
  plannedHoldingPeriod?: string | null
  tradeScore?: number | null
  createdAt: string
  updatedAt: string
  buyEntries: BuyEntry[]
  sellEntries: SellEntry[]
  images: TradeImage[]
  // 조회 시 계산 (DB 저장 안 함)
  avgBuyPrice: number
  totalBuyQuantity: number
  totalSellQuantity: number
  remainingQuantity: number
  totalBuyAmount: number
  totalSellAmount: number
  profitAmount: number
  profitRate: number
  holdingDays: number
  isCompleted: boolean
  planExceeded: boolean | null
}
