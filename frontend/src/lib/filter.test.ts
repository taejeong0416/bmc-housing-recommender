import { describe, expect, it } from 'vitest'
import { applyPrefs, ALL_TYPE, OPEN_DEPOSIT, OPEN_RENT } from './filter'
import { prefsFromParse } from '../api/ai'
import type { GeneratedHousing } from '../types'

// 필터가 읽는 필드만 채운 최소 픽스처(나머지는 스키마 충족용 기본값).
const H = (o: Partial<GeneratedHousing>): GeneratedHousing => ({
  id: 'x',
  name: 'n',
  type: '매입임대',
  address: 'a',
  district: '수영구',
  dong: 'd',
  lat: 0,
  lng: 0,
  builtDate: '2020-01-01',
  totalUnits: 10,
  elevator: true,
  parking: 5,
  area: { min: 20, max: 40 },
  rooms: { min: 1, max: 2 },
  deposit: { min: 10_000_000, max: 20_000_000 },
  rent: { min: 100_000, max: 200_000 },
  pricingRows: [],
  score: 80,
  tagScores: {},
  highlight: null,
  scoreSource: 'placeholder',
  ...o,
})

// '열린 상태' 기준 — 이 프리셋에서 각 축을 좁혀 테스트.
const OPEN = {
  rentType: ALL_TYPE,
  depositMax: OPEN_DEPOSIT,
  rentMax: OPEN_RENT,
  regions: [] as string[],
  buildYear: '제한 없음',
  area: '전체',
  houseTypes: [] as string[],
  elevatorRequired: false,
  parkingRequired: false,
}

describe('applyPrefs', () => {
  it('열린 상태면 전부 통과', () => {
    const list = [H({ id: 'a' }), H({ id: 'b', type: '행복주택' })]
    expect(applyPrefs(list, OPEN)).toHaveLength(2)
  })

  it('공급유형 — 지정 시 일치만, 전체면 무필터', () => {
    const list = [
      H({ id: 'a', type: '매입임대' }),
      H({ id: 'b', type: '행복주택' }),
    ]
    expect(
      applyPrefs(list, { ...OPEN, rentType: '행복주택' }).map((h) => h.id),
    ).toEqual(['b'])
    expect(applyPrefs(list, { ...OPEN, rentType: ALL_TYPE })).toHaveLength(2)
  })

  it('보증금 상한 — 만원→원 환산, 상한(=OPEN)이면 무필터', () => {
    const list = [
      H({ id: 'lo', deposit: { min: 3_000_000, max: 5_000_000 } }), // 300만
      H({ id: 'hi', deposit: { min: 40_000_000, max: 50_000_000 } }), // 4,000만
    ]
    expect(
      applyPrefs(list, { ...OPEN, depositMax: 500 }).map((h) => h.id),
    ).toEqual(['lo'])
    expect(
      applyPrefs(list, { ...OPEN, depositMax: OPEN_DEPOSIT }),
    ).toHaveLength(2)
  })

  it('보증금 상한 — OPEN 초과 값(AI 파싱 경로)은 열림이 아니라 실제 상한으로 필터', () => {
    const list = [
      H({ id: 'mid', deposit: { min: 55_000_000, max: 60_000_000 } }), // 5,500만
      H({ id: 'hi', deposit: { min: 70_000_000, max: 80_000_000 } }), // 7,000만
    ]
    expect(
      applyPrefs(list, { ...OPEN, depositMax: 6000 }).map((h) => h.id),
    ).toEqual(['mid'])
  })

  it('월세 상한 — 만원→원 환산', () => {
    const list = [
      H({ id: 'lo', rent: { min: 100_000, max: 150_000 } }), // 10만
      H({ id: 'hi', rent: { min: 450_000, max: 500_000 } }), // 45만
    ]
    expect(applyPrefs(list, { ...OPEN, rentMax: 20 }).map((h) => h.id)).toEqual(
      ['lo'],
    )
  })

  it('지역 — 포함만, 빈 배열이면 무필터', () => {
    const list = [
      H({ id: 'a', district: '수영구' }),
      H({ id: 'b', district: '기장군' }),
    ]
    expect(
      applyPrefs(list, { ...OPEN, regions: ['기장군'] }).map((h) => h.id),
    ).toEqual(['b'])
    expect(applyPrefs(list, { ...OPEN, regions: [] })).toHaveLength(2)
  })

  it('준공연도 — N년 이내, 제한 없음이면 무필터', () => {
    const y = new Date().getFullYear()
    const list = [
      H({ id: 'new', builtDate: `${y - 3}-01-01` }),
      H({ id: 'old', builtDate: `${y - 12}-01-01` }),
    ]
    expect(
      applyPrefs(list, { ...OPEN, buildYear: '5년 이내' }).map((h) => h.id),
    ).toEqual(['new'])
    expect(applyPrefs(list, { ...OPEN, buildYear: '제한 없음' })).toHaveLength(
      2,
    )
  })

  it('전용면적 — 범위 겹침, 전체면 무필터', () => {
    const list = [
      H({ id: 'small', area: { min: 18, max: 28 } }),
      H({ id: 'big', area: { min: 65, max: 85 } }),
    ]
    expect(
      applyPrefs(list, { ...OPEN, area: '~ 30m² (원룸)' }).map((h) => h.id),
    ).toEqual(['small'])
    expect(
      applyPrefs(list, { ...OPEN, area: '60m² 이상' }).map((h) => h.id),
    ).toEqual(['big'])
  })

  it('방 구조 — rooms 범위 겹침(원룸=1), 빈 배열이면 무필터', () => {
    const list = [
      H({ id: 'one', rooms: { min: 1, max: 1 } }),
      H({ id: 'two', rooms: { min: 2, max: 3 } }),
    ]
    expect(
      applyPrefs(list, { ...OPEN, houseTypes: ['원룸'] }).map((h) => h.id),
    ).toEqual(['one'])
    expect(
      applyPrefs(list, { ...OPEN, houseTypes: ['투룸'] }).map((h) => h.id),
    ).toEqual(['two'])
    // 여러 방 구조는 OR — 하나라도 겹치면 통과
    expect(
      applyPrefs(list, { ...OPEN, houseTypes: ['원룸', '투룸'] }),
    ).toHaveLength(2)
  })

  it('여러 조건은 AND로 결합', () => {
    const list = [
      H({
        id: 'hit',
        district: '수영구',
        deposit: { min: 3_000_000, max: 4_000_000 },
        rooms: { min: 1, max: 1 },
      }),
      H({
        id: 'miss-region',
        district: '기장군',
        deposit: { min: 3_000_000, max: 4_000_000 },
        rooms: { min: 1, max: 1 },
      }),
      H({
        id: 'miss-deposit',
        district: '수영구',
        deposit: { min: 40_000_000, max: 50_000_000 },
        rooms: { min: 1, max: 1 },
      }),
    ]
    const res = applyPrefs(list, {
      ...OPEN,
      regions: ['수영구'],
      depositMax: 500,
      houseTypes: ['원룸'],
    })
    expect(res.map((h) => h.id)).toEqual(['hit'])
  })

  it('엘리베이터·주차 필수 조건은 A/B 전에 후보를 제거한다', () => {
    const list = [
      H({ id: 'all', elevator: true, parking: 3 }),
      H({ id: 'no-elevator', elevator: false, parking: 3 }),
      H({ id: 'no-parking', elevator: true, parking: 0 }),
    ]
    expect(
      applyPrefs(list, {
        ...OPEN,
        elevatorRequired: true,
        parkingRequired: true,
      }).map((h) => h.id),
    ).toEqual(['all'])
  })
})

describe('prefsFromParse', () => {
  it('빈 파싱 → 전부 열린 상태 기본값', () => {
    expect(prefsFromParse({ summary: '' })).toEqual({
      rentType: ALL_TYPE,
      depositMax: OPEN_DEPOSIT,
      rentMax: OPEN_RENT,
      regions: [],
      buildYear: '제한 없음',
      area: '전체',
      houseTypes: [],
      elevatorRequired: false,
      parkingRequired: false,
    })
  })

  it('언급된 축만 채우고 나머지는 열린 상태', () => {
    const prefs = prefsFromParse({
      summary: '',
      depositMax: 500,
      regions: ['수영구'],
      houseTypes: ['원룸'],
    })
    expect(prefs.depositMax).toBe(500)
    expect(prefs.regions).toEqual(['수영구'])
    expect(prefs.houseTypes).toEqual(['원룸'])
    expect(prefs.rentMax).toBe(OPEN_RENT)
    expect(prefs.rentType).toBe(ALL_TYPE)
  })
})
