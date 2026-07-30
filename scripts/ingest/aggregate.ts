import {
  GeneratedHousing,
  placeholderScore,
  qualifierLabel,
  range,
  TAG_IDS,
  type Complex,
  type Pricing,
  type Unit,
} from '@bmc/shared-types'
import { deriveQualifications } from './qualifications'

// emit·index가 쓰는 산출 타입 재수출(스키마 원천은 shared-types)
export type { GeneratedHousing }
export { TAG_IDS }

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k)
    if (arr) arr.push(it)
    else m.set(k, [it])
  }
  return m
}

/** 호 단위 canonical → 단지 단위 GeneratedHousing[]. 좌표는 이 단계에서 c.lat/lng 그대로(지오코딩이 채움). */
export function aggregate(
  complexes: Complex[],
  units: Unit[],
  pricing: Pricing[],
): GeneratedHousing[] {
  const unitsByC = groupBy(units, (u) => u.complexId)
  const priceByC = groupBy(pricing, (p) => p.complexId)

  return complexes.map((c) => {
    const us = unitsByC.get(c.id) ?? []
    const ps = priceByC.get(c.id) ?? []
    const tagScores: Record<string, number | null> = {}
    for (const t of TAG_IDS) tagScores[t] = null

    return {
      id: c.id,
      name: c.name,
      type: c.type,
      address: c.address,
      district: c.district,
      dong: c.dong,
      lat: c.lat,
      lng: c.lng,
      coordinateSource: c.coordinateSource ?? null,
      coordinateAccuracy: c.coordinateAccuracy ?? null,
      builtDate: c.builtDate,
      totalUnits: c.totalUnits,
      elevator: c.elevator,
      parking: c.parking,
      area: range(us.map((u) => u.areaM2)),
      rooms: range(us.map((u) => u.rooms)),
      deposit: range(ps.map((p) => p.deposit)),
      rent: range(ps.map((p) => p.rent)),
      pricingRows: ps.map((p) => ({
        unitType: p.unitType,
        qualifier: qualifierLabel({
          unitType: p.unitType,
          ho: p.ho,
          ...p.qualifier,
        }),
        deposit: p.deposit,
        rent: p.rent,
      })),
      score: placeholderScore(c.builtDate, c.totalUnits),
      tagScores,
      qualifications: deriveQualifications(c, ps),
      highlight: null,
      scoreSource: 'placeholder' as const,
    }
  })
}
