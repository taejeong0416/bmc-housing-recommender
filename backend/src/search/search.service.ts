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

const MAX_LEN = 300 // 입력 길이 상한(P5-B-1)
const RL_WINDOW_MS = 60_000 // 레이트리밋 윈도우(P5-B-1)
const RL_MAX = 20 // IP당 윈도우 내 최대 호출
const CACHE_TTL_MS = 10 * 60_000 // 동일 문장 캐시 수명(P5-B-2)
const CACHE_MAX = 200 // 캐시 상한(초과 시 오래된 것부터 제거)

// 프롬프트·JSON 스키마 — 프론트 데모 경로(frontend/src/api/ai.ts)와 동형 사본.
// 결과 shape의 단일 원천은 @bmc/shared-types의 ParsedFilter 타입.
const SYSTEM = `너는 부산도시공사(BMC) 공공임대주택 검색 도우미다.
사용자의 한국어 문장에서 검색 조건을 구조화해 뽑아라. 문장에 없는 조건 항목은 넣지 마라(생략).
- depositMax / rentMax: 보증금·월세 상한을 만원 단위 숫자로. (예: "보증금 3천만원"=3000, "월 50만원 이하"=50)
- regions: "수영구","기장군" 등 구/군 이름 배열.
- rentType: 공급유형(행복주택·통합공공임대 등)이 명시될 때만. 없으면 생략.
- buildYear: "신축"·"새 집"은 '5년 이내'. "준공 N년" 등은 가장 가까운 보기. 언급 없으면 생략.
- area: 전용면적(m²)이 명시될 때만.
- houseTypes: 방 구조. 문장에 "원룸","1.5룸","투룸","쓰리룸"이 나오면 반드시 넣어라.
- tags: 생활 인프라 선호. 아래 id 중에서만 고른다:
  rail_access(도시철도 접근), cafe_choice(카페), fitness_access(운동시설), supermarket_access(마트), restaurant_choice(외식), culture_access(문화·여가), quiet_residential(조용한 주거), park_walk(공원).
  weight = 강조/"꼭"/"자주"=3, 보통=2, "있으면 좋음"/"멀어도 됨"=1.
- unresolved: 조건으로 해석하지 못한 모호하거나 지원하지 않는 표현을 짧은 구절 배열로(예: 모순된 조건, 위 항목에 없는 축). 모두 명확히 해석했으면 생략.
- followup: 취향을 더 끌어내는 짧은 질문 하나(question)와 탭 가능한 보기 2~4개(options). 각 보기는 짧은 label과 그 선택이 뜻하는 tags(위 8개 id, weight 2~3)를 담는다. 규칙:
  · 사용자가 취향을 모르거나("잘 모르겠어요"·"글쎄요"·"아무거나"·막연) 취향 tags를 아직 못 뽑았으면 반드시 followup을 채운다("취향을 잘 모르겠다"류는 unresolved가 아니라 followup 트리거).
  · [아직 안 물어본 취향 축]이 주어지면 그중 하나를 골라 그 축을 겨냥해 묻는다(한 번에 하나, [파악된 취향]에 이미 있는 축은 다시 묻지 않는다).
  · [파악된 취향]이 2개 이상이면 그중 둘을 놓고 "A와 B 중 뭐가 더 중요하세요?"처럼 하나만 고르게 해 강도를 가린다(각 보기 tags에 해당 축 하나만 weight 3).
  · "잘 모르겠어요"·"상관없어요" 같은 회피 보기는 tags를 비운다.
  · 질문은 존댓말·생활 각도(출퇴근·주말·동네 분위기·집에서 보내는 시간)로. 안 물어본 축이 없고 강도까지 갈렸거나, 사용자가 명확한 조건만 원하면 followup을 비운다.
  취향을 물을 거면 질문을 summary에만 적지 말고 followup의 question+options로 낸다. followup을 채웠으면 unresolved는 비운다.
- summary: 이해한 조건을 요약한 친근한 한 문장(존댓말, 30자 내외). followup을 낼 때는 질문으로 자연스럽게 이어지는 말로.
사용자의 현재 조건이나 관심목록 경향, 파악된 취향이 함께 주어지면, summary에 그 맥락을 자연스럽게 반영해도 된다(단 필터 필드는 이번 문장에 명시된 것만 채워라 — 맥락으로 필드를 임의로 채우지 마라).`

const SCHEMA = {
  type: 'object',
  properties: {
    rentType: { type: 'string' },
    depositMax: { type: 'number' },
    rentMax: { type: 'number' },
    regions: { type: 'array', items: { type: 'string' } },
    buildYear: {
      type: 'string',
      enum: ['5년 이내', '10년 이내', '15년 이내', '제한 없음'],
    },
    area: {
      type: 'string',
      enum: ['~ 30m² (원룸)', '30 ~ 40m²', '40 ~ 60m²', '60m² 이상', '전체'],
    },
    houseTypes: {
      type: 'array',
      items: { type: 'string', enum: ['원룸', '1.5룸', '투룸', '쓰리룸+'] },
    },
    tags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: [...PREFERENCE_FEATURE_IDS] },
          weight: { type: 'integer' },
        },
        required: ['id', 'weight'],
      },
    },
    unresolved: { type: 'array', items: { type: 'string' } },
    followup: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              tags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', enum: [...PREFERENCE_FEATURE_IDS] },
                    weight: { type: 'integer' },
                  },
                  required: ['id', 'weight'],
                },
              },
            },
            required: ['label'],
          },
        },
      },
      required: ['question', 'options'],
    },
    summary: { type: 'string' },
  },
  required: ['summary'],
}

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

// 자유 문장 → 구조화 필터. Gemini 키는 서버 env에만 두어 번들에 노출하지 않는다.
// 모델 원본 JSON을 zod로 재검증해 반환하고, 정규화(normalize/augment)는 프론트가 담당.
@Injectable()
export class SearchService {
  constructor(private readonly config: ConfigService) {}

  // IP별 호출 타임스탬프(슬라이딩 윈도우) — 단일 인스턴스 데모 기준. 분산 배포 시 Redis로 대체.
  private readonly hits = new Map<string, number[]>()
  // 동일 문장 캐시 — 정규화 키(소문자 trim) → 모델 출력 + 적재 시각.
  private readonly cache = new Map<
    string,
    { at: number; value: Partial<ParsedFilter> }
  >()

  async parseNl(
    text: string,
    ip = 'unknown',
    context?: string,
  ): Promise<Partial<ParsedFilter>> {
    const clean = (text ?? '').trim()
    if (!clean) throw new BadRequestException('검색 문장이 비었습니다.')
    if (clean.length > MAX_LEN)
      throw new BadRequestException(
        `검색 문장이 너무 깁니다(최대 ${MAX_LEN}자).`,
      )
    // 개인화 컨텍스트(P5-C-1) — 문장이 아니라 참고 맥락이라 상한만 두고 캐시 키에 포함.
    const ctx = (context ?? '').trim().slice(0, MAX_LEN)

    this.rateLimit(ip)

    const cacheKey = ctx ? `${ctx} ${clean.toLowerCase()}` : clean.toLowerCase()
    const cached = this.getCached(cacheKey)
    if (cached) return cached

    const key = this.config.get<string>('GEMINI_API_KEY')
    if (!key)
      throw new ServiceUnavailableException('AI 검색이 설정되지 않았습니다.')
    // 대화형 되묻기(followup)는 lite 모델에서 불안정(출력 폭주·구조화 누락) — flash 기본.
    const model =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-flash-latest'

    const parts = ctx ? [{ text: ctx }, { text: clean }] : [{ text: clean }]
    const contents = [{ role: 'user', parts }]
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0.1,
        },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ServiceUnavailableException(
        `AI 응답 실패 (${res.status}) ${detail.slice(0, 120)}`,
      )
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      throw new ServiceUnavailableException('AI 응답을 해석하지 못했습니다.')
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
