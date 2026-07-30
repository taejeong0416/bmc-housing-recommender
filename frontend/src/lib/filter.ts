// 취향/조건(스토어 필드) → 실제 매물 필터. 지도·AI 확인 화면이 공유하는 단일 원천.
// 태그(cafe/gym…)는 상권 스코어링(P3, 데이터 대기)이라 아직 순위·필터에 반영 안 함 — 표시·향후용.
import type { GeneratedHousing, StoreState } from '../types'

// 필터에 관여하는 조건 필드만 추린 슬라이스.
export type FilterPrefs = Pick<
  StoreState,
  | 'rentType'
  | 'depositMax'
  | 'rentMax'
  | 'regions'
  | 'buildYear'
  | 'area'
  | 'houseTypes'
  | 'elevatorRequired'
  | 'parkingRequired'
>

export const filterPrefsFromState = (s: StoreState): FilterPrefs => ({
  rentType: s.rentType,
  depositMax: s.depositMax,
  rentMax: s.rentMax,
  regions: s.regions,
  buildYear: s.buildYear,
  area: s.area,
  houseTypes: s.houseTypes,
  elevatorRequired: s.elevatorRequired,
  parkingRequired: s.parkingRequired,
})

// '열린 상태' 기준값 — 슬라이더 최대치. 정확히 이 값일 때만 해당 축을 필터하지 않는다.
// (AI 파싱이 이 값을 넘는 상한을 주면 '열림'이 아니라 실제 상한으로 필터한다.)
export const OPEN_DEPOSIT = 5000 // 만원(슬라이더 최대)
export const OPEN_RENT = 60 // 만원(슬라이더 최대 = 실데이터 월세 최대치에 여유, 이 지점이 '상한 없음')
export const ALL_TYPE = '전체'

const YEARS: Record<string, number | null> = {
  '5년 이내': 5,
  '10년 이내': 10,
  '15년 이내': 15,
  '제한 없음': null,
}
const AREAS: Record<string, { min: number; max: number } | null> = {
  '~ 30m² (원룸)': { min: 0, max: 30 },
  '30 ~ 40m²': { min: 30, max: 40 },
  '40 ~ 60m²': { min: 40, max: 60 },
  '60m² 이상': { min: 60, max: Infinity },
  전체: null,
}
const ROOMS: Record<string, { min: number; max: number }> = {
  원룸: { min: 1, max: 1 },
  '1.5룸': { min: 1, max: 1 },
  투룸: { min: 2, max: 2 },
  '쓰리룸+': { min: 3, max: 99 },
}

const overlaps = (aMin: number, aMax: number, bMin: number, bMax: number) =>
  aMax >= bMin && aMin <= bMax

export function applyPrefs(
  list: GeneratedHousing[],
  p: FilterPrefs,
): GeneratedHousing[] {
  const nowY = new Date().getFullYear()
  const maxAge = YEARS[p.buildYear] ?? null
  const areaRange = AREAS[p.area] ?? null
  const roomRanges = p.houseTypes.map((h) => ROOMS[h]).filter(Boolean)

  return list.filter((d) => {
    if (p.rentType && p.rentType !== ALL_TYPE && d.type !== p.rentType)
      return false
    if (
      p.depositMax !== OPEN_DEPOSIT &&
      (d.deposit?.min ?? Infinity) > p.depositMax * 10000
    )
      return false
    if (
      p.rentMax !== OPEN_RENT &&
      (d.rent?.min ?? Infinity) > p.rentMax * 10000
    )
      return false
    if (p.regions.length && !p.regions.includes(d.district)) return false
    if (maxAge != null) {
      const y = Number(d.builtDate?.slice(0, 4))
      if (!y || y < nowY - maxAge) return false
    }
    if (
      areaRange &&
      !overlaps(
        d.area?.min ?? 0,
        d.area?.max ?? 0,
        areaRange.min,
        areaRange.max,
      )
    )
      return false
    if (
      roomRanges.length &&
      !roomRanges.some((r) =>
        overlaps(d.rooms?.min ?? 0, d.rooms?.max ?? 0, r.min, r.max),
      )
    )
      return false
    if (p.elevatorRequired && !d.elevator) return false
    if (p.parkingRequired && d.parking <= 0) return false
    return true
  })
}
