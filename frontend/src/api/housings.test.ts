import { describe, expect, it } from 'vitest'
import {
  manwon,
  rangeLabel,
  toCard,
  toMarker,
  type HousingDto,
} from './housings'

describe('manwon', () => {
  it('원→만원 반올림·천단위 콤마', () => {
    expect(manwon(30_000_000)).toBe('3,000만원')
    expect(manwon(37_800)).toBe('4만원') // 3.78 → 반올림 4
    expect(manwon(0)).toBe('0만원')
  })
})

describe('rangeLabel', () => {
  it('min===max면 단일값', () => {
    expect(rangeLabel({ min: 30_000_000, max: 30_000_000 })).toBe('3,000만원')
  })
  it('범위면 min~max', () => {
    expect(rangeLabel({ min: 4_260_000, max: 62_740_000 })).toBe(
      '426~6,274만원',
    )
  })
  it('max<=0이면 하이픈', () => {
    expect(rangeLabel({ min: 0, max: 0 })).toBe('-')
  })
})

const fixture: HousingDto = {
  id: 'x1',
  name: '테스트단지',
  type: '통합공공임대',
  address: '부산광역시 수영구 남천동',
  district: '수영구',
  dong: '남천동',
  lat: 35.14,
  lng: 129.11,
  builtDate: '2025-01-01',
  totalUnits: 100,
  elevator: true,
  parking: 100,
  area: { min: 30, max: 60 },
  rooms: { min: 1, max: 3 },
  deposit: { min: 10_000_000, max: 30_000_000 },
  rent: { min: 100_000, max: 300_000 },
  pricingRows: [],
  score: 88,
  tagScores: {},
  highlight: '역세권',
  scoreSource: 'placeholder',
}

describe('toCard', () => {
  it('DTO를 카드 표시 모델로 변환(만원 포맷·loc 결합)', () => {
    expect(toCard(fixture)).toEqual({
      id: 'x1',
      score: 88,
      name: '테스트단지',
      tag: '통합공공임대',
      loc: '수영구 남천동',
      deposit: '1,000~3,000만원',
      rent: '10~30만원',
      cafe: 0,
      gym: 0,
      cvs: 0,
      highlight: '역세권',
    })
  })
  it('score·highlight가 null이면 0·빈문자열로 대체', () => {
    const card = toCard({ ...fixture, score: null, highlight: null })
    expect(card.score).toBe(0)
    expect(card.highlight).toBe('')
  })
})

describe('toMarker', () => {
  it('좌표가 있으면 마커', () => {
    expect(toMarker(fixture)).toEqual({
      id: 'x1',
      score: 88,
      lat: 35.14,
      lng: 129.11,
    })
  })
  it('좌표가 없으면 null(지도에서 제외)', () => {
    expect(toMarker({ ...fixture, lat: null })).toBeNull()
    expect(toMarker({ ...fixture, lng: null })).toBeNull()
  })
})
