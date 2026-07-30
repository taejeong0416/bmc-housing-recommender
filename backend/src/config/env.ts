import { z } from 'zod'

// 환경변수 스키마 = 타입 단일 원천(zod).
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  // PrismaService가 부팅 시 eager $connect() — 필수로 검증해 미설정을 부팅 시점에 명확히 알린다.
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(), // AI 검색(P5) — 미설정 시 /search/nl 503
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),
})

export type Env = z.infer<typeof envSchema>

// @nestjs/config validate 훅 — 부팅 시 검증 실패하면 즉시 종료.
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`환경변수 검증 실패:\n${detail}`)
  }
  return parsed.data
}
