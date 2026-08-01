'use client'

interface Props {
  symbol: string // e.g. "KRX:005930" or "UPBIT:BTCKRW"
  height?: number
}

export default function TradingViewChart({ symbol, height = 400 }: Props) {
  const src = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=ffffff&studies=%5B%5D&theme=Light&style=1&timezone=Asia%2FSeoul&withdateranges=1`

  return (
    <iframe
      key={symbol}
      src={src}
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      title={`TradingView ${symbol}`}
    />
  )
}
