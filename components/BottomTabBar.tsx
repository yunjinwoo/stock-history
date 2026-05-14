'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function BottomTabBar() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const isMore = pathname === '/accounts' || pathname === '/stock-master'

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
      )}
      {showMore && (
        <div className="fixed bottom-14 right-0 bg-white border border-gray-200 rounded-tl-xl shadow-lg z-50 overflow-hidden w-36">
          <Link
            href="/stock-master"
            onClick={() => setShowMore(false)}
            className="block px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b"
          >
            종목관리
          </Link>
          <Link
            href="/accounts"
            onClick={() => setShowMore(false)}
            className="block px-5 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            계좌관리
          </Link>
        </div>
      )}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t z-30 flex h-14">
        <Link
          href="/"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${pathname === '/' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-[10px] font-medium">주식</span>
        </Link>
        <Link
          href="/coins"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${pathname === '/coins' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12" />
            <path d="M15.5 9H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8.5" />
          </svg>
          <span className="text-[10px] font-medium">코인</span>
        </Link>
        <Link
          href="/memos"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${pathname === '/memos' ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="text-[10px] font-medium">메모</span>
        </Link>
        <button
          onClick={() => setShowMore(v => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 ${(isMore || showMore) ? 'text-blue-600' : 'text-gray-400'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
          <span className="text-[10px] font-medium">더보기</span>
        </button>
      </nav>
    </>
  )
}
