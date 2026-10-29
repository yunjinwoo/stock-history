'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: '주식' },
  { href: '/stats', label: '통계' },
  { href: '/strategies', label: '전략' },
  { href: '/first-entries', label: '최초진입' },
  { href: '/stock-master', label: '종목관리' },
  { href: '/accounts', label: '계좌관리' },
]

// 주식 하위 화면 헤더에 붙는 메뉴 — 좁은 화면에선 헤더 아랫줄로 내려감 (모바일은 하단 탭바 사용)
export default function StockNav({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav className={`hidden sm:flex gap-2 min-w-0 overflow-x-auto w-full lg:w-auto order-last lg:order-none ${className}`}>
      {LINKS.map(l => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm px-3 py-1.5 rounded border whitespace-nowrap shrink-0 ${active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-800'}`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
