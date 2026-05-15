'use client'

interface Memo {
  id: string
  content: string
  showOnMain: boolean
  showOnCoin: boolean
  symbol?: string | null
  alertDate?: string | null
}

interface Props {
  memos: Memo[]
  page: 'stock' | 'coin'
  symbolCodeMap?: Record<string, string>
}

export default function MemoStrip({ memos, page, symbolCodeMap = {} }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const visible = memos.filter(m => {
    const pinned = page === 'stock' ? m.showOnMain : m.showOnCoin
    const alerted = page === 'stock' && !!m.alertDate && m.alertDate <= today
    return pinned || alerted
  })
  if (visible.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {visible.map(m => {
        const symbolCode = m.symbol ? symbolCodeMap[m.symbol] : null
        const naverUrl = symbolCode
          ? `https://finance.naver.com/item/main.naver?code=${symbolCode}`
          : m.symbol
            ? `https://search.naver.com/search.naver?query=${encodeURIComponent(m.symbol)}`
            : null
        const isAlert = page === 'stock' && !!m.alertDate && m.alertDate <= today

        return (
          <div
            key={m.id}
            className={`rounded-lg px-3 py-2 text-xs whitespace-pre-wrap break-words ${
              isAlert
                ? 'bg-orange-50 border border-orange-300 text-orange-900'
                : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            }`}
          >
            {isAlert && (
              <span className="inline-flex items-center gap-0.5 text-orange-500 font-semibold mr-1 mb-0.5">
                🔔 {m.alertDate}
              </span>
            )}
            {m.symbol && naverUrl && (
              <a
                href={naverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-blue-600 hover:text-blue-800 mr-1.5 mb-0.5"
                onClick={e => e.stopPropagation()}
              >
                {m.symbol} ↗
              </a>
            )}
            {m.content}
          </div>
        )
      })}
    </div>
  )
}
