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

function parseInlineDateTimeBlocks(lines: string[]): ParsedEntry[] {
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
      const quantityMatch = block[4].match(/^([\d,.]+)/)
      const priceMatch = block[5].match(/^([\d,.]+)/)
      if (quantityMatch && priceMatch) {
        const quantity = Number(quantityMatch[1].replace(/,/g, ''))
        const price = Number(priceMatch[1].replace(/,/g, ''))
        if (quantity && price) results.push({ date, symbol, type, price, quantity })
      }
    }
    start += 10
  }

  return results
}

// 날짜/시간이 각각 다른 줄에 있고, "심볼/KRW" 마켓 표기 + 체결가·체결금액·체결수량 순서인 거래소 내역 포맷
function parseSplitDateTimeBlocks(lines: string[]): ParsedEntry[] {
  const dateOnlyRegex = /^\d{4}\.\d{2}\.\d{2}$/
  const timeOnlyRegex = /^\d{1,2}:\d{2}$/
  const marketRegex = /^([A-Za-z0-9]+)\/KRW$/i
  const results: ParsedEntry[] = []

  let start = lines.findIndex(l => dateOnlyRegex.test(l))
  if (start === -1) return []

  while (start + 6 < lines.length) {
    const block = lines.slice(start, start + 7)
    const [dateLine, timeLine, marketLine, type, priceLine, , quantityLine] = block
    const marketMatch = marketLine.match(marketRegex)

    if (dateOnlyRegex.test(dateLine) && timeOnlyRegex.test(timeLine) && marketMatch && (type === '매수' || type === '매도')) {
      const date = parseDateTime(`${dateLine} ${timeLine}`)
      const priceMatch = priceLine.match(/^([\d,.]+)/)
      const quantityMatch = quantityLine.match(/^([\d,.]+)/)
      if (date && priceMatch && quantityMatch) {
        const price = Number(priceMatch[1].replace(/,/g, ''))
        const quantity = Number(quantityMatch[1].replace(/,/g, ''))
        if (price && quantity) results.push({ date, symbol: marketMatch[1].toUpperCase(), type, price, quantity })
      }
      start += 7
      continue
    }

    const next = lines.slice(start + 1).findIndex(l => dateOnlyRegex.test(l))
    if (next === -1) break
    start += 1 + next
  }

  return results
}

export function parsePastedText(text: string): ParsedEntry[] {
  const lines = text
    .replace(/체결시간[\s\S]*?주문시간/, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const inlineResults = parseInlineDateTimeBlocks(lines)
  if (inlineResults.length > 0) return inlineResults

  return parseSplitDateTimeBlocks(lines)
}
