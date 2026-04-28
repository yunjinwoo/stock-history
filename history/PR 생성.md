# PR 생성 — GitHub CLI 사용법

## 시기
제작이력-4 이후

---

## 1. 배경

step5 작업(코인 거래내역, 메모, 캘린더 개선, UX 수정) 완료 후 GitHub PR을 생성하고 싶었음.
기존에는 git 관련 작업을 수동으로 했으나, GitHub CLI(`gh`)를 사용하면 터미널에서 바로 PR 생성 가능.

---

## 2. GitHub CLI 설치 및 인증

### 설치 위치
- Windows 기본 PATH에 포함되지 않는 경우가 있음
- 실제 경로: `C:\Program Files\GitHub CLI\gh.exe`
- PATH에 없으면 전체 경로로 호출: `& "C:\Program Files\GitHub CLI\gh.exe" <명령어>`

### 인증
```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login
```
진행 순서:
1. **GitHub.com** 선택
2. **HTTPS** 선택
3. **Login with a web browser** 선택
4. 브라우저에서 GitHub 로그인 후 one-time code 입력

인증 확인:
```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth status
```

---

## 3. PR 생성 명령어

### PowerShell에서 멀티라인 본문 작성

PowerShell은 bash의 `<<'EOF'` 문법을 지원하지 않음.
대신 `@'...'@` (single-quoted here-string) 사용:

```powershell
$body = @'
## Summary

- 항목 1
- 항목 2

## Test plan

- [ ] 테스트 항목
'@

& "C:\Program Files\GitHub CLI\gh.exe" pr create `
  --title "PR 제목" `
  --body $body `
  --base main `
  --head feature/브랜치명
```

### 주의사항
- `@'...'@` 닫는 태그(`'@`)는 **반드시 줄 맨 앞**에 있어야 함 (들여쓰기 불가)
- `--base`는 병합 대상 브랜치 (보통 `main`)
- `--head`는 현재 작업 브랜치

---

## 4. 실제 생성된 PR

| 항목 | 내용 |
|------|------|
| PR 번호 | [#5](https://github.com/yunjinwoo/stock-history/pull/5) |
| 제목 | 코인 거래내역, 메모, 캘린더 개선 및 UX 수정 |
| base | main |
| head | feature/jinwoo/step5 |

### PR에 포함된 작업
- 코인 거래내역 페이지 (`/coins`) — 계좌 없는 코인 전용 목록/입력/수정/삭제
- 거래소 체결내역 파서 — 10줄 고정 구조, 여러 건 한번에 붙여넣기
- 메모 기능 — 메인 페이지 상단 메모 스트립 + `/memos` 관리 페이지
- 캘린더 뷰 개선 — 최근 6개월 손익 요약 바, 날짜 클릭 시 거래 내역 표시
- UX 수정 — 접기/펼치기, 매도 먼저 입력 허용, 일부매도 표시, 예상 매도가 계산기
- 버그 수정 — `crypto.randomUUID` HTTP 환경 폴백, `formatRate` null/Infinity 가드

---

## 5. 트러블슈팅

### `gh: command not found` 또는 PATH 미등록
- 증상: `gh auth login` 실행 시 명령어를 찾을 수 없음
- 해결: 전체 경로 사용 `& "C:\Program Files\GitHub CLI\gh.exe"` 또는 시스템 환경변수 PATH에 `C:\Program Files\GitHub CLI` 추가

### PowerShell에서 `<<'EOF'` 문법 오류
- 증상: `The '<' operator is reserved for future use` 에러
- 원인: bash 문법(`<<'EOF'`)은 PowerShell에서 동작하지 않음
- 해결: PowerShell here-string 문법 `@'...'@` 사용

### `You are not logged into any GitHub hosts`
- 증상: auth status에서 로그인 안 됨으로 표시
- 해결: `gh auth login` 실행 후 브라우저 인증 완료

---

## 6. 질문 흐름

**Q1. PR 생성 요청**
> "혹시 이상태에서 github에 pr도 생성해줄수있어?"

→ `gh` 명령어를 찾지 못함 → 설치 경로 탐색 → `C:\Program Files\GitHub CLI\gh.exe` 발견

---

**Q2. 인증 추가 후 재시도**
> "추가했어 다시 시도해줘"

→ auth status 확인 → `yunjinwoo` 계정으로 로그인됨 확인
→ PowerShell here-string 문법으로 PR 본문 작성
→ PR #5 생성 완료

---

**Q3. 이력 정리 요청**
> "해당 내용을 정리해서 history에 PR 생성.md 로 추가해줘"

→ 이 파일 작성
