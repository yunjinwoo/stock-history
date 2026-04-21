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
  → .next, package.json, next.config.ts, prisma/ → SCP 전송
  → 서버: npm install --omit=dev
  → 서버: prisma db push  (스키마 변경 반영)
  → 서버: pm2 restart stock-history
```

---

## 최초 서버 세팅 (최초 1회만)

> Node.js, PM2가 이미 설치된 서버라면 아래 한 줄만 실행하면 됩니다.
> 이후 배포는 `git push`로 자동 처리됩니다.

```bash
ssh $SERVER_USER@$SERVER_IP
mkdir -p ~/stock-history/data   # DB 저장 폴더 (없으면 prisma db push 실패)
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
location /stock {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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
