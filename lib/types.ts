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

export interface Trade {
  id: string
  accountId: string
  symbol: string
  symbolCode?: string | null
  comment?: string | null
  createdAt: string
  updatedAt: string
  buyEntries: BuyEntry[]
  sellEntries: SellEntry[]
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
}
