'use client'

import { useState } from 'react'
import { parseKakaoNotification, type ParsedTrade } from '@/lib/kakaoParser'

interface Props {
  onParsed: (result: ParsedTrade) => void
}

export default function KakaoParser({ onParsed }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  function handleParse() {
    const result = parseKakaoNotification(text)
    if (result) {
      setError('')
      setText('')
      onParsed(result)
    } else {
      setError('인식하지 못한 형식입니다. 직접 입력 탭에서 수동으로 입력해주세요.')
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">지원: 한국투자증권, KB증권, 키움증권, 미확인(083계열)</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="카카오톡 알림을 여기에 붙여넣기 하세요"
        className="w-full border rounded p-2 text-sm h-40 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        onClick={handleParse}
        disabled={!text.trim()}
        className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 text-sm font-medium px-4 py-1.5 rounded"
      >
        파싱하기
      </button>
    </div>
  )
}
