import type { Metadata } from 'next'
import './globals.css'
import BottomTabBar from '@/components/BottomTabBar'

export const metadata: Metadata = { title: '매매일지' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === 'development'
  return (
    <html lang="ko">
      <body className={`${isDev ? 'bg-amber-50' : 'bg-gray-50'} text-gray-800`}>
        {children}
        <div className="h-14 sm:hidden" />
        <BottomTabBar />
      </body>
    </html>
  )
}
