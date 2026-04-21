import { describe, it, expect } from 'vitest'
import { parseKakaoNotification } from './kakaoParser'

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
