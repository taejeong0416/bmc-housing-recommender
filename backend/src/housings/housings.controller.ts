import { Controller, Get, Param, Query } from '@nestjs/common'
import { HousingsService, type HousingQuery } from './housings.service'

// 숫자 쿼리 파라미터: '0'은 유효값, 빈 값·비숫자는 필터 미적용(undefined) — truthy 체크/NaN 전파 금지.
function numParam(s: string | undefined): number | undefined {
  if (s == null || s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

// GET /housings(필터·정렬) · GET /housings/:id — 응답은 GeneratedHousing[]/단건(프론트 API와 동형).
@Controller('housings')
export class HousingsController {
  constructor(private readonly housings: HousingsService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    const query: HousingQuery = {
      district: q.district,
      type: q.type,
      depositMax: numParam(q.depositMax),
      rentMax: numParam(q.rentMax),
      builtAfter: numParam(q.builtAfter),
      areaMin: numParam(q.areaMin),
      areaMax: numParam(q.areaMax),
      sort: q.sort === 'deposit' || q.sort === 'built' ? q.sort : 'match',
    }
    return this.housings.findAll(query)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.housings.findOne(id)
  }
}
