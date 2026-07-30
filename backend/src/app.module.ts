import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config/env'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { HousingsModule } from './housings/housings.module'
import { MetaModule } from './meta/meta.module'
import { SearchModule } from './search/search.module'

// 모듈 골격(HARNESS §4): auth·users·notifications는 이후 단계에서 추가.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    HousingsModule,
    MetaModule,
    SearchModule,
  ],
})
export class AppModule {}
