import { Controller, Get } from '@nestjs/common'
import { MetaService } from './meta.service'

// GET /meta/filters — 필터 셀렉트 옵션(공급유형·지역) 실데이터 메타.
@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get('filters')
  filters() {
    return this.meta.filters()
  }
}
