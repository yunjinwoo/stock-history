'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { apiFetch } from '@/lib/api'

interface BackupFile { name: string; size: number; createdAt: string }

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

// 파일 이름 stock-history-YYYYMMDD-HHMM.db.gz → 'YYYY-MM-DD HH:mm'
function labelOf(name: string) {
  const m = name.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : name
}

export default function BackupList() {
  const [files, setFiles] = useState<BackupFile[] | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    try {
      const d = await apiFetch('/api/backups').then(r => r.json())
      setFiles(Array.isArray(d?.files) ? d.files : [])
    } catch {
      setFiles([])
    }
  }

  useEffect(() => { load() }, [])

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  async function handleDelete(name: string) {
    if (!confirm(`${labelOf(name)} 백업을 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다.`)) return
    setDeleting(name)
    try {
      const res = await apiFetch(`/api/backups/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) alert('삭제에 실패했습니다.')
      await load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700">서버 자동 백업</h2>
        {files && files.length > 0 && <span className="text-xs text-gray-400">{files.length}개</span>}
      </div>
      {files === null ? (
        <p className="text-xs text-gray-400">불러오는 중...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-400">아직 백업이 없습니다. 매일 03:30에 자동으로 만들어집니다.</p>
      ) : (
        <ul className="divide-y max-h-80 overflow-y-auto -mx-1">
          {files.map(f => (
            <li key={f.name} className="flex items-center gap-2 px-1 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700 tabular-nums">{labelOf(f.name)}</p>
                <p className="text-[11px] text-gray-400">{fmtSize(f.size)} · {dayjs(f.createdAt).format('MM-DD HH:mm')} 저장</p>
              </div>
              <a
                href={`${base}/api/backups/${encodeURIComponent(f.name)}`}
                className="text-xs px-2.5 py-1.5 rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap"
              >
                다운로드
              </a>
              <button
                onClick={() => handleDelete(f.name)}
                disabled={deleting === f.name}
                className="text-xs px-2.5 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 whitespace-nowrap"
              >
                {deleting === f.name ? '삭제 중' : '삭제'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400">
        다운로드한 .db 파일은 위의 &apos;백업 파일로 복원&apos;에 그대로 쓸 수 있습니다. 30일 지난 백업은 자동으로 지워집니다.
      </p>
    </div>
  )
}
