'use client'

interface Memo {
  id: string
  content: string
  showOnMain: boolean
}

interface Props {
  memos: Memo[]
}

export default function MemoStrip({ memos }: Props) {
  const visible = memos.filter(m => m.showOnMain)
  if (visible.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {visible.map(m => (
        <div
          key={m.id}
          className="flex-shrink-0 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 max-w-[200px] whitespace-pre-wrap break-words"
        >
          {m.content}
        </div>
      ))}
    </div>
  )
}
