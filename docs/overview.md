# 프로젝트 개요

## 이 앱은 무엇인가

증권사 카카오톡 알림을 붙여넣어 주식·코인 매매 기록을 쌓고, 종목별 보유기간·손익을 조회하는 개인용 웹앱입니다.

## 기술 스택

| 역할 | 기술 | 설명 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router) | 프론트엔드 + API 서버를 하나의 프로젝트로 관리 |
| 스타일 | Tailwind CSS | 클래스명으로 스타일 적용 |
| DB | SQLite + Prisma 6 | 파일 기반 DB, Prisma가 ORM 역할 |
| 날짜 계산 | day.js | 보유일 계산 등 |
| 언어 | TypeScript | 타입 안전성 |

## 배포 환경

- VPS: `49.247.202.50`
- nginx 경로: `/stock/` → 포트 `3002`로 프록시
- 프로세스 관리: PM2 (`stock-history` 앱 이름)
- basePath: `/stock` (next.config.ts에 설정, 모든 URL 앞에 붙음)

## 화면 구성

```
/stock/           → 주식 매매일지 메인
/stock/coins      → 코인 매매일지
/stock/memos      → 메모 관리
/stock/accounts   → 계좌 관리
/stock/stock-master → 종목 마스터 관리
```
