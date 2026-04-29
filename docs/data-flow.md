# 데이터 흐름

## 1. 주식 거래 저장 흐름

### 경로 A — 직접 입력

```
사용자가 폼 작성
  → TradeModal.tsx (handleSubmit)
  → POST /api/trades
  → app/api/trades/route.ts (POST)
    ① StockMaster에서 symbol 조회 → symbolCode 자동 세팅
    ② symbolCode가 있고 마스터에 없으면 자동 등록
    ③ prisma.trade.create() + buyEntries/sellEntries 함께 생성
    ④ enrichTrade()로 계산 필드 추가
  → 201 응답
  → onSave() 콜백 → load() 재호출 → 목록 갱신
```

### 경로 B — 카톡 붙여넣기

```
사용자가 카톡 알림 텍스트 붙여넣기
  → KakaoParser.tsx (textarea onChange)
  → lib/kakaoParser.ts (parseKakaoNotification)
    - 증권사별 파서 순서대로 시도
    - 한국투자증권 / KB증권 / 키움증권 / 미확인 패턴 순
  → ParsedTrade 반환
  → TradeModal.tsx (handleParsed)
    - 폼에 symbol, price, quantity, symbolCode 자동 채움
    - accountNumber로 기존 계좌 자동 매칭 시도
    - '직접 입력' 탭으로 전환
  → 사용자가 확인 후 저장 → 경로 A와 동일
```

## 2. 코인 거래 저장 흐름

### 경로 A — 단일 내역 추가 (내역 추가 버튼)

```
사용자가 종목명 입력 후 매수/매도 정보 입력
  → CoinModal.tsx
  → POST /api/coins/entries
  → app/api/coins/entries/route.ts
    ① symbol로 기존 CoinTrade 조회
    ② 없으면 새로 생성 (find-or-create 패턴)
    ③ 중복 체크 (날짜+가격+수량이 같으면 skip)
    ④ buyEntry 또는 sellEntry 추가
```

### 경로 B — 거래내역 붙여넣기 (코인)

```
사용자가 거래소 거래내역 복사 붙여넣기
  → CoinModal.tsx (paste 탭)
  → lib/coinParser.ts (parsePastedText)
    - 헤더 행 제거
    - 10줄 단위로 블록 파싱
    - 날짜, 종목, 구분, 수량, 가격 추출
  → 파싱된 내역 배열 반환
  → POST /api/coins (여러 건 한 번에 전송)
  → app/api/coins/route.ts (POST)
    - symbol이 같은 기존 CoinTrade 조회
    - 있으면 중복 없는 항목만 병합
    - 없으면 새로 생성
```

## 3. 데이터 조회 흐름

```
페이지 로드 / 필터 변경
  → load() 함수 (useCallback)
  → GET /api/trades?accountId=&status=&search=
  → app/api/trades/route.ts (GET)
    ① Prisma로 DB 조회 (buyEntries, sellEntries 포함)
    ② enrichTrade()로 계산 필드 추가
      - avgBuyPrice: 평균매수가
      - remainingQuantity: 잔여수량
      - profitAmount: 실현손익
      - profitRate: 손익률
      - holdingDays: 보유일수
      - isCompleted: 매도완료 여부
    ③ status 필터는 DB가 아닌 메모리에서 처리
  → JSON 응답
  → setTrades() → 화면 렌더링
```

## 4. 종목 마스터 연동 흐름

```
마스터에 종목 등록
  → POST /api/stock-master { symbol, symbolCode }
  → app/api/stock-master/route.ts
    ① stockMaster upsert (없으면 생성, 있으면 업데이트)
    ② 같은 symbol의 trades 중 symbolCode 없는 것 일괄 업데이트

새 거래 저장 시
  → POST /api/trades
    ① 마스터에서 symbol 조회
    ② 마스터에 symbolCode 있으면 자동 적용
    ③ 요청에 symbolCode 있고 마스터에 없으면 자동 등록
```

## 5. 계산 필드가 DB에 없는 이유

`avgBuyPrice`, `profitAmount`, `holdingDays` 등은 DB에 저장하지 않습니다.

- **이유**: 매수/매도 내역이 수정될 때마다 다시 계산해야 하므로 저장해두면 오히려 일관성 문제가 생깁니다.
- **방법**: API 응답 시 `enrichTrade()` / `enrichCoinTrade()` 함수가 매번 계산해서 반환합니다.

```
DB에 저장된 것:  accountId, symbol, buyEntries[], sellEntries[]
조회 시 계산:    avgBuyPrice, profitAmount, profitRate, holdingDays, isCompleted
```
