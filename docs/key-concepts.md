# 핵심 개념 및 코드 패턴

## 1. basePath와 apiFetch

Next.js에서 `basePath: '/stock'`을 설정하면 모든 URL 앞에 `/stock`이 붙습니다.  
예: `/api/trades` → 실제로는 `/stock/api/trades`

그래서 `fetch('/api/trades')` 직접 호출 대신 `apiFetch`를 씁니다.

```ts
// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''  // '/stock'
export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, init)
```

**주의**: API 호출 시 항상 `apiFetch`를 사용해야 합니다. 직접 `fetch`를 쓰면 배포 환경에서 경로가 맞지 않습니다.

---

## 2. Prisma 싱글턴 패턴

```ts
// lib/db.ts
export const prisma = global._prisma ?? (global._prisma = new PrismaClient())
```

Next.js 개발 환경에서는 파일 변경 시 모듈이 재로드됩니다.  
매번 새 `PrismaClient`를 만들면 DB 연결이 너무 많이 생깁니다.  
`global._prisma`에 저장해서 한 번만 생성하고 재사용합니다.

---

## 3. enrichTrade — 계산 필드 추가

DB에서 꺼낸 거래 데이터는 매수/매도 내역 배열만 있습니다.  
`enrichTrade()`가 이를 받아 화면에 필요한 계산 필드를 추가합니다.

```ts
// lib/utils.ts
export function enrichTrade(t: TradeWithEntries): Trade {
  const totalBuyQuantity = t.buyEntries.reduce((s, e) => s + e.quantity, 0)
  const avgBuyPrice = totalBuyAmount / totalBuyQuantity

  const remainingQuantity = totalBuyQuantity - totalSellQuantity
  const isCompleted = remainingQuantity <= 0

  const profitAmount = totalSellAmount - avgBuyPrice * totalSellQuantity
  // ...
  return { ...t, avgBuyPrice, profitAmount, isCompleted, ... }
}
```

API 라우트에서 DB 조회 직후 항상 `enrichTrade()`를 거쳐 반환합니다.

---

## 4. 카카오 파서 구조

새 증권사 알림 포맷을 지원할 때는 파서 함수 하나만 추가합니다.

```ts
// lib/kakaoParser.ts
export function parseKakaoNotification(text: string): ParsedTrade | null {
  if (!text?.trim()) return null

  // 텍스트 특징으로 어떤 증권사인지 판별
  if (text.includes('한국투자증권 체결안내')) return parseKoreaInvestment(text)
  if (text.includes('[KB증권]'))             return parseKB(text)
  if (text.includes('[키움]체결통보'))        return parseKiwoom(text)
  // ...
  return null  // 파싱 실패 시 null 반환 (throw 안 함)
}
```

**규칙**: 파싱 실패 시 절대 에러를 던지지 않습니다. `null`을 반환하면 UI는 빈 폼을 유지합니다.

---

## 5. 코인 find-or-create 패턴

코인은 같은 종목(symbol)이면 하나의 `CoinTrade`로 묶습니다.

```ts
// app/api/coins/route.ts (POST)
const existing = await prisma.coinTrade.findFirst({ where: { symbol } })

if (existing) {
  // 중복 아닌 항목만 추가 (날짜+가격+수량 모두 같으면 중복)
  const newBuys = makeEntries(buyEntries).filter(e => !isDupBuy(e))
  await prisma.coinBuyEntry.createMany(...)
} else {
  // 새로 생성
  await prisma.coinTrade.create(...)
}
```

---

## 6. 컴포넌트 외부 정의 규칙 (EntrySection)

리액트에서 컴포넌트를 **다른 컴포넌트 함수 안에 정의**하면 렌더링마다 새 함수가 생깁니다.  
리액트는 이를 "다른 컴포넌트"로 인식해 매번 언마운트/마운트를 반복합니다.  
결과: 입력 중 포커스가 날아가는 버그 발생.

```ts
// ❌ 잘못된 방법 — 함수 안에 컴포넌트 정의
export default function TradeModal() {
  function EntrySection() { ... }  // 렌더링마다 새로 생성 → 포커스 버그
}

// ✅ 올바른 방법 — 파일 최상단에 정의
function EntrySection({ entries, onUpdate, ... }: EntrySectionProps) { ... }

export default function TradeModal() {
  // EntrySection을 props로 데이터 전달해서 사용
}
```

---

## 7. 상태 관리 패턴

이 프로젝트는 별도 상태 관리 라이브러리(Redux, Zustand 등) 없이 React `useState` + `useCallback`을 씁니다.

```ts
// 데이터 로드 함수는 useCallback으로 감싸서 useEffect 의존성 배열에 넣음
const load = useCallback(async () => {
  const data = await apiFetch('/api/trades').then(r => r.json())
  if (Array.isArray(data)) setTrades(data)
}, [search, statusFilter])  // 이 값이 바뀔 때마다 load 함수가 새로 만들어짐

useEffect(() => { load() }, [load])  // load가 바뀌면 자동 재호출
```

**흐름**: 필터 변경 → `search` 상태 변경 → `load` 재생성 → `useEffect` 재실행 → API 호출 → `setTrades` → 화면 업데이트

---

## 8. API 라우트 파라미터 패턴

Next.js 15에서 동적 라우트 파라미터(`[id]`)는 Promise로 받아야 합니다.

```ts
// app/api/trades/[id]/route.ts
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Promise!
) {
  const { id } = await params  // await 필수
  ...
}
```

Next.js 14까지는 `params.id`로 직접 접근했지만, 15부터는 변경됐습니다.
