# 카카오톡 증권사 알림 파싱 패턴

파싱 함수 시그니처:
```ts
// 성공 시 ParsedTrade 반환, 실패 시 null 반환 (throw 금지)
function parse(text: string): ParsedTrade | null

interface ParsedTrade {
  broker: string
  type: '매수' | '매도'
  symbol: string
  symbolCode?: string
  quantity: number
  price: number       // 주당 단가
  time?: string       // 'HH:mm' 형식, 없으면 undefined
}
```

증권사 식별 → 해당 파서 호출 → `ParsedTrade | null` 반환

---

## 1. 한국투자증권

### 실제 알림 포맷
```
[한국투자증권 체결안내]11:41

*계좌번호:44****16-01
*계좌명:윤진우
*매매구분:현금매수체결
*종목명:비츠로테크(042370)
*체결수량:41주
*체결단가:17,000원
```

### 식별
```ts
text.includes('한국투자증권 체결안내')
```

### 파싱 정규식
```ts
const time      = text.match(/체결안내\](\d{1,2}:\d{2})/)?.[1]
const typeRaw   = text.match(/\*매매구분:[현금\s]*(매수|매도)/)?.[1]
const symbol    = text.match(/\*종목명:(.+?)\(/)?.[1]?.trim()
const symbolCode= text.match(/\*종목명:.+?\((\d+)\)/)?.[1]
const quantity  = Number(text.match(/\*체결수량:([\d,]+)주/)?.[1]?.replace(/,/g, ''))
const price     = Number(text.match(/\*체결단가:([\d,]+)원/)?.[1]?.replace(/,/g, ''))
```

### 특이사항
- 시간이 헤더에 바로 붙어있음 (`체결안내]11:41`)
- 매매구분에 `현금` 접두사 포함 (`현금매수체결`) → 정규식에서 제거

---

## 2. KB증권

### 실제 알림 포맷
```
[KB증권] 주식 체결 안내

■ 계좌: ***-***-*44 [01]
■ 종목명: 대신정보통신
■ 주문수량: 795주
■ 체결금액: 1,491원
■ 내용: 매수체결(80142963)
```

### 식별
```ts
text.includes('[KB증권]')
```

### 파싱 정규식
```ts
const symbol    = text.match(/■ 종목명:\s*(.+)/)?.[1]?.trim()
const quantity  = Number(text.match(/■ 주문수량:\s*([\d,]+)주/)?.[1]?.replace(/,/g, ''))
const price     = Number(text.match(/■ 체결금액:\s*([\d,]+)원/)?.[1]?.replace(/,/g, ''))
const typeRaw   = text.match(/■ 내용:\s*(매수|매도)체결/)?.[1]
```

### 특이사항
- `체결금액` = **주당 단가** (총액 아님, 사용자 확인 완료)
- 종목코드 미제공
- 시간 미제공

---

## 3. 미확인 증권사 (083 계열)

### 실제 알림 포맷
```
계좌명 : 윤진우
계좌번호 : 083-50-3***49
종목명 : 셀바스AI
종목코드 : 108860
체결구분 : 매수체결
체결수량 : 146주
체결단가 : 15300원
-------------------------------
주문수량 : 146주
누적체결수량 : 146주
-------------------------------
체결 내역을 확인해보세요.
```

### 식별
```ts
text.includes('체결구분') && text.includes('체결단가') && !text.includes('[')
```

### 파싱 정규식
```ts
const symbol    = text.match(/종목명\s*:\s*(.+)/)?.[1]?.trim()
const symbolCode= text.match(/종목코드\s*:\s*(\d+)/)?.[1]
const typeRaw   = text.match(/체결구분\s*:\s*(매수|매도)/)?.[1]
const quantity  = Number(text.match(/체결수량\s*:\s*([\d,]+)주/)?.[1]?.replace(/,/g, ''))
const price     = Number(text.match(/체결단가\s*:\s*([\d,]+)원/)?.[1]?.replace(/,/g, ''))
```

### 특이사항
- 브로커 헤더 없음 → 구조 패턴으로 식별
- 종목코드 제공됨 (다른 키워드 없는 브로커 중 유일)
- 시간 미제공

---

## 4. 키움증권

### 실제 알림 포맷
```
[키움]체결통보
대주전자재료
매도11주
평균단가128,500원
```

### 식별
```ts
text.includes('[키움]체결통보')
```

### 파싱 정규식
```ts
const lines     = text.trim().split('\n').map(l => l.trim())
const symbol    = lines[1]   // 헤더 다음 줄
const typeMatch = lines[2]?.match(/(매수|매도)([\d,]+)주/)
const typeRaw   = typeMatch?.[1]
const quantity  = Number(typeMatch?.[2]?.replace(/,/g, ''))
const price     = Number(lines[3]?.match(/평균단가([\d,]+)원/)?.[1]?.replace(/,/g, ''))
```

### 특이사항
- 매우 짧은 형식, 줄 번호 기반 파싱
- `매도11주` 처럼 **공백 없이** 타입+수량 붙어있음
- 종목코드·시간 미제공

---

## 공통 유틸

```ts
// 숫자 문자열 정제 (콤마 제거)
const toNum = (s: string | undefined) => Number(s?.replace(/,/g, '') ?? '0')

// 파싱 결과 유효성 검사
function isValid(p: Partial<ParsedTrade>): p is ParsedTrade {
  return !!(p.symbol && p.quantity && p.price && p.type)
}
```
