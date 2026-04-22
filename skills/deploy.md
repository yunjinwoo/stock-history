# 배포 가이드 — stock-history

## 서버 정보
| 항목 | 값 |
|------|-----|
| VPS | `$SERVER_IP` (GitHub Secret) |
| 사용자 | `$SERVER_USER` (GitHub Secret) |
| 앱 경로 | `~/stock-history` |
| 포트 | 3002 |
| nginx 경로 | `/stock` |
| PM2 앱 이름 | `stock-history` |
| DB 파일 | `~/stock-history/data/stock-history.db` |

---

## CI/CD (GitHub Actions)

`main` 브랜치에 push하면 자동 배포됩니다.

### 필요한 GitHub Secrets
| Secret | 내용 |
|--------|------|
| `SERVER_IP` | VPS IP 주소 |
| `SERVER_USER` | SSH 접속 계정명 |
| `SSH_PRIVATE_KEY` | SSH 개인키 (PEM 형식) |

### 배포 흐름
```
git push origin main
  → GitHub Actions 실행
  → npm install + prisma generate + next build  (CI/Linux)
  → .next/standalone/ 에 실행 파일 + 최소 node_modules 자동 생성
  → .next/standalone/ → SCP 전송  (서버에서 npm install 불필요)
  → 서버: prisma db push  (스키마 변경 반영)
  → 서버: PORT=3002 pm2 start server.js
```

> **standalone 모드**: `output: 'standalone'` 설정으로 서버에서 `npm install` 없이 바로 실행 가능.
> 저사양 VPS에서 배포 속도가 크게 빨라짐.

---

## 최초 서버 세팅 (최초 1회만)

> Node.js, PM2가 이미 설치된 서버라면 아래 한 줄만 실행하면 됩니다.
> 이후 배포는 `git push`로 자동 처리됩니다.

```bash
ssh $SERVER_USER@$SERVER_IP

# Prisma CLI 전역 설치 (v6 고정 — 프로젝트가 Prisma 6 사용, v7과 schema 형식 다름)
sudo npm install -g prisma@6

# DB 저장 폴더 생성 (없으면 Prisma가 SQLite 파일 생성 불가 → 500 에러)
mkdir -p ~/stock-history/.next/standalone/data
```

<details>
<summary>Node.js / PM2 미설치 서버라면 펼치기</summary>

```bash
# Node.js 설치 (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 24 && nvm use 24

# PM2 전역 설치 + 재부팅 자동시작
npm install -g pm2
pm2 startup   # → 출력된 sudo 명령어 실행
```
</details>

---

## nginx 설정

`/etc/nginx/sites-available/default` (또는 해당 설정 파일)에 추가:

```nginx
# 5. Stock History (경로: /stock)
# ※ rewrite 사용 안 함 — Next.js basePath: '/stock' 이 직접 처리
location /stock {
    proxy_pass http://localhost:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 수동 배포 (긴급 시)

```bash
ssh $SERVER_USER@$SERVER_IP
cd ~/stock-history
npm install --omit=dev
npx prisma db push
pm2 restart stock-history || pm2 start npm --name "stock-history" -- start
pm2 save
```

---

## PM2 자주 쓰는 명령

```bash
pm2 list                        # 프로세스 목록
pm2 logs stock-history          # 실시간 로그
pm2 logs stock-history --lines 100  # 최근 100줄
pm2 restart stock-history       # 재시작
pm2 stop stock-history          # 중지
```

---

## 주의사항

- `data/stock-history.db` (SQLite)는 배포 시 **덮어쓰지 않음** — SCP 전송 대상에 포함 안 됨
- 스키마 변경 시 `prisma db push` 가 서버에서 자동 실행됨 (데이터 유지)
- `better-sqlite3` 는 Node.js 24 + Windows(VS Build Tools 없음) 환경에서 빌드 불가 → **Prisma 사용**

---

## 트러블슈팅 — 실제 발생한 문제들

### API 호출 405 에러 (`POST /api/accounts`)
- **원인**: Next.js `basePath: '/stock'`은 페이지 라우팅에만 적용됨. 클라이언트 `fetch('/api/...')`는 자동으로 prefix가 붙지 않아 nginx에서 경로 없음 → 405
- **해결**: `lib/api.ts`의 `apiFetch` 헬퍼 사용. `NEXT_PUBLIC_BASE_PATH`를 자동으로 붙여줌
- **주의**: 새 컴포넌트 작성 시 `fetch()` 직접 사용 금지, 반드시 `apiFetch()` 사용

### SCP 전송 후 `standalone/` 경로 오류
- **원인**: `source: ".next/standalone"` 지정 시 SCP가 디렉토리 구조 그대로 보존 → 서버에 `~/stock-history/.next/standalone/`으로 생성됨
- **해결**: SSH 스크립트에서 `cd ~/stock-history/.next/standalone` 사용

### `prisma db push` 실패 — Module not found
- **원인**: standalone은 런타임 deps만 포함. prisma CLI(`prisma` 패키지)와 `@prisma/engines` 미포함
- **해결**: 서버에 `sudo npm install -g prisma@6` 전역 설치 (최초 1회)

### `npm install -g` 중 `Killed`
- **원인**: 저사양 VPS RAM 부족
- **해결**: swap 1GB 추가
```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Prisma v7 설치 오류 (`url` 속성 미지원)
- **원인**: `npm install -g prisma` 버전 미지정 → v7 설치됨. v7은 `schema.prisma`의 `url =` 제거, `prisma.config.ts` 필요
- **해결**: `sudo npm install -g prisma@6` (프로젝트가 Prisma 6 기준)

### 계좌 목록 미표시
- **원인**: `AccountList`의 `useState(accounts)`는 초기값(`[]`)만 사용. 부모 컴포넌트가 API 호출 후 prop을 업데이트해도 내부 `list` 상태가 갱신되지 않음
- **해결**: `useEffect(() => { setList(accounts) }, [accounts])` 추가
