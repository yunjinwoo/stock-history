# 파일 구조 및 역할

```
stock-history/
├── app/                          # Next.js 페이지 + API 라우트
│   ├── layout.tsx                # 전체 공통 레이아웃 (html, body 태그)
│   ├── page.tsx                  # 주식 매매일지 메인 페이지
│   ├── coins/page.tsx            # 코인 매매일지 페이지
│   ├── memos/page.tsx            # 메모 관리 페이지
│   ├── accounts/page.tsx         # 계좌 관리 페이지
│   ├── stock-master/page.tsx     # 종목 마스터 관리 페이지
│   └── api/                      # API 엔드포인트
│       ├── trades/
│       │   ├── route.ts          # GET(목록 조회), POST(새 거래 저장)
│       │   └── [id]/route.ts     # PATCH(수정), DELETE(삭제)
│       ├── coins/
│       │   ├── route.ts          # GET(목록), POST(저장 — 중복 병합 포함)
│       │   ├── [id]/route.ts     # PATCH, DELETE
│       │   └── entries/route.ts  # POST(단일 내역 추가 — 종목 find-or-create)
│       ├── accounts/
│       │   ├── route.ts          # GET, POST
│       │   └── [id]/route.ts     # PATCH, DELETE
│       ├── memos/
│       │   ├── route.ts          # GET, POST
│       │   └── [id]/route.ts     # PATCH, DELETE
│       └── stock-master/
│           ├── route.ts          # GET, POST(upsert + 기존 trades 일괄 업데이트)
│           └── [id]/route.ts     # PATCH, DELETE
│
├── components/                   # 재사용 UI 컴포넌트
│   ├── TradeModal.tsx            # 주식 거래 입력/수정 모달
│   ├── KakaoParser.tsx           # 카톡 알림 붙여넣기 UI
│   ├── TradeHistory.tsx          # 주식 목록 테이블 (계좌별 그룹)
│   ├── TradeCard.tsx             # 주식 카드형 뷰 아이템
│   ├── TradeCalendar.tsx         # 주식 캘린더형 뷰
│   ├── TradeTable.tsx            # 거래 내역 서브 테이블
│   ├── SummaryBar.tsx            # 상단 요약 통계 바
│   ├── CoinModal.tsx             # 코인 거래 입력/수정 모달
│   ├── CoinHistory.tsx           # 코인 목록
│   ├── MemoStrip.tsx             # 핀 메모 표시 띠
│   ├── AccountList.tsx           # 계좌 목록
│   └── AccountMemoEditor.tsx     # 계좌 메모 인라인 편집
│
├── lib/                          # 공통 로직
│   ├── types.ts                  # 공유 TypeScript 타입 정의
│   ├── db.ts                     # Prisma 클라이언트 싱글턴
│   ├── api.ts                    # apiFetch 헬퍼 (basePath 자동 적용)
│   ├── utils.ts                  # 계산 함수, 포맷 함수 모음
│   ├── kakaoParser.ts            # 증권사별 카톡 알림 파서
│   ├── kakaoParser.test.ts       # 파서 Vitest 테스트
│   └── coinParser.ts             # 코인 거래소 붙여넣기 파서
│
├── prisma/
│   └── schema.prisma             # DB 스키마 정의
│
├── docs/                         # 이 문서들
├── skills/                       # 개발 참고 자료
│   ├── kakaoParser.md            # 증권사별 실제 알림 포맷
│   └── deploy.md                 # 서버 배포 가이드
├── next.config.ts                # Next.js 설정 (basePath 등)
└── CLAUDE.md                     # AI 개발 보조용 규칙 문서
```

## 핵심 파일 한 줄 설명

| 파일 | 한 줄 설명 |
|------|-----------|
| `lib/types.ts` | 앱 전체에서 사용하는 데이터 형태 정의 |
| `lib/db.ts` | DB 연결 객체를 하나만 만들어 재사용 |
| `lib/api.ts` | 모든 API 호출에 `/stock` 경로를 자동으로 앞에 붙임 |
| `lib/utils.ts` | 손익 계산, 날짜 포맷 등 여러 곳에서 쓰는 함수 모음 |
| `lib/kakaoParser.ts` | 증권사 카톡 알림 문자를 파싱해서 구조화된 데이터로 변환 |
| `lib/coinParser.ts` | 코인 거래소 거래내역 붙여넣기를 파싱 |
| `prisma/schema.prisma` | DB 테이블 구조 정의 (변경 후 `npx prisma db push` 필요) |
