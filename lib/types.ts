export interface Account {
  id: string
  broker: string
  accountNumber: string
  nickname?: string | null
  memo?: string | null
  createdAt: string
  updatedAt: string
}

export interface Trade {
  id: string
  accountId: string
  symbol: string
  symbolCode?: string | null
  buyDate: string
  buyPrice: number
  buyQuantity: number
  sellDate?: string | null
  sellPrice?: number | null
  sellQuantity?: number | null
  comment?: string | null
  createdAt: string
  updatedAt: string
  // 조회 시 계산 (DB 저장 안 함)
  holdingDays?: number
  profitAmount?: number
  profitRate?: number
}
