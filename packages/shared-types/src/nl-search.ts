// AI 자연어 검색 호출부(P5) — Pages Function(functions/api/search/nl.ts)과 백엔드
// (backend/src/search)가 공유하는 프롬프트·스키마·LLM 호출. 주 모델은 Claude Sonnet이고,
// Gemini 키가 설정돼 있으면 Claude 실패(사용 한도 소진·장애·거절) 시 Gemini로 폴백한다.
// SDK 의존이 있어 index에서 재수출하지 않는다 — '@bmc/shared-types/dist/nl-search'로 import.
import Anthropic from '@anthropic-ai/sdk'
import { PREFERENCE_FEATURE_IDS } from './index'

export const NL_MAX_LEN = 300 // 입력 문장 길이 상한
export const NL_CONTEXT_MAX_LEN = 1000 // 개인화 컨텍스트 상한
export const NL_HISTORY_MAX_TURNS = 12 // 모델에 넘기는 이전 대화 턴 상한

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5'
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest'

/** 이전 대화 한 턴. assistant 턴은 요약과 그때 던진 질문을 담는다. */
export interface NlTurn {
  role: 'user' | 'assistant'
  text: string
}

export const NL_SYSTEM = `너는 부산도시공사(BMC) 공공임대주택 검색 도우미다.
사용자의 한국어 문장에서 검색 조건을 구조화해 뽑아라. 문장에 없는 조건 항목은 넣지 마라(생략).
- depositMax / rentMax: 보증금·월세 상한을 만원 단위 숫자로. (예: "보증금 3천만원"=3000, "월 50만원 이하"=50)
- regions: "수영구","기장군" 등 구/군 이름 배열. "해운대"·"기장"처럼 구/군을 뺀 지명도 해당 구/군 이름으로 바꿔 넣는다.
- rentType: 공급유형(행복주택·통합공공임대 등)이 명시될 때만. 없으면 생략.
- buildYear: "신축"·"새 집"은 '5년 이내'. "준공 N년" 등은 가장 가까운 보기. 언급 없으면 생략.
- area: 전용면적(m²)이 명시될 때만.
- houseTypes: 방 구조. 문장에 "원룸","1.5룸","투룸","쓰리룸"이 나오면 반드시 넣어라.
- tags: 생활 인프라 선호. 아래 id 중에서만 고른다:
  rail_access(도시철도 접근), cafe_choice(카페), fitness_access(운동시설), supermarket_access(마트), restaurant_choice(외식), culture_access(문화·여가), quiet_residential(조용한 주거), park_walk(공원).
  weight = 강조/"꼭"/"자주"=3, 보통=2, "있으면 좋음"/"멀어도 됨"=1.
  "아늑한 곳"·"혼자 조용히 쉬고 싶다"처럼 생활 모습으로 말한 취향도 가장 가까운 id로 옮긴다.
- unresolved: 조건으로 해석하지 못한 모호하거나 지원하지 않는 표현을 짧은 구절 배열로(예: 모순된 조건, 위 항목에 없는 축). 모두 명확히 해석했으면 생략.
- followup: 취향을 더 끌어내는 짧은 질문 하나(question)와 탭 가능한 보기 2~4개(options). 각 보기는 짧은 label과 그 선택이 뜻하는 tags(위 8개 id, weight 2~3)를 담는다. 규칙:
  · 사용자가 취향을 모르거나("잘 모르겠어요"·"글쎄요"·"아무거나"·막연) 취향 tags를 아직 못 뽑았으면 반드시 followup을 채운다("취향을 잘 모르겠다"류는 unresolved가 아니라 followup 트리거).
  · [아직 안 물어본 취향 축]이 주어지면 그중 하나를 골라 그 축을 겨냥해 묻는다(한 번에 하나, [파악된 취향]에 이미 있는 축은 다시 묻지 않는다).
  · [파악된 취향]이 2개 이상이면 그중 둘을 놓고 "A와 B 중 뭐가 더 중요하세요?"처럼 하나만 고르게 해 강도를 가린다(각 보기 tags에 해당 축 하나만 weight 3).
  · 이전 대화가 주어지면 사용자가 앞에서 한 답을 이어받아 묻는다(예: "주말엔 집에서 쉰다고 하셨는데…"). 이미 한 질문이나 같은 뜻의 질문은 반복하지 않는다.
  · "잘 모르겠어요"·"상관없어요" 같은 회피 보기는 tags를 비운다.
  · 질문은 존댓말·생활 각도(출퇴근·주말·동네 분위기·집에서 보내는 시간)로. 안 물어본 축이 없고 강도까지 갈렸거나, 사용자가 명확한 조건만 원하면 followup을 비운다.
  취향을 물을 거면 질문을 summary에만 적지 말고 followup의 question+options로 낸다. followup을 채웠으면 unresolved는 비운다.
  followup을 내더라도 이번 문장에 명시된 조건(regions·depositMax·rentMax·houseTypes 등)은 빠짐없이 채운다. 되묻기는 조건 추출을 대신하지 않는다.
- summary: 이해한 조건을 요약한 친근한 한 문장(존댓말, 30자 내외). followup을 낼 때는 질문으로 자연스럽게 이어지는 말로.
- [마무리]가 주어지면 대화의 마지막 턴이다. followup과 unresolved는 비우고, 이전 대화 전체에서 드러난 취향을 tags로 모두 뽑는다(답이 모호했어도 가장 가까운 id로 결론을 낸다). summary는 "지금까지 말씀을 정리하면 …"처럼 파악한 취향을 결론짓는 한두 문장(존댓말, 60자 내외)으로 쓴다.
사용자의 현재 조건이나 관심목록 경향, 파악된 취향이 함께 주어지면, summary에 그 맥락을 자연스럽게 반영해도 된다(단 필터 필드는 이번 문장에 명시된 것만 채워라 — 맥락이나 이전 대화로 필드를 임의로 채우지 마라).`

const tagItem = {
  type: 'object',
  properties: {
    id: { type: 'string', enum: [...PREFERENCE_FEATURE_IDS] },
    weight: { type: 'integer' },
  },
  required: ['id', 'weight'],
}

// 응답 JSON 스키마(Gemini responseSchema 형식). Claude에는 withStrictObjects로 변환해 보낸다.
export const NL_SCHEMA = {
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
    tags: { type: 'array', items: tagItem },
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
              tags: { type: 'array', items: tagItem },
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

// Claude structured outputs는 모든 object에 additionalProperties: false를 요구한다.
// Gemini responseSchema는 이 키를 받지 않아 원본은 그대로 두고 사본을 만든다. (테스트용 export)
export function withStrictObjects(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withStrictObjects)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) out[k] = withStrictObjects(v)
  if (out.type === 'object') out.additionalProperties = false
  return out
}

/** 요청 본문의 history를 검증·절단한다. 형식이 어긋난 턴은 버리고, 첫 턴은 user로 맞춘다. */
export function cleanHistory(v: unknown): NlTurn[] {
  if (!Array.isArray(v)) return []
  const turns = v
    .filter(
      (t): t is NlTurn =>
        !!t &&
        (t.role === 'user' || t.role === 'assistant') &&
        typeof t.text === 'string' &&
        t.text.trim() !== '',
    )
    .slice(-NL_HISTORY_MAX_TURNS)
    .map((t) => ({ role: t.role, text: t.text.trim().slice(0, NL_MAX_LEN) }))
  const first = turns.findIndex((t) => t.role === 'user')
  return first < 0 ? [] : turns.slice(first)
}

// 마지막 사용자 메시지 = 개인화 컨텍스트 + 이번 문장. (테스트용 export)
export function lastUserText(text: string, context: string): string {
  return context ? `${context}\n\n[이번 문장] ${text}` : text
}

export interface NlLlmConfig {
  anthropicApiKey?: string
  anthropicModel?: string
  geminiApiKey?: string
  geminiModel?: string
  fetch?: typeof fetch // 테스트 주입용
}

export class NlNotConfiguredError extends Error {
  constructor() {
    super('AI 검색이 설정되지 않았습니다.')
  }
}

/**
 * 자유 문장 → 모델 원본 JSON. Claude를 먼저 부르고, 실패하면 Gemini 키가 있을 때만 폴백한다.
 * 둘 다 실패하면 마지막 오류를 던진다. 결과 검증·정규화는 호출부가 담당한다.
 */
export async function callNlModel(
  input: { text: string; context?: string; history?: NlTurn[] },
  cfg: NlLlmConfig,
): Promise<{ raw: unknown; provider: 'claude' | 'gemini' }> {
  if (!cfg.anthropicApiKey && !cfg.geminiApiKey)
    throw new NlNotConfiguredError()
  const text = input.text
  const context = input.context ?? ''
  const history = input.history ?? []
  let lastError: unknown
  if (cfg.anthropicApiKey) {
    try {
      return {
        raw: await callClaude(text, context, history, cfg),
        provider: 'claude',
      }
    } catch (e) {
      lastError = e
      // 폴백은 화면에서 티가 나지 않으므로 로그로만 드러난다(wrangler pages deployment tail).
      console.warn('[nl-search] Claude 호출 실패:', errorText(e))
    }
  }
  if (cfg.geminiApiKey) {
    try {
      return {
        raw: await callGemini(text, context, history, cfg),
        provider: 'gemini',
      }
    } catch (e) {
      lastError = e
      console.warn('[nl-search] Gemini 호출 실패:', errorText(e))
    }
  }
  throw lastError
}

const errorText = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).slice(0, 300)

async function callClaude(
  text: string,
  context: string,
  history: NlTurn[],
  cfg: NlLlmConfig,
): Promise<unknown> {
  const client = new Anthropic({
    apiKey: cfg.anthropicApiKey,
    timeout: 20_000, // 폴백까지 합쳐 검색창 대기가 길어지지 않도록
    maxRetries: 1,
    ...(cfg.fetch ? { fetch: cfg.fetch } : {}),
  })
  const res = await client.messages.create({
    model: cfg.anthropicModel || DEFAULT_CLAUDE_MODEL,
    max_tokens: 4096,
    system: NL_SYSTEM,
    output_config: {
      effort: 'low', // 짧은 파싱 작업 — 응답 지연을 줄인다
      format: {
        type: 'json_schema',
        schema: withStrictObjects(NL_SCHEMA) as Record<string, unknown>,
      },
    },
    messages: [
      ...history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user' as const, content: lastUserText(text, context) },
    ],
  })
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens')
    throw new Error(`Claude 응답 중단 (${res.stop_reason})`)
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text')
    throw new Error('Claude 응답이 비었습니다.')
  return JSON.parse(block.text)
}

async function callGemini(
  text: string,
  context: string,
  history: NlTurn[],
  cfg: NlLlmConfig,
): Promise<unknown> {
  const model = cfg.geminiModel || DEFAULT_GEMINI_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.geminiApiKey}`
  const contents = [
    ...history.map((t) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: t.text }],
    })),
    { role: 'user', parts: [{ text: lastUserText(text, context) }] },
  ]
  const res = await (cfg.fetch ?? fetch)(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: NL_SYSTEM }] },
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: NL_SCHEMA,
        temperature: 0.1,
      },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status} ${detail.slice(0, 120)}`)
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
}
