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
