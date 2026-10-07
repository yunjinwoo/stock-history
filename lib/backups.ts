import os from 'os'
import path from 'path'

// scripts/backup.sh 가 저장하는 위치와 같아야 함 (BACKUP_DIR 기본값 ~/stock-history-backups)
export const BACKUP_DB_DIR = path.join(process.env.BACKUP_DIR ?? path.join(os.homedir(), 'stock-history-backups'), 'db')

// 경로 조작 방지: backup.sh 가 만드는 파일 이름 형식만 허용
export const BACKUP_NAME_RE = /^stock-history-\d{8}-\d{4}\.db\.gz$/
