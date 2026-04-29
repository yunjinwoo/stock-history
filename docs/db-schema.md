# DB 스키마

파일 위치: `prisma/schema.prisma`  
DB 파일: `../data/stock-history.db` (SQLite)

> 스키마를 변경하면 반드시 `npx prisma db push`를 실행해야 DB에 반영됩니다.

---

## 테이블 관계도

```
Account ──< Trade ──< BuyEntry
                 ├──< SellEntry
                 └──< TradeImage

CoinTrade ──< CoinBuyEntry
          └──< CoinSellEntry

StockMaster  (독립 테이블 — Trade와 symbol 문자열로 연결, FK 없음)
Memo         (독립 테이블)
```

---

## Account (계좌)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| broker | String | 증권사 이름 (예: 한국투자증권) |
| accountNumber | String | 계좌번호 |
| nickname | String? | 별명 (선택) |
| memo | String? | 계좌 메모 |
| createdAt | String | ISO 8601 문자열 |
| updatedAt | String | ISO 8601 문자열 |

---

## Trade (주식 거래)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| accountId | String | Account FK |
| symbol | String | 종목명 (예: 삼성전자) |
| symbolCode | String? | 종목코드 (예: 005930) |
| comment | String? | 코멘트 |
| createdAt | String | |
| updatedAt | String | |

> `avgBuyPrice`, `profitAmount` 등 계산 필드는 DB에 없음 — 조회 시 `enrichTrade()`가 계산

---

## BuyEntry / SellEntry (주식 매수/매도 내역)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| tradeId | String | Trade FK (삭제 시 cascade) |
| date | String | 거래 일시 (ISO 8601) |
| price | Float | 단가 |
| quantity | Int | 수량 |
| createdAt | String | |

---

## TradeImage (거래 첨부 이미지)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| tradeId | String | Trade FK (삭제 시 cascade) |
| filename | String | 저장된 파일명 (UUID + 확장자) |
| createdAt | String | |

> 실제 파일은 서버 `../data/images/` 디렉터리에 저장됩니다.  
> DB에는 파일명만 저장하고, `/api/images/[filename]`으로 파일을 서빙합니다.  
> Trade 삭제 시 DB 레코드는 cascade로 자동 삭제되지만, 파일은 `DELETE /api/trade-images/[id]` 호출 시에만 삭제됩니다.

---

## CoinTrade / CoinBuyEntry / CoinSellEntry

주식과 구조 동일하나:
- `CoinTrade`에 `accountId` 없음 (코인은 계좌 개념 없음)
- `quantity`가 `Float` (코인은 소수점 수량 가능)

---

## StockMaster (종목 마스터)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| symbol | String | 종목명 (unique) |
| symbolCode | String | 종목코드 |
| createdAt | String | |
| updatedAt | String | |

> Trade와 DB FK 없이 symbol 문자열로 연결됨.  
> 마스터 등록/수정 시 같은 symbol의 Trade들을 코드로 일괄 업데이트.

---

## Memo (메모)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (UUID) | PK |
| content | String | 메모 내용 (최대 200자) |
| showOnMain | Boolean | 주식 페이지에 표시 여부 |
| showOnCoin | Boolean | 코인 페이지에 표시 여부 |
| createdAt | String | |
| updatedAt | String | |

---

## 날짜 타입이 String인 이유

Prisma + SQLite 조합에서 `DateTime` 타입은 내부적으로 문자열로 저장됩니다.  
이 프로젝트는 처음부터 ISO 8601 문자열(`"2024-01-15T09:30:00.000Z"`)로 통일해 관리합니다.  
비교 정렬은 문자열 사전순으로도 올바르게 동작합니다.
