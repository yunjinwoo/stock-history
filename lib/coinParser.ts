export interface ParsedEntry {
  date: string
  symbol: string
  type: '매수' | '매도'
  price: number
  quantity: number
}

function parseDateTime(s: string): string {
  const m = s.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return ''
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`
}

export function parsePastedText(text: string): ParsedEntry[] {
  const lines = text
    .replace(/체결시간[\s\S]*?주문시간/, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const dateRegex = /^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}$/
  const results: ParsedEntry[] = []

  let start = lines.findIndex(l => dateRegex.test(l))
  if (start === -1) return []

  while (start + 9 < lines.length) {
    const block = lines.slice(start, start + 10)
    const date = parseDateTime(block[0])
    const symbol = block[1]
    const type = block[3]

    if (date && symbol && (type === '매수' || type === '매도')) {
      const quantityMatch = block[4].match(/^([\d.]+)/)
      const priceMatch = block[5].match(/^([\d,.]+)/)
      if (quantityMatch && priceMatch) {
        const quantity = Number(quantityMatch[1])
        const price = Number(priceMatch[1].replace(/,/g, ''))
        if (quantity && price) results.push({ date, symbol, type, price, quantity })
      }
    }
    start += 10
  }

  return results
}
