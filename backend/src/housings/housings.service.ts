import { Injectable, NotFoundException } from '@nestjs/common'
import {
  placeholderScore,
  qualifierLabel,
  range,
  TAG_IDS,
  type GeneratedHousing,
  type HousingType,
} from '@bmc/shared-types'
import { PrismaService } from '../prisma/prisma.service'

// 응답 DTO = 인제스천 산출 스키마 — 단일 원천 @bmc/shared-types.
export type HousingDto = GeneratedHousing

export interface HousingQuery {
  district?: string
  type?: string
  depositMax?: number
  rentMax?: number
  builtAfter?: number
  areaMin?: number
  areaMax?: number
  sort?: 'match' | 'deposit' | 'built'
}

// 정규화 3엔티티(DB) → 단지 단위 DTO. 집계 규칙은 shared-types(인제스천 emit과 동일).
type ComplexWithRels = {
  id: string
  type: string
  name: string
  address: string
  district: string
  dong: string
  builtDate: Date | null
  totalUnits: number
  elevator: boolean
  parking: number
  lat: number | null
  lng: number | null
  units: { rooms: number; areaM2: number }[]
  pricing: {
    unitType: string | null
    ho: string | null
    supplyClass: string | null
    incomeBand: string | null
    householdSize: number | null
    protection: string | null
    deposit: number
    rent: number
  }[]
}

function toDto(c: ComplexWithRels): HousingDto {
  const builtDate = c.builtDate ? c.builtDate.toISOString().slice(0, 10) : null
  const tagScores: Record<string, number | null> = {}
  for (const t of TAG_IDS) tagScores[t] = null
  return {
    id: c.id,
    name: c.name,
    type: c.type as HousingType,
    address: c.address,
    district: c.district,
    dong: c.dong,
    lat: c.lat,
    lng: c.lng,
    builtDate,
    totalUnits: c.totalUnits,
    elevator: c.elevator,
    parking: c.parking,
    area: range(c.units.map((u) => u.areaM2)),
    rooms: range(c.units.map((u) => u.rooms)),
    deposit: range(c.pricing.map((p) => p.deposit)),
    rent: range(c.pricing.map((p) => p.rent)),
    pricingRows: c.pricing.map((p) => ({
      unitType: p.unitType ?? undefined,
      qualifier: qualifierLabel({
        unitType: p.unitType ?? undefined,
        ho: p.ho ?? undefined,
        supplyClass: p.supplyClass ?? undefined,
        incomeBand: p.incomeBand ?? undefined,
        householdSize: p.householdSize ?? undefined,
        protection: p.protection ?? undefined,
      }),
      deposit: p.deposit,
      rent: p.rent,
    })),
    score: placeholderScore(builtDate, c.totalUnits),
    tagScores,
    highlight: null,
    scoreSource: 'placeholder',
  }
}

@Injectable()
export class HousingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: HousingQuery): Promise<HousingDto[]> {
    // 하드 필터 중 DB에서 처리 가능한 것(district·type·준공연도)은 쿼리로, 범위(예산·면적)는 집계 후.
    const where: {
      district?: string
      type?: string
      builtDate?: { gte: Date }
    } = {}
    if (q.district) where.district = q.district
    if (q.type) where.type = q.type
    // builtAfter는 연도 정수만 유효 — 그 외 숫자는 Invalid Date → Prisma 검증 에러(500)라 무시.
    if (
      q.builtAfter != null &&
      Number.isInteger(q.builtAfter) &&
      q.builtAfter >= 1900 &&
      q.builtAfter <= 2100
    )
      where.builtDate = { gte: new Date(`${q.builtAfter}-01-01`) }

    const rows = await this.prisma.complex.findMany({
      where,
      include: { units: true, pricing: true },
    })
    let items = rows.map((r) => toDto(r as ComplexWithRels))

    if (q.depositMax != null)
      items = items.filter((h) => h.deposit.min <= q.depositMax!)
    if (q.rentMax != null) items = items.filter((h) => h.rent.min <= q.rentMax!)
    if (q.areaMin != null) items = items.filter((h) => h.area.max >= q.areaMin!)
    if (q.areaMax != null) items = items.filter((h) => h.area.min <= q.areaMax!)

    return items.sort((a, b) => {
      if (q.sort === 'deposit') return a.deposit.min - b.deposit.min
      if (q.sort === 'built')
        return (b.builtDate ?? '').localeCompare(a.builtDate ?? '')
      return (b.score ?? 0) - (a.score ?? 0) // match(기본): 점수 내림차순
    })
  }

  async findOne(id: string): Promise<HousingDto> {
    const row = await this.prisma.complex.findUnique({
      where: { id },
      include: { units: true, pricing: true },
    })
    if (!row) throw new NotFoundException(`주택을 찾을 수 없습니다: ${id}`)
    return toDto(row as ComplexWithRels)
  }
}
