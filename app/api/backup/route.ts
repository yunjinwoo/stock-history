import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'

export async function GET() {
  const dbPath = path.resolve(process.cwd(), 'data/stock-history.db')
  const file = readFileSync(dbPath)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="stock-history-${date}.db"`,
    },
  })
}
