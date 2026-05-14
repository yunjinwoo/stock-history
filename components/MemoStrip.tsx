'use client'

interface Memo {
  id: string
  content: string
  showOnMain: boolean
  showOnCoin: boolean
  symbol?: string | null
}

interface Props {
  memos: Memo[]
  page: 'stock' | 'coin'
  symbolCodeMap?: Record<string, string>
}

export default function MemoStrip({ memos, page, symbolCodeMap = {} }: Props) {
  const visible = memos.filter(m => page === 'stock' ? m.showOnMain : m.showOnCoin)
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

        return (
          <div
            key={m.id}
            className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 whitespace-pre-wrap break-words"
          >
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
