import { describe, expect, it } from 'vitest'
import { augment, normalize, normalizeFollowup } from './ai'

describe('normalize (모델 출력 방어)', () => {
  it('summary 없으면 기본 문구', () => {
    expect(normalize({}).summary).toBe('조건을 이해했어요.')
  })

  it('태그 가중치는 1~3으로 클램프, 유효 id만', () => {
    const r = normalize({
      summary: 's',
      tags: [
        { id: 'cafe_choice', weight: 5 }, // 상한 → 3
        { id: 'fitness_access', weight: -1 }, // 하한 → 1
        { id: 'bogus', weight: 2 }, // 유효하지 않은 id → 드롭
      ],
    })
    expect(r.tags).toEqual([
      { id: 'cafe_choice', weight: 3 },
      { id: 'fitness_access', weight: 1 },
    ])
  })

  it('가중치 누락(0/NaN)은 기본값 2', () => {
    const r = normalize({
      summary: 's',
      tags: [{ id: 'cafe_choice', weight: 0 }],
    })
    expect(r.tags).toEqual([{ id: 'cafe_choice', weight: 2 }])
  })

  it("rentType '전체'는 무필터로 간주해 제거", () => {
    expect(
      normalize({ summary: 's', rentType: '전체' }).rentType,
    ).toBeUndefined()
    expect(normalize({ summary: 's', rentType: '행복주택' }).rentType).toBe(
      '행복주택',
    )
  })

  it('배열이어야 할 필드가 다른 타입이면 크래시 없이 무시(프록시 원본 방어)', () => {
    const r = normalize({
      summary: 's',
      tags: 'cafe' as never,
      regions: '수영구' as never,
      houseTypes: { rooms: 1 } as never,
    })
    expect(r.tags).toBeUndefined()
    expect(r.regions).toBeUndefined()
    expect(r.houseTypes).toBeUndefined()
  })

  it('0·음수 금액과 빈 배열은 생략', () => {
    const r = normalize({
      summary: 's',
      depositMax: 0,
      regions: [],
      houseTypes: [],
    })
    expect(r.depositMax).toBeUndefined()
    expect(r.regions).toBeUndefined()
    expect(r.houseTypes).toBeUndefined()
  })
})

describe('normalizeFollowup (되묻기 방어)', () => {
  it('정상 followup은 통과, 보기 태그는 정제', () => {
    const r = normalizeFollowup({
      question: '뭐가 중요하세요?',
      options: [
        { label: '역세권', tags: [{ id: 'rail_access', weight: 3 }] },
        { label: '잘 모르겠어요' }, // 태그 없는 회피 보기
      ],
    })
    expect(r?.question).toBe('뭐가 중요하세요?')
    expect(r?.options).toEqual([
      { label: '역세권', tags: [{ id: 'rail_access', weight: 3 }] },
      { label: '잘 모르겠어요' },
    ])
  })

  it('보기가 2개 미만이면 드롭', () => {
    expect(
      normalizeFollowup({ question: 'q', options: [{ label: '하나' }] }),
    ).toBeUndefined()
  })

  it('질문 없거나 형식 어긋나면 드롭(프록시 원본 방어)', () => {
    expect(normalizeFollowup(undefined)).toBeUndefined()
    expect(normalizeFollowup({ options: [] } as never)).toBeUndefined()
    expect(normalizeFollowup('아무거나' as never)).toBeUndefined()
  })

  it('보기는 최대 4개, 잘못된 태그 id는 드롭', () => {
    const r = normalizeFollowup({
      question: 'q',
      options: [
        { label: 'a', tags: [{ id: 'bogus', weight: 2 }] }, // 무효 id → 태그 없음
        { label: 'b' },
        { label: 'c' },
        { label: 'd' },
        { label: 'e' }, // 5번째 → 잘림
      ],
    })
    expect(r?.options).toHaveLength(4)
    expect(r?.options[0]).toEqual({ label: 'a' })
  })
})

describe('augment (키워드 안전망)', () => {
  it('원문의 방 구조를 보강(모델 누락 대비)', () => {
    const r = augment('원룸 보증금 500 이하', { summary: 's' })
    expect(r.houseTypes).toEqual(['원룸'])
  })

  it('"쓰리룸"은 쓰리룸+로 매핑, 기존 값과 합집합', () => {
    const r = augment('쓰리룸 이상 원해요', {
      summary: 's',
      houseTypes: ['투룸'],
    })
    expect(new Set(r.houseTypes)).toEqual(new Set(['투룸', '쓰리룸+']))
  })

  it('"신축"/"새 집"은 buildYear 5년 이내, 기존 값은 유지', () => {
    expect(augment('신축이면 좋겠어', { summary: 's' }).buildYear).toBe(
      '5년 이내',
    )
    expect(augment('새 집 원해요', { summary: 's' }).buildYear).toBe('5년 이내')
    expect(
      augment('신축', { summary: 's', buildYear: '10년 이내' }).buildYear,
    ).toBe('10년 이내')
  })

  it('방 구조 언급 없으면 houseTypes 미설정', () => {
    expect(
      augment('조용한 동네 카페 근처', { summary: 's' }).houseTypes,
    ).toBeUndefined()
  })
})
