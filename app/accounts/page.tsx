'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Account } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import AccountList from '@/components/AccountList'
import BackupList from '@/components/BackupList'

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [otp, setOtp] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null)
  const [otpSending, setOtpSending] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const data = await apiFetch('/api/accounts').then(r => r.json())
    setAccounts(data)
  }

  useEffect(() => { load() }, [])

  // 인증번호 남은 시간 표시용
  useEffect(() => {
    if (!otpExpiresAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [otpExpiresAt])

  const otpLeftSec = otpExpiresAt ? Math.max(0, Math.ceil((otpExpiresAt - now) / 1000)) : 0

  async function requestOtp() {
    setOtpSending(true)
    setRestoreMsg(null)
    try {
      const res = await apiFetch('/api/restore/otp', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setOtpExpiresAt(d.expiresAt)
        setNow(Date.now())
        setOtp('')
        setRestoreMsg({ ok: true, text: '슬랙으로 인증번호를 보냈습니다. 5분 안에 입력하세요.' })
      } else {
        setRestoreMsg({ ok: false, text: d.error ?? '인증번호 발송 실패' })
      }
    } finally {
      setOtpSending(false)
    }
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  function handleBackup() {
    window.location.href = `${base}/api/backup`
  }

  function handleExport(type: 'trades' | 'memos') {
    window.location.href = `${base}/api/export/${type}`
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm(`"${file.name}" 파일로 DB를 복원하시겠습니까?\n현재 데이터는 덮어씌워집니다.`)) {
      e.target.value = ''
      return
    }
    setRestoring(true)
    setRestoreMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('otp', otp)
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
      const res = await fetch(`${base}/api/restore`, { method: 'POST', body: form })
      if (res.ok) {
        setRestoreMsg({ ok: true, text: '복원 완료. 페이지를 새로고침해주세요.' })
        setOtp('')
        setOtpExpiresAt(null)
      } else {
        const { error } = await res.json()
        setRestoreMsg({ ok: false, text: `복원 실패: ${error ?? '알 수 없는 오류'}` })
      }
    } catch {
      setRestoreMsg({ ok: false, text: '복원 중 오류가 발생했습니다.' })
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← 돌아가기</Link>
        <h1 className="text-lg font-bold">계좌 관리</h1>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        <AccountList accounts={accounts} onRefresh={load} />

        {/* 백업 / 복원 */}
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">데이터 백업 / 복원</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleBackup}
              className="text-sm px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
            >
              DB 백업 다운로드
            </button>
            <button
              onClick={() => handleExport('trades')}
              className="text-sm px-4 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50"
            >
              거래내역 엑셀
            </button>
            <button
              onClick={() => handleExport('memos')}
              className="text-sm px-4 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              메모 엑셀
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={requestOtp}
              disabled={otpSending}
              className="text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
            >
              {otpSending ? '보내는 중...' : otpExpiresAt ? '인증번호 다시 받기' : '인증번호 받기'}
            </button>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="인증번호 6자리"
              disabled={!otpExpiresAt || otpLeftSec === 0}
              className="text-sm px-3 py-2 rounded border border-gray-300 w-32 tabular-nums tracking-widest focus:outline-none focus:ring-1 focus:ring-orange-300 disabled:bg-gray-50"
            />
            {otpExpiresAt && (
              <span className={`text-xs tabular-nums ${otpLeftSec === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {otpLeftSec === 0 ? '만료됨' : `${Math.floor(otpLeftSec / 60)}:${String(otpLeftSec % 60).padStart(2, '0')}`}
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={restoring || otp.length !== 6 || otpLeftSec === 0}
              className="text-sm px-4 py-2 rounded border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
            >
              {restoring ? '복원 중...' : '백업 파일로 복원'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".db"
              className="hidden"
              onChange={handleRestore}
            />
          </div>
          {restoreMsg && (
            <p className={`text-sm ${restoreMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
              {restoreMsg.text}
            </p>
          )}
          <p className="text-xs text-gray-400">
            복원하려면 먼저 슬랙으로 받은 인증번호(5분 유효, 1회용)를 입력하세요. 복원 후 스키마가 자동으로 동기화됩니다. 복원 완료 시 페이지를 새로고침하세요.
          </p>
        </div>

        <BackupList />
      </div>
    </div>
  )
}
