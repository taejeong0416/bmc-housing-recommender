import { Body, Controller, Ip, Post } from '@nestjs/common'
import { SearchService } from './search.service'

// POST /search/nl — 자연어 문장을 검색 조건(ParsedFilter)으로 파싱(P5-A-3 프록시).
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Post('nl')
  nl(@Body() body: { text?: unknown; context?: unknown }, @Ip() ip: string) {
    // text가 문자열이 아니면(숫자·객체 등) 빈 문자열로 — 서비스의 400(빈 문장)으로 수렴, 500 방지.
    return this.search.parseNl(
      typeof body?.text === 'string' ? body.text : '',
      ip,
      typeof body?.context === 'string' ? body.context : undefined,
    )
  }
}
