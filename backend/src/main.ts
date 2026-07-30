import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks() // 그레이스풀 셧다운(P2-D-3)
  app.enableCors()
  app.setGlobalPrefix('api') // 프론트 계약(/api/*)과 일치 → VITE_API_BASE_URL만으로 연동
  const config = app.get(ConfigService)
  const port = config.get<number>('PORT') ?? 3000
  await app.listen(port)
  console.log(`[backend] listening on :${port}`)
}

bootstrap()
