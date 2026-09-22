import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'
import { PREFERENCE_FEATURE_IDS, type ParsedFilter } from '@bmc/shared-types'
import {
  NL_CONTEXT_MAX_LEN,
  NL_MAX_LEN,
  NlNotConfiguredError,
  callNlModel,
  cleanHistory,
} from '@bmc/shared-types/dist/nl-search'

const RL_WINDOW_MS = 60_000 // 레이트리밋 윈도우(P5-B-1)
const RL_MAX = 20 // IP당 윈도우 내 최대 호출
const CACHE_TTL_MS = 10 * 60_000 // 동일 문장 캐시 수명(P5-B-2)
const CACHE_MAX = 200 // 캐시 상한(초과 시 오래된 것부터 제거)

// 프롬프트·JSON 스키마·모델 호출은 Pages Function과 공유하는 nl-search 모듈이 단일 원천.
// 결과 shape의 단일 원천은 @bmc/shared-types의 ParsedFilter 타입.

// 모델 원본 JSON 출력 재검증(P5-B-1) — 프록시를 직접 호출해도 검증 안 된 shape이
// 새어 나가지 않도록 방어. 필드별 `.catch`로 잘못된 값만 떨궈 관대하게 통과시킨다
// (전체 거부 대신 부분 보존). 정규화(빈 배열 제거 등)는 프론트 normalize가 마무리.
const outputSchema = z
  .object({
    rentType: z.string().optional().catch(undefined),
    depositMax: z.number().optional().catch(undefined),
    rentMax: z.number().optional().catch(undefined),
    regions: z.array(z.string()).optional().catch(undefined),
    buildYear: z
      .enum(['5년 이내', '10년 이내', '15년 이내', '제한 없음'])
      .optional()
      .catch(undefined),
    area: z
      .enum(['~ 30m² (원룸)', '30 ~ 40m²', '40 ~ 60m²', '60m² 이상', '전체'])
      .optional()
      .catch(undefined),
    houseTypes: z
      .array(z.enum(['원룸', '1.5룸', '투룸', '쓰리룸+']))
      .optional()
      .catch(undefined),
    tags: z
      .array(
        z.object({ id: z.enum(PREFERENCE_FEATURE_IDS), weight: z.number() }),
      )
      .optional()
      .catch(undefined),
    unresolved: z.array(z.string()).optional().catch(undefined),
    followup: z
      .object({
        question: z.string(),
        options: z.array(
          z.object({
            label: z.string(),
            tags: z
              .array(
                z.object({
                  id: z.enum(PREFERENCE_FEATURE_IDS),
                  weight: z.number(),
                }),
              )
              .optional()
              .catch(undefined),
          }),
        ),
      })
      .optional()
      .catch(undefined),
    summary: z.string().catch('조건을 이해했어요.'),
  })
  .strip()

// 자유 문장 → 구조화 필터. API 키는 서버 env에만 두어 번들에 노출하지 않는다.
// 모델 원본 JSON을 zod로 재검증해 반환하고, 정규화(normalize/augment)는 프론트가 담당.
@Injectable()
export class SearchService {
  constructor(private readonly config: ConfigService) {}

  // IP별 호출 타임스탬프(슬라이딩 윈도우) — 단일 인스턴스 데모 기준. 분산 배포 시 Redis로 대체.
  private readonly hits = new Map<string, number[]>()
  // 동일 요청 캐시 — 컨텍스트·대화 기록·정규화 문장 키 → 모델 출력 + 적재 시각.
  private readonly cache = new Map<
    string,
    { at: number; value: Partial<ParsedFilter> }
  >()

  async parseNl(
    text: string,
    ip = 'unknown',
    context?: string,
    history?: unknown,
  ): Promise<Partial<ParsedFilter>> {
    const clean = (text ?? '').trim()
    if (!clean) throw new BadRequestException('검색 문장이 비었습니다.')
    if (clean.length > NL_MAX_LEN)
      throw new BadRequestException(
        `검색 문장이 너무 깁니다(최대 ${NL_MAX_LEN}자).`,
      )
    // 개인화 컨텍스트(P5-C-1) — 문장이 아니라 참고 맥락이라 상한만 두고 캐시 키에 포함.
    const ctx = (context ?? '').trim().slice(0, NL_CONTEXT_MAX_LEN)
    const turns = cleanHistory(history)

    this.rateLimit(ip)

    const cacheKey = JSON.stringify([ctx, turns, clean.toLowerCase()])
    const cached = this.getCached(cacheKey)
    if (cached) return cached

    let json: unknown
    try {
      json = (
        await callNlModel(
          { text: clean, context: ctx, history: turns },
          {
            anthropicApiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
            anthropicModel: this.config.get<string>('ANTHROPIC_MODEL'),
            geminiApiKey: this.config.get<string>('GEMINI_API_KEY'),
            geminiModel: this.config.get<string>('GEMINI_MODEL'),
          },
        )
      ).raw
    } catch (e) {
      if (e instanceof NlNotConfiguredError)
        throw new ServiceUnavailableException(e.message)
      throw new ServiceUnavailableException(
        `AI 응답 실패: ${e instanceof Error ? e.message.slice(0, 120) : ''}`,
      )
    }
    const parsed = outputSchema.safeParse(json)
    const value: Partial<ParsedFilter> = parsed.success
      ? parsed.data
      : { summary: '조건을 이해했어요.' }

    this.setCached(cacheKey, value)
    return value
  }

  private rateLimit(ip: string): void {
    const now = Date.now()
    const recent = (this.hits.get(ip) ?? []).filter(
      (t) => now - t < RL_WINDOW_MS,
    )
    if (recent.length >= RL_MAX)
      throw new HttpException(
        '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    recent.push(now)
    this.hits.set(ip, recent)
  }

  private getCached(key: string): Partial<ParsedFilter> | null {
    const hit = this.cache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > CACHE_TTL_MS) {
      this.cache.delete(key)
      return null
    }
    return hit.value
  }

  private setCached(key: string, value: Partial<ParsedFilter>): void {
    this.cache.set(key, { at: Date.now(), value })
    if (this.cache.size > CACHE_MAX) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
  }
}
