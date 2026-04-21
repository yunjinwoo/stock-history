'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Account } from '@/lib/types'
import AccountList from '@/components/AccountList'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])

  async function load() {
    const data = await fetch('/api/accounts').then(r => r.json())
    setAccounts(data)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 돌아가기</Link>
        <h1 className="text-lg font-bold">계좌 관리</h1>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <AccountList accounts={accounts} onRefresh={load} />
      </div>
    </div>
  )
}
