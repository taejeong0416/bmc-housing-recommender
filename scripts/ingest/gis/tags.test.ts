import { describe, expect, it } from 'vitest'
import { tagsFor } from './tags'

describe('상가 업종분류 생활환경 태그 매핑', () => {
  it.each([
    ['D', 'D03', 'D03A02', ['supermarket', 'shop']],
    ['D', 'D03', 'D03B10', ['supermarket', 'shop']],
    ['D', 'D03', 'D03B04', ['market_complex', 'shop']],
    ['F', 'F02', 'F02A01', ['laundry']],
  ])('%s/%s/%s를 %j로 매핑한다', (lCd, mCd, sCd, expected) => {
    expect(tagsFor({ lCd, mCd, sCd })).toEqual(expected)
  })

  it('일반 음식점은 restaurant로 매핑한다', () => {
    expect(tagsFor({ lCd: 'Q', mCd: 'Q01', sCd: 'Q01A01' })).toEqual([
      'restaurant',
    ])
  })

  it.each([
    ['Q12', 'Q12A01'],
    ['Q09', 'Q09A01'],
  ])('카페·유흥 중분류 %s는 restaurant에서 제외한다', (mCd, sCd) => {
    expect(tagsFor({ lCd: 'Q', mCd, sCd })).not.toContain('restaurant')
  })
})
