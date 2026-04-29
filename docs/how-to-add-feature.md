# 기능 추가 가이드

## 새 페이지 추가하기

1. `app/{페이지명}/page.tsx` 파일 생성
2. 파일 상단에 `'use client'` 추가 (API 호출이나 상태 관리가 있으면)
3. 헤더에 다른 페이지로 가는 링크 추가

```tsx
'use client'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function MyPage() {
  return (
    <div>
      <header>
        <Link href="/">← 돌아가기</Link>
      </header>
    </div>
  )
}
```

---

## 새 API 엔드포인트 추가하기

1. `app/api/{리소스명}/route.ts` 생성
2. GET, POST 함수 export
3. 개별 항목 조작이 필요하면 `app/api/{리소스명}/[id]/route.ts` 추가

```ts
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const data = await prisma.someModel.findMany()
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // 유효성 검사
  if (!body.name) {
    return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const item = await prisma.someModel.create({
    data: { id: crypto.randomUUID(), ...body, createdAt: now, updatedAt: now }
  })
  return NextResponse.json(item, { status: 201 })
}
```

---

## DB 테이블 추가하기

1. `prisma/schema.prisma`에 모델 추가
2. 터미널에서 `npx prisma db push` 실행
3. 서버 재시작 (`prisma generate`가 자동 실행됨)

```prisma
// prisma/schema.prisma에 추가
model NewTable {
  id        String @id
  name      String
  createdAt String
  updatedAt String
}
```

> 개발 서버가 실행 중이면 generate 단계에서 EPERM 오류가 발생할 수 있습니다.  
> 이 경우 서버를 잠깐 종료하고 `npx prisma generate`를 실행하세요.

---

## 새 증권사 파서 추가하기

1. `skills/kakaoParser.md`에서 해당 증권사 알림 포맷 확인
2. `lib/kakaoParser.ts`에 파서 함수 추가
3. `parseKakaoNotification()` 함수에 분기 추가
4. `lib/kakaoParser.test.ts`에 테스트 케이스 추가

```ts
// lib/kakaoParser.ts에 추가
function parseNewBroker(text: string): ParsedTrade | null {
  const symbolMatch = text.match(/종목:\s*(.+)/)
  // ... 정규식으로 필요한 값 추출
  if (!symbolMatch) return null  // 파싱 실패 시 반드시 null 반환

  return {
    broker: '새증권사',
    type: '매수',
    symbol: symbolMatch[1].trim(),
    quantity: 100,
    price: 50000,
  }
}

export function parseKakaoNotification(text: string): ParsedTrade | null {
  // ...기존 코드...
  if (text.includes('새증권사 체결')) return parseNewBroker(text)  // 추가
  return null
}
```

---

## 테스트 실행

```bash
npx vitest run           # 전체 테스트 1회 실행
npx vitest               # watch 모드 (파일 변경 시 자동 재실행)
```

테스트 파일: `lib/kakaoParser.test.ts`
