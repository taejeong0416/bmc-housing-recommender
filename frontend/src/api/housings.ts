import type { GeneratedHousing, HomeMarker, Housing } from '../types'
import { apiFetch } from './client'

// 서버 응답 DTO = 인제스천 산출 스키마(P2-C-1 응답과 동형).
export type HousingDto = GeneratedHousing

export const getHousings = () => apiFetch<HousingDto[]>('api/housings')
export const getHousing = (id: string) =>
  apiFetch<HousingDto>(`api/housings/${id}`)

// DTO → 화면용 변환(원→만원 등). POI 수(cafe/gym/cvs)·highlight는 상권 스코어링(P3) 후 채움.
export const manwon = (won: number): string =>
  `${Math.round(won / 10000).toLocaleString()}만원`
export const rangeLabel = (r: { min: number; max: number }): string =>
  r.max <= 0
    ? '-'
    : r.min === r.max
      ? manwon(r.min)
      : `${Math.round(r.min / 10000).toLocaleString()}~${manwon(r.max)}`

export function toCard(h: HousingDto): Housing {
  return {
    id: h.id,
    score: h.score ?? 0,
    name: h.name,
    tag: h.type,
    loc: [h.district, h.dong].filter(Boolean).join(' '),
    deposit: rangeLabel(h.deposit),
    rent: rangeLabel(h.rent),
    cafe: 0,
    gym: 0,
    cvs: 0,
    highlight: h.highlight ?? '',
  }
}

// 목데이터엔 건물 유형이 없어 세대수로 대표 유형 이미지를 매핑(아파트/오피스텔/빌라).
// 이미지는 frontend/public/houses/{유형}-{1..3}.png (유형 콜라주에서 분리).
// 같은 유형이라도 매물 id로 3장 중 하나를 고정 배정해 카드가 다 똑같아 보이지 않게 한다.
const HOUSE_IMG_BASE = import.meta.env.BASE_URL + 'houses/'
const HOUSE_VARIANTS = 3
export function houseImage(dto: HousingDto): { label: string; src: string } {
  const u = dto.totalUnits ?? 0
  const key = u >= 100 ? 'apartment' : u >= 20 ? 'officetel' : 'villa'
  const label =
    key === 'apartment' ? '아파트' : key === 'officetel' ? '오피스텔' : '빌라'
  let hash = 0
  for (let i = 0; i < dto.id.length; i++)
    hash = (hash * 31 + dto.id.charCodeAt(i)) | 0
  const variant = (Math.abs(hash) % HOUSE_VARIANTS) + 1
  return { label, src: `${HOUSE_IMG_BASE}${key}-${variant}.png` }
}

export function toMarker(h: HousingDto): HomeMarker | null {
  return h.lat != null && h.lng != null
    ? { id: h.id, score: h.score ?? 0, lat: h.lat, lng: h.lng }
    : null
}
