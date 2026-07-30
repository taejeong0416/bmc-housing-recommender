import { Controller, Get } from '@nestjs/common'

// 헬스체크 — 컨테이너 오케스트레이션·업타임 모니터용. DB ping은 P2-D-3에서 추가.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', ts: new Date().toISOString() }
  }
}
