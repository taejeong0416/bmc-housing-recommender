import { Module } from '@nestjs/common'
import { HousingsController } from './housings.controller'
import { HousingsService } from './housings.service'

@Module({
  controllers: [HousingsController],
  providers: [HousingsService],
  exports: [HousingsService], // RecommendModule이 하드필터·DTO 재사용
})
export class HousingsModule {}
