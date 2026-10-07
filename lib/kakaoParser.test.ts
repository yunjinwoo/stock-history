import { describe, it, expect } from 'vitest'
import { parseKakaoNotification, parseKakaoNotifications, matchAccountId } from './kakaoParser'

describe('parseKakaoNotification', () => {
  describe('한국투자증권', () => {
    const input = `[한국투자증권 체결안내]11:41

*계좌번호:44****16-01
*계좌명:윤진우
*매매구분:현금매수체결
*종목명:비츠로테크(042370)
*체결수량:41주
*체결단가:17,000원`

    it('매수 파싱', () => {
      expect(parseKakaoNotification(input)).toEqual({
        broker: '한국투자증권',
        type: '매수',
        symbol: '비츠로테크',
        symbolCode: '042370',
        quantity: 41,
        price: 17000,
        time: '11:41',
        accountNumber: '44****16-01',
      })
    })

    it('매도 파싱', () => {
      const sellInput = input.replace('현금매수체결', '현금매도체결')
      expect(parseKakaoNotification(sellInput)?.type).toBe('매도')
    })
  })

  describe('KB증권', () => {
    const input = `[KB증권] 주식 체결 안내

고객님, 주문하신 대신정보통신 주식이 체결됐으니 확인해주세요.

■ 계좌: ***-***-*44 [01]
■ 종목명: 대신정보통신
■ 주문수량: 795주
■ 체결금액: 1,491원
■ 내용: 매수체결(80142963)`

    it('매수 파싱', () => {
      expect(parseKakaoNotification(input)).toEqual({
        broker: 'KB증권',
        type: '매수',
        symbol: '대신정보통신',
        quantity: 795,
        price: 1491,
        accountNumber: '***-***-*44 [01]',
      })
    })
  })

  describe('미확인증권(083계열)', () => {
    const input = `계좌명 : 윤진우
계좌번호 : 083-50-3***49
종목명 : 셀바스AI
종목코드 : 108860
체결구분 : 매수체결
체결수량 : 146주
체결단가 : 15300원
-------------------------------`

    it('매수 파싱', () => {
      expect(parseKakaoNotification(input)).toEqual({
        broker: '미확인증권',
        type: '매수',
        symbol: '셀바스AI',
        symbolCode: '108860',
        quantity: 146,
        price: 15300,
        accountNumber: '083-50-3***49',
      })
    })
  })

  describe('키움증권', () => {
    const input = `[키움]체결통보
대주전자재료
매도11주
평균단가128,500원`

    it('매도 파싱', () => {
      expect(parseKakaoNotification(input)).toEqual({
        broker: '키움증권',
        type: '매도',
        symbol: '대주전자재료',
        quantity: 11,
        price: 128500,
      })
    })
  })

  describe('파싱 실패', () => {
    it('빈 문자열 → null', () => {
      expect(parseKakaoNotification('')).toBeNull()
    })
    it('관련없는 텍스트 → null', () => {
      expect(parseKakaoNotification('오늘 점심 뭐 먹을까요')).toBeNull()
    })
    it('null 전달 → null', () => {
      expect(parseKakaoNotification(null as unknown as string)).toBeNull()
    })
  })
})

describe('parseKakaoNotifications (여러 건)', () => {
  const kis = `[한국투자증권 체결안내]11:41

*계좌번호:44****16-01
*계좌명:윤진우
*매매구분:현금매수체결
*종목명:비츠로테크(042370)
*체결수량:41주
*체결단가:17,000원`
  const kb = `[KB증권] 주식 체결 안내

■ 계좌: ***-***-*44 [01]
■ 종목명: 대신정보통신
■ 주문수량: 795주
■ 체결금액: 1,491원
■ 내용: 매수체결(80142963)`
  const kiwoom = `[키움]체결통보
대주전자재료
매도11주
평균단가128,500원`
  const unknown083 = `계좌명 : 윤진우
계좌번호 : 083-50-3***49
종목명 : 셀바스AI
종목코드 : 108860
체결구분 : 매수체결
체결수량 : 146주
체결단가 : 15300원
-------------------------------
체결 내역을 확인해보세요.`

  it('서로 다른 증권사 알림 4건을 순서대로 파싱', () => {
    const result = parseKakaoNotifications([kis, kb, kiwoom, unknown083].join('\n\n'))
    expect(result.map(r => [r.broker, r.type, r.symbol, r.quantity, r.price])).toEqual([
      ['한국투자증권', '매수', '비츠로테크', 41, 17000],
      ['KB증권', '매수', '대신정보통신', 795, 1491],
      ['키움증권', '매도', '대주전자재료', 11, 128500],
      ['미확인증권', '매수', '셀바스AI', 146, 15300],
    ])
  })

  it('같은 증권사 알림 여러 건', () => {
    const sell = kis.replace('11:41', '14:02').replace('현금매수체결', '현금매도체결')
    const result = parseKakaoNotifications(`${kis}\n${sell}`)
    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ type: '매도', time: '14:02' })
  })

  it('083계열 알림 두 건 (헤더 없음)', () => {
    const second = unknown083.replace('셀바스AI', '삼성전자').replace('108860', '005930')
    const result = parseKakaoNotifications(`${unknown083}\n${second}`)
    expect(result.map(r => r.symbol)).toEqual(['셀바스AI', '삼성전자'])
  })

  it('한 건이면 단건 파서와 같은 결과', () => {
    expect(parseKakaoNotifications(kis)).toEqual([parseKakaoNotification(kis)])
  })

  it('인식 못한 조각은 건너뜀', () => {
    const result = parseKakaoNotifications(`오늘 점심 뭐 먹을까요\n${kiwoom}`)
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe('대주전자재료')
  })

  it('빈 문자열·엉뚱한 텍스트 → 빈 배열', () => {
    expect(parseKakaoNotifications('')).toEqual([])
    expect(parseKakaoNotifications('오늘 점심 뭐 먹을까요')).toEqual([])
  })
})

describe('matchAccountId', () => {
  const accounts = [
    { id: 'a1', broker: '한국투자증권', accountNumber: '44123416-01' },
    { id: 'a2', broker: '키움증권', accountNumber: '5555-1234' },
    { id: 'a3', broker: 'KB증권', accountNumber: '111-222-344' },
    { id: 'a4', broker: 'KB증권', accountNumber: '999-888-777' },
  ]

  it('계좌번호 앞자리로 매칭', () => {
    expect(matchAccountId(accounts, { broker: '한국투자증권', accountNumber: '44****16-01' })).toBe('a1')
  })
  it('계좌번호가 없으면 같은 증권사 계좌가 하나일 때 매칭', () => {
    expect(matchAccountId(accounts, { broker: '키움증권' })).toBe('a2')
  })
  it('같은 증권사 계좌가 여러 개면 매칭하지 않음', () => {
    expect(matchAccountId(accounts, { broker: 'KB증권' })).toBeUndefined()
  })
})

describe('키움 체결알림 여러 건 (카톡 복사 형식)', () => {
  const input = `[키움증권 체결알림] [오전 9:41] [키움]체결통보
에코프로
매수4주
평균단가91,800원

[키움증권 체결알림] [오전 9:45] [키움]체결통보
현대차
매수2주
평균단가349,500원

[키움증권 체결알림] [오전 10:57] [키움]체결통보
에코프로
매도4주
평균단가95,900원

[키움증권 체결알림] [오전 11:01] [키움]체결통보
한선엔지니어링
매수10주
평균단가15,260원`

  it('4건 모두 파싱하고 시간을 24시간 형식으로 추출', () => {
    expect(parseKakaoNotifications(input)).toEqual([
      { broker: '키움증권', type: '매수', symbol: '에코프로', quantity: 4, price: 91800, time: '09:41' },
      { broker: '키움증권', type: '매수', symbol: '현대차', quantity: 2, price: 349500, time: '09:45' },
      { broker: '키움증권', type: '매도', symbol: '에코프로', quantity: 4, price: 95900, time: '10:57' },
      { broker: '키움증권', type: '매수', symbol: '한선엔지니어링', quantity: 10, price: 15260, time: '11:01' },
    ])
  })

  it('오후 시간은 12시간을 더함', () => {
    const one = '[키움증권 체결알림] [오후 1:05] [키움]체결통보\n현대차\n매도2주\n평균단가350,000원'
    expect(parseKakaoNotification(one)?.time).toBe('13:05')
  })
})

describe('토스증권 거래내역', () => {
  const input = `10.12

삼미금속 12주
구매
-163,104원

한국화장품제조 9주
구매
-152,392원

지어소프트 11주
판매
152,024원

한국화장품제조 9주
판매
155,905원

10.8

지어소프트 11주
구매
-147,972원

HLB 3주
판매
142,047원

10.7

HLB 1주
00:06 ㅣ 구매
-40,056원
14,753원

10.2

HLB 2주
00:06 ㅣ 구매
-84,011원
14,809원

JW신약 30주
00:06 ㅣ 판매
89,807원
98,820원

9.30

JW신약 30주
00:06 ㅣ 구매
-98,564원
8,975원`

  const now = new Date(2026, 9, 12, 15, 0)

  it('전체 건수를 오래된 순으로 파싱', () => {
    const results = parseKakaoNotifications(input, now)
    expect(results).toHaveLength(10)
    expect(results.map(r => `${r.date} ${r.symbol} ${r.type}`)).toEqual([
      '2026-09-30 JW신약 매수',
      '2026-10-02 JW신약 매도',
      '2026-10-02 HLB 매수',
      '2026-10-07 HLB 매수',
      '2026-10-08 HLB 매도',
      '2026-10-08 지어소프트 매수',
      '2026-10-12 한국화장품제조 매도',
      '2026-10-12 지어소프트 매도',
      '2026-10-12 한국화장품제조 매수',
      '2026-10-12 삼미금속 매수',
    ])
  })

  it('총액 ÷ 수량을 10원 단위로 반올림해 단가 계산, 시간은 있을 때만', () => {
    const results = parseKakaoNotifications(input, now)
    expect(results[9]).toEqual({
      broker: '토스증권',
      type: '매수',
      symbol: '삼미금속',
      quantity: 12,
      price: 13590,
      date: '2026-10-12',
    })
    expect(results[0]).toEqual({
      broker: '토스증권',
      type: '매수',
      symbol: 'JW신약',
      quantity: 30,
      price: 3290,
      time: '00:06',
      date: '2026-09-30',
    })
  })

  it('오늘보다 미래 날짜는 작년으로', () => {
    const results = parseKakaoNotifications(input, new Date(2026, 9, 7, 12, 0))
    expect(results.find(r => r.symbol === '삼미금속')?.date).toBe('2025-10-12')
    expect(results.find(r => r.symbol === 'JW신약')?.date).toBe('2026-09-30')
  })

  it('토스 형식이 아니면 빈 배열', () => {
    expect(parseKakaoNotifications('10.12\n\n안녕하세요')).toEqual([])
  })
})
