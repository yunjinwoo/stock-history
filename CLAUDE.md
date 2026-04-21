# stock-history — 주식 매매일지

## 프로젝트 한 줄 요약
증권사 카톡 알림을 붙여넣어 매매 기록을 쌓고, 종목별 보유 기간·손익을 조회하는 웹앱.

## 서버 정보
| 항목 | 값 |
|------|-----|
| 포트 | **3002** |
| nginx 경로 | `/stock/` |
| VPS | 49.247.202.50 (deploy-user) |
| PM2 앱 이름 | `stock-history` |

## 기술 스택
| 역할 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 스타일 | Tailwind CSS |
| DB | SQLite (Prisma 6) |
| 날짜 | day.js |

## 파일 구조
```
stock-history/
├── app/
│   ├── page.tsx                  # 메인 목록
│   ├── accounts/page.tsx         # 계좌 관리 페이지
│   └── api/
│       ├── trades/route.ts       # GET, POST
│       ├── trades/[id]/route.ts  # PATCH, DELETE
│       ├── accounts/route.ts     # GET, POST
│       └── accounts/[id]/route.ts# PATCH, DELETE
├── components/
│   ├── TradeCard.tsx             # 종목 카드
│   ├── TradeModal.tsx            # 입력/수정 모달 (직접입력 + 카톡 탭)
│   ├── KakaoParser.tsx           # 카톡 붙여넣기 → 폼 자동 채움
│   ├── SummaryBar.tsx            # 요약 통계 바
│   ├── AccountList.tsx           # 계좌 목록
│   └── AccountMemoEditor.tsx     # 계좌 메모 인라인 편집
├── prisma/
│   └── schema.prisma             # Prisma 스키마 (accounts + trades)
├── lib/
│   ├── db.ts                     # PrismaClient 싱글턴
│   ├── types.ts                  # 공유 타입 정의
│   ├── utils.ts                  # enrichTrade, formatKRW 등
│   └── kakaoParser.ts            # 증권사별 파싱 유틸
├── skills/
│   └── kakaoParser.md            # 증권사별 파싱 패턴 레퍼런스
├── SPEC.md                       # 기획 명세서
└── CLAUDE.md                     # 이 파일
```

## 핵심 규칙

### 파싱
- 파싱 로직 작성 전 반드시 `skills/kakaoParser.md` 참조
- 파싱 실패 시 throw 금지 → `null` 반환 후 UI에서 빈 폼 유지
- 새 증권사 추가 시 `kakaoParser.ts`에 파서 함수 1개만 추가, 기존 코드 수정 최소화
- `lib/kakaoParser.ts` 작성 시 반드시 `lib/kakaoParser.test.ts`도 함께 작성
  - 테스트 프레임워크: Vitest
  - 각 증권사별 실제 알림 텍스트(skills/kakaoParser.md의 예시)를 테스트 케이스로 사용
  - 파싱 성공 케이스 + 파싱 실패(빈 문자열, 엉뚱한 텍스트) 케이스 포함

### 날짜
- 알림 문자에 날짜 없음 → 파싱 시점의 `new Date()`로 날짜 세팅
- 시간 정보 있으면 포함, 없으면 시간 필드 비워둠
- 저장 전 사용자가 폼에서 직접 수정 가능

### 계좌
- 거래(Trade)는 반드시 계좌(Account)에 속함 — `accountId` 필수
- 카톡 파싱 시 계좌번호가 기존 accounts 테이블에 없으면 신규 등록 제안 UI 표시
- 계좌 삭제 전 연결된 trades 존재 여부 확인 후 경고
- 계좌 메모는 Account.memo 단일 필드로 관리 (별도 메모 테이블 불필요)

### 데이터 계산
- `holdingDays`, `profitAmount`, `profitRate` 는 DB 저장 안 함 → 조회 시 계산
- 보유중(sellDate 없음)이면 오늘 기준으로 보유일 계산

### UI
- 보유중 종목은 목록 상단 고정
- 코멘트는 목록에서 30자 + 말줄임표, 클릭 시 모달로 전체 표시

## 스킬 참조
| 파일 | 내용 |
|------|------|
| [skills/kakaoParser.md](skills/kakaoParser.md) | 증권사별 실제 알림 포맷 및 정규식 패턴 |
