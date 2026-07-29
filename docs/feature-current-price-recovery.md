# 현재가 연동 및 손실 회복 계산기

## 개요

같은 서버에서 별도로 도는 파이썬 앱이 종목코드로 현재가를 조회하는 API를 제공합니다.
이 앱은 그 API를 프록시해서 보유 종목의 실시간 평가손익을 보여주고, 큰 폭으로 물린 종목을
"소액 반복 매매로 얼마나 더 하면 손실률을 목표치 이하로 낮출 수 있는지" 계산해주는
손실 회복 계산기를 제공합니다.

---

## 현재가 연동

### 외부 API

파이썬 앱이 제공하는 엔드포인트 (이 프로젝트 코드가 아님):

```
GET /api/stock-price?codes=005930,000660,035420
→ { "status": "success", "count": 3, "data": [
    { "code": "005930", "name": "삼성전자", "price": "270000", "change": "9500", "change_rate": "3.65", ... },
    ...
  ]}
```

- 로컬 개발: `http://localhost:5000/api/stock-price`
- 운영: nginx가 같은 서버에서 `/upbit/api/stock-price`로 프록시 — `http://localhost/upbit/api/stock-price`

### 이 프로젝트의 프록시

`app/api/stock-price/route.ts`가 위 외부 API를 감싸서 제공합니다.

```ts
const UPSTREAM_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000/api/stock-price'
  : 'http://localhost/upbit/api/stock-price'
```

브라우저에서 외부 IP로 직접 호출하면 로컬 개발 환경에서 CORS/네트워크 문제가 생길 수 있어서,
항상 Next.js 서버를 거쳐 `GET /api/stock-price?codes=...` 형태로 호출합니다.

### 클라이언트 사용처

`app/page.tsx`가 `priceMap: Record<symbolCode, price>` 상태를 들고 있고,
"보유 종목" 요약 표의 **현재가 새로고침** 버튼을 누르면 보유중(`!isCompleted`) 거래들의
`symbolCode`를 모아 한 번에 조회합니다.

```
"현재가 새로고침" 클릭
  → holding.map(t => t.symbolCode) 중복 제거
  → GET /api/stock-price?codes=... (apiFetch)
  → priceMap 갱신 (symbolCode → price)
```

`priceMap`은 `TradeHistory`(계좌별 카드 목록)와 `TradeChart`(상세 차트)에 prop으로 전달되어
같은 값을 공유합니다. **버튼 하나로 두 군데가 동시에 갱신됩니다.**

- `TradeHistory.tsx`: 보유중 카드 헤더에 평가손익(금액 + 수익률) 표시
- `TradeChart.tsx`: 보유중 거래에 한해 오늘 날짜 위치에 평균가(파란 다이아몬드)·현재가(초록 별) 점 표시.
  목표가/손절가는 기존처럼 가로 기준선(ReferenceLine)으로 유지

> 코인(`CoinTrade`)에는 `symbolCode` 개념이 없어서 이 기능은 주식에만 적용됩니다.

---

## 손실 회복 계산기

### 왜 필요한가

크게 물린 종목을 "소액으로 짧게 여러 번 사고팔아서 평균단가를 낮추고, 그 실현이익을 모아
전체 손실률을 목표치 이하로 회복시키는" 전략을 쓸 때, "몇 번 정도 더 해야 하는지"를
매번 손으로 계산하기 번거로워서 만든 기능입니다.

`TradeHistory.tsx`의 거래 상세(펼침) 안, "예상 매도가" 아래에 **"▼ 손실 회복 계산기"**로
접혀 있고, 보유중인 거래에서만 나타납니다.

### 계산식 (`calcRecovery` in `TradeHistory.tsx`)

입력값 (거래별로 따로 입력, 새로고침하면 초기화되는 화면 전용 상태 — DB 저장 안 함):

| 입력 | 기본값 | 의미 |
|------|--------|------|
| 목표 손실률 | 50% | 이 손실률 이하로 낮추는 게 목표 |
| 회당 투자금 | 500,000원 | 한 사이클(추가매수→매도)에 쓸 금액 |
| 목표 수익률 (최소~최대) | 3~5% | 한 사이클에서 노리는 수익률 범위 |

계산:

```
costBasis   = 평균매수가 × 잔여수량              # 현재 남아있는 포지션의 원가
currentValue = 현재가 × 잔여수량                  # 현재 평가금액 (현재가 새로고침 필요)
현재 손실률  = (1 - currentValue / costBasis) × 100

targetValue = costBasis × (1 - 목표손실률 / 100)
필요금액    = max(0, targetValue - currentValue)

회당이익(최소/최대) = 회당투자금 × 목표수익률(최소/최대) / 100
전체 필요 횟수(최소~최대) = 필요금액 / 회당이익(최대~최소)
```

### 진행률 — 왜 "실현손익"이 아니라 "매도 횟수"로 비교하는가

처음에는 `trade.profitAmount`(전체 블렌디드 평균단가 기준 실현손익)로 진행률을 계산했는데,
물타기 직후에는 전체 평균단가가 여전히 원래의 높은 매수가에 가까워서, 사이클 하나의
실현이익(예: +50,000원)이 전체 블렌디드 손익 계산에는 거의 반영되지 않는(오히려 더
마이너스로 보이는) 문제가 있었습니다.

그래서 대신 **실제로 기록된 매도 건수(`trade.sellEntries.length`)**를 "전체 필요 횟수"와
비교하는 방식으로 바꿨습니다 — 정확한 금액 진행률은 아니지만, 실제 매매 행위 대비
계산이 얼마나 앞서/뒤처져 있는지를 왜곡 없이 보여줍니다.

```
지금까지 매도 횟수 = trade.sellEntries.length
진행률 = min(100, 지금까지매도횟수 / 전체필요횟수(최대) × 100)
남은 횟수 = max(0, 전체필요횟수 - 지금까지매도횟수)
```

> 주의: `sellEntries.length`는 이 거래에 기록된 **모든** 매도를 세기 때문에, 회복 계산과
> 무관한 이전 매도가 있었다면 진행률이 실제보다 높게 잡힐 수 있습니다.
