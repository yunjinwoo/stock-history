'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { NAV_GROUPS, PRIMARY_LINKS, isActive, type NavGroup } from '@/lib/nav'

const BTN = 'text-sm px-3 py-1.5 rounded border whitespace-nowrap shrink-0'
const ON = 'bg-gray-100 text-gray-900 font-medium'
const OFF = 'text-gray-500 hover:text-gray-800'

// 모든 화면 헤더에 붙는 공통 메뉴 (데스크톱) — 모바일은 하단 탭바(BottomTabBar) 사용
// 구성: 주식·코인·메모 | 분석 ▾ · 계산기 · ⚙ 설정 ▾  (항목 정의는 lib/nav.ts)
export default function StockNav({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  // 바깥 클릭·Esc·페이지 이동 시 드롭다운 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  useEffect(() => { setOpen(null) }, [pathname])

  return (
    <>
    <MobileNavStrip pathname={pathname} />
    <nav ref={navRef} className={`hidden sm:flex flex-wrap items-center gap-2 w-full lg:w-auto order-last lg:order-none ${className}`}>
      {PRIMARY_LINKS.map(l => (
        <Link key={l.href} href={l.href} className={`${BTN} ${isActive(l.href, pathname) ? ON : OFF}`}>
          {l.label}
        </Link>
      ))}
      <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden />
      {NAV_GROUPS.map(g =>
        g.inline
          ? g.items.map(l => (
              <Link key={l.href} href={l.href} className={`${BTN} ${isActive(l.href, pathname) ? ON : OFF}`}>
                {l.label}
              </Link>
            ))
          : <NavDropdown
              key={g.key}
              group={g}
              pathname={pathname}
              open={open === g.key}
              onToggle={() => setOpen(v => (v === g.key ? null : g.key))}
            />
      )}
    </nav>
    </>
  )
}

// 모바일 전용: 하단 탭바(주식·코인·메모)에 없는 메뉴를 헤더 아랫줄에 가로 스크롤로 항상 노출
function MobileNavStrip({ pathname }: { pathname: string }) {
  const stripRef = useRef<HTMLElement>(null)
  // 현재 화면 메뉴가 보이도록 가로 스크롤 맞춤
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  return (
    <nav
      ref={stripRef}
      className="sm:hidden order-last w-full -mx-4 px-4 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ width: 'calc(100% + 2rem)' }}
    >
      {NAV_GROUPS.map((g, gi) => (
        <div key={g.key} className="flex items-center gap-1.5 shrink-0">
          {gi > 0 && <span className="w-px h-4 bg-gray-200 mx-0.5" aria-hidden />}
          {g.items.map(i => {
            const active = isActive(i.href, pathname)
            return (
              <Link
                key={i.href}
                href={i.href}
                data-active={active}
                className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {i.short ?? i.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function NavDropdown({ group, pathname, open, onToggle }: {
  group: NavGroup
  pathname: string
  open: boolean
  onToggle: () => void
}) {
  const current = group.items.find(i => isActive(i.href, pathname))
  const isSettings = group.key === 'settings'
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${BTN} inline-flex items-center gap-1 ${current || open ? ON : OFF}`}
      >
        {isSettings && <span aria-hidden>⚙</span>}
        {/* 현재 있는 하위 화면 이름을 함께 표시해 위치를 알기 쉽게 */}
        {current ? `${group.label} · ${current.label}` : group.label}
        <span className="text-[10px] text-gray-400" aria-hidden>▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 min-w-full w-max bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {group.items.map(i => {
            const active = isActive(i.href, pathname)
            return (
              <Link
                key={i.href}
                href={i.href}
                role="menuitem"
                className={`block px-4 py-2 text-sm whitespace-nowrap ${active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {i.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
