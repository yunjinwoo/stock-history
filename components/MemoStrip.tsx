'use client'

interface Memo {
  id: string
  content: string
  showOnMain: boolean
  showOnCoin: boolean
}

interface Props {
  memos: Memo[]
  page: 'stock' | 'coin'
}

export default function MemoStrip({ memos, page }: Props) {
  const visible = memos.filter(m => page === 'stock' ? m.showOnMain : m.showOnCoin)
  if (visible.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {visible.map(m => (
        <div
          key={m.id}
          className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 whitespace-pre-wrap break-words"
        >
          {m.content}
        </div>
      ))}
    </div>
  )
}
