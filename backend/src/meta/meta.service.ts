import { Injectable } from '@nestjs/common'
import type { FilterMeta } from '@bmc/shared-types'
import { PrismaService } from '../prisma/prisma.service'

// 필터 옵션 메타 — DB distinct(공급유형·지역). 프론트의 하드코딩 옵션을 실데이터로 대체.
@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  async filters(): Promise<FilterMeta> {
    const [types, districts] = await Promise.all([
      this.prisma.complex.findMany({
        distinct: ['type'],
        select: { type: true },
        orderBy: { type: 'asc' },
      }),
      this.prisma.complex.findMany({
        distinct: ['district'],
        select: { district: true },
        orderBy: { district: 'asc' },
      }),
    ])
    return {
      types: types.map((t) => t.type),
      districts: districts.map((d) => d.district),
    }
  }
}
