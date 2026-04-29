# 개발 문서 목차

주니어 개발자가 이 프로젝트를 이해하고 기여할 수 있도록 작성된 문서입니다.

## 문서 목록

| 문서 | 내용 |
|------|------|
| [overview.md](./overview.md) | 프로젝트 목적, 기술 스택, 화면 구성 |
| [file-structure.md](./file-structure.md) | 파일/폴더별 역할 설명 |
| [db-schema.md](./db-schema.md) | DB 테이블 구조 및 설계 이유 |
| [data-flow.md](./data-flow.md) | 거래 저장/조회 시 코드 실행 흐름 |
| [key-concepts.md](./key-concepts.md) | 핵심 패턴 및 주의사항 (basePath, enrichTrade, 파서 등) |
| [how-to-add-feature.md](./how-to-add-feature.md) | 새 기능 추가 방법 (페이지/API/DB/파서) |

## 빠른 시작

```bash
# 의존성 설치
npm install

# DB 마이그레이션
npx prisma db push

# 개발 서버 실행 (포트 3002)
npm run dev
```

## 처음 읽는 순서 추천

1. `overview.md` — 전체 그림 파악
2. `db-schema.md` — 데이터 구조 이해
3. `data-flow.md` — 코드 실행 흐름 추적
4. `key-concepts.md` — 자주 쓰는 패턴 숙지
5. `file-structure.md` — 파일 찾는 법 익히기
6. `how-to-add-feature.md` — 실제 기능 추가 시 참고
