#!/usr/bin/env bash
# stock-history 자동 백업 — 서버 cron에서 매일 실행 (설치는 deploy.yml이 처리)
#   - SQLite DB 스냅샷을 날짜별로 gzip 저장, KEEP_DAYS 지난 건 삭제
#   - 첨부 이미지는 한 폴더에 누적 복사 (이미지는 수정되지 않으므로 증분 복사로 충분)
# 경로는 환경변수로 바꿀 수 있음
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/stock-history/.next/standalone}"
DB_PATH="${DB_PATH:-$APP_DIR/data/stock-history.db}"
IMAGES_DIR="${IMAGES_DIR:-$APP_DIR/../data/images}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/stock-history-backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

stamp="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/images"

if [ ! -f "$DB_PATH" ]; then
  echo "[$stamp] DB 파일 없음: $DB_PATH" >&2
  exit 1
fi

out="$BACKUP_DIR/db/stock-history-$stamp.db"
rm -f "$out"

# 쓰기 중에도 일관된 스냅샷을 얻기 위해 SQLite 백업 기능 사용 (sqlite3 → prisma → 단순 복사 순)
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$out'"
elif command -v prisma >/dev/null 2>&1; then
  echo "VACUUM INTO '$out';" | prisma db execute --stdin --url "file:$DB_PATH" >/dev/null
else
  cp "$DB_PATH" "$out"
fi
gzip -f "$out"

if [ -d "$IMAGES_DIR" ]; then
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$IMAGES_DIR/" "$BACKUP_DIR/images/"
  else
    cp -R -u "$IMAGES_DIR/." "$BACKUP_DIR/images/"
  fi
fi

find "$BACKUP_DIR/db" -name 'stock-history-*.db.gz' -mtime +"$KEEP_DAYS" -delete

echo "[$stamp] 백업 완료: $out.gz ($(du -h "$out.gz" | cut -f1))"
