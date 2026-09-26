// upbit-alert(자동매매 앱)가 지금 들고 있는 코인 — /api/coin-bot-holdings가 upbit-alert의
// /api/journal/holdings를 그대로 전달한다. 필드 설명은 upbit-alert docs/trade-journal-api.md 참고.
import type { BotRegime } from './botFills'

export interface BotPreset { key: BotRegime['key']; label: string; emoji: string }

export interface BotHolding {
  ticker: string
  symbol: string
  qty: number
  avg_buy_price: number
  current_price: number | null
  cost_krw: number
  eval_krw: number | null
  pnl_krw: number | null        // 수수료 미반영
  pnl_pct: number | null
  entry_at: string | null        // 'YYYY-MM-DD HH:MM:SS' (KST)
  entry_reason: string | null
  entry_reason_label: string | null
  entry_regime: BotRegime | null
  dca_count: number
  peak_pnl_pct: number | null
  trough_pnl_pct: number | null
  exit_rule: { preset: BotPreset | null; text: string; locked: boolean }
}

export interface BotHoldingsResponse {
  holdings: BotHolding[]
  current_preset: BotPreset | null
  cash_krw: number | null
}
