// 앱 전체 메뉴 정의 — 데스크톱 헤더(StockNav)와 모바일 하단 탭바(BottomTabBar)가 함께 사용
// 메뉴를 추가·이동할 때는 이 파일만 고치면 된다.

export interface NavLink {
  href: string
  label: string
}

export interface NavGroup {
  key: string
  label: string
  items: NavLink[]
  // true면 데스크톱 헤더에서 드롭다운 대신 항목을 버튼으로 바로 노출
  inline?: boolean
}

// 항상 보이는 기록 탭 (모바일 하단 탭과 동일)
export const PRIMARY_LINKS: NavLink[] = [
  { href: '/', label: '주식' },
  { href: '/coins', label: '코인' },
  { href: '/memos', label: '메모' },
]

// 드롭다운으로 묶이는 메뉴
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'analysis',
    label: '분석',
    items: [
      { href: '/stats', label: '통계' },
      { href: '/reviews', label: '복기' },
      { href: '/strategies', label: '전략' },
      { href: '/first-entries', label: '최초진입(주식)' },
      { href: '/coin-first-entries', label: '최초진입(코인)' },
    ],
  },
  {
    key: 'tools',
    label: '도구',
    inline: true,
    items: [
      { href: '/calculator', label: '계산기' },
    ],
  },
  {
    key: 'settings',
    label: '설정',
    items: [
      { href: '/stock-master', label: '종목관리' },
      { href: '/accounts', label: '계좌관리·백업' },
    ],
  },
]

export function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}
