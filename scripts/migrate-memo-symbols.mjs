import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  // 1. MemoSymbol 테이블 생성
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MemoSymbol" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "memoId" TEXT NOT NULL,
      "symbol" TEXT NOT NULL,
      CONSTRAINT "MemoSymbol_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  console.log('MemoSymbol 테이블 생성 완료')

  // 2. 기존 symbol 데이터 이전 (콤마 구분 처리)
  const memos = await prisma.$queryRawUnsafe(
    `SELECT id, symbol FROM Memo WHERE symbol IS NOT NULL AND symbol != ''`
  )
  let count = 0
  for (const memo of memos) {
    const symbols = memo.symbol.split(',').map(s => s.trim()).filter(Boolean)
    for (const sym of symbols) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "MemoSymbol" ("id", "memoId", "symbol") VALUES (?, ?, ?)`,
        randomUUID(), memo.id, sym
      )
      count++
    }
  }
  console.log(`데이터 이전 완료: ${count}건`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
