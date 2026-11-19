'use client'

// 진입·청산 이유 한 번 탭 선택 — 같은 칩을 다시 누르면 해제
export default function ReasonChips({ options, value, onChange, size = 'sm' }: {
  options: readonly string[]
  value: string | null | undefined
  onChange: (v: string | null) => void
  size?: 'xs' | 'sm'
}) {
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = value === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? null : o)}
            className={`${pad} rounded-full border whitespace-nowrap ${on ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
