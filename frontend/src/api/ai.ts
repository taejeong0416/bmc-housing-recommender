// AI 자연어 검색 — 자유 문장을 검색 조건으로 구조화 파싱(취향/조건 필드에 매핑).
// 응답 타입(ParsedFilter)은 @bmc/shared-types 단일 원천. 프롬프트·스키마는 이 데모
// 경로가 보유하고, 백엔드 프록시(backend/src/search)가 동형 사본을 가진다.
// 경로: VITE_GEMINI_API_KEY가 있으면 프론트 직접 호출(Pages 데모, 키 번들 노출),
//       없으면 백엔드 프록시(POST /api/search/nl, 키 서버 보관)로 위임.
import type { ParsedFilter, ParsedFollowup } from '@bmc/shared-types'
import {
  ALL_TYPE,
  OPEN_DEPOSIT,
  OPEN_RENT,
  type FilterPrefs,
} from '../lib/filter'
import { apiPost } from './client'

export interface ParseContext {
  current: FilterPrefs // 현재 설정한 조건(열린 축은 무시)
  favSummary: string | null // 관심목록 경향 요약
  knownTaste?: string | null // 대화에서 이미 끌어낸 취향 요약(재질문 방지)
  uncoveredAxes?: string[] // 아직 안 물어본 취향 카테고리 라벨(그릴링이 빈 축을 겨냥)
}

export type { ParsedFilter, ParsedFollowup }

const KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
// 대화형 되묻기(followup)는 lite 모델에서 불안정(출력 폭주·구조화 누락) — flash 기본.
const MODEL =
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ??
  'gemini-flash-latest'

const TAG_IDS = [
  'rail_access',
  'cafe_choice',
  'fitness_access',
  'supermarket_access',
  'restaurant_choice',
  'culture_access',
  'quiet_residential',
  'park_walk',
]

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
          id: { type: 'string', enum: TAG_IDS },
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
                    id: { type: 'string', enum: TAG_IDS },
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

export async function parseQuery(
  text: string,
  context?: ParseContext,
): Promise<ParsedFilter> {
  const ctx = context ? buildContextText(context) : null
  const raw = KEY ? await callGemini(text, ctx) : await callProxy(text, ctx)
  return augment(text, normalize(raw))
}

// 개인화 컨텍스트(P5-C-1) → 프롬프트 첨부 문자열. 필터 필드는 이번 문장에서만 채우고,
// 이 맥락은 summary 톤·관련성에만 쓰인다(필드 병합은 클라이언트가 담당).
function buildContextText(c: ParseContext): string | null {
  const p = c.current
  const cond: string[] = []
  if (p.regions.length) cond.push(p.regions.join('·'))
  if (p.rentType !== ALL_TYPE) cond.push(p.rentType)
  if (p.buildYear !== '제한 없음') cond.push(`준공 ${p.buildYear}`)
  if (p.area !== '전체') cond.push(p.area)
  if (p.houseTypes.length) cond.push(p.houseTypes.join('·'))
  if (p.depositMax !== OPEN_DEPOSIT)
    cond.push(`보증금 ${p.depositMax.toLocaleString()}만 이하`)
  if (p.rentMax !== OPEN_RENT) cond.push(`월세 ${p.rentMax}만 이하`)
  const lines: string[] = []
  if (cond.length) lines.push(`[현재 설정 조건] ${cond.join(', ')}`)
  if (c.favSummary) lines.push(`[관심목록 경향] ${c.favSummary}`)
  if (c.knownTaste) lines.push(`[파악된 취향] ${c.knownTaste}`)
  if (c.uncoveredAxes?.length)
    lines.push(`[아직 안 물어본 취향 축] ${c.uncoveredAxes.join(', ')}`)
  return lines.length ? lines.join('\n') : null
}

// Pages 데모 경로 — 키가 번들에 포함된 상태에서 Gemini 직접 호출.
async function callGemini(
  text: string,
  context: string | null,
): Promise<Partial<ParsedFilter>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`
  const parts = context ? [{ text: context }, { text }] : [{ text }]
  const contents = [{ role: 'user', parts }]
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
    throw new Error(`Gemini ${res.status} ${detail.slice(0, 120)}`)
  }
  const data = await res.json()
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  try {
    return JSON.parse(out) as Partial<ParsedFilter>
  } catch {
    // 토큰 잘림 등으로 JSON이 깨진 경우 — SyntaxError 원문 대신 사용자 언어로.
    throw new Error('AI 응답을 해석하지 못했어요. 다시 시도해 주세요.')
  }
}

// 프로덕션 경로 — 백엔드가 서버 키로 Gemini를 호출하고 원본 JSON을 돌려준다.
function callProxy(
  text: string,
  context: string | null,
): Promise<Partial<ParsedFilter>> {
  return apiPost<Partial<ParsedFilter>>('api/search/nl', {
    text,
    ...(context ? { context } : {}),
  })
}

// 키워드 안전망 — lite 모델이 놓치기 쉬운 명시적 방 구조·신축을 원문에서 보강. (테스트용 export)
const ROOM_WORDS: [string, string][] = [
  ['원룸', '원룸'],
  ['1.5룸', '1.5룸'],
  ['투룸', '투룸'],
  ['쓰리룸', '쓰리룸+'],
]
export function augment(text: string, p: ParsedFilter): ParsedFilter {
  const houseTypes = new Set(p.houseTypes ?? [])
  for (const [word, val] of ROOM_WORDS)
    if (text.includes(word)) houseTypes.add(val)
  const buildYear =
    p.buildYear ?? (/신축|새\s?집/.test(text) ? '5년 이내' : undefined)
  return {
    ...p,
    houseTypes: houseTypes.size ? [...houseTypes] : undefined,
    buildYear,
  }
}

// 태그 배열 방어 — id 화이트리스트·weight 1~3 클램프. (followup 보기와 공용)
function cleanTags(v: unknown): { id: string; weight: number }[] {
  return (Array.isArray(v) ? v : [])
    .filter((t) => t && TAG_IDS.includes(t.id))
    .map((t) => ({
      id: t.id as string,
      weight: Math.min(3, Math.max(1, Math.round(t.weight) || 2)),
    }))
}

// followup 방어 — 질문 문자열·보기 2~4개(label 필수)만 통과. 형식 어긋나면 드롭. (테스트용 export)
export function normalizeFollowup(v: unknown): ParsedFollowup | undefined {
  const f = v as Partial<ParsedFollowup> | undefined
  if (!f || typeof f.question !== 'string' || !f.question.trim())
    return undefined
  const options = (Array.isArray(f.options) ? f.options : [])
    .filter((o) => o && typeof o.label === 'string' && o.label.trim())
    .slice(0, 4)
    .map((o) => {
      const tags = cleanTags(o.tags)
      return tags.length ? { label: o.label, tags } : { label: o.label }
    })
  if (options.length < 2) return undefined
  return { question: f.question, options }
}

// 모델 출력 방어: 태그 id·가중치 정리, 빈 배열/음수 제거. (테스트용 export)
// 프록시 원본 JSON은 스키마 보장이 없으므로 배열 필드는 형태부터 방어한다.
export function normalize(p: Partial<ParsedFilter>): ParsedFilter {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const tags = cleanTags(p.tags)
  const regions = arr<string>(p.regions)
  const houseTypes = arr<string>(p.houseTypes)
  const unresolved = arr<string>(p.unresolved).filter(
    (s) => typeof s === 'string' && s.trim(),
  )
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined)
  return {
    rentType: p.rentType && p.rentType !== ALL_TYPE ? p.rentType : undefined,
    depositMax: num(p.depositMax),
    rentMax: num(p.rentMax),
    regions: regions.length ? regions : undefined,
    buildYear: p.buildYear || undefined,
    area: p.area || undefined,
    houseTypes: houseTypes.length ? houseTypes : undefined,
    tags: tags.length ? tags : undefined,
    unresolved: unresolved.length ? unresolved : undefined,
    followup: normalizeFollowup(p.followup),
    summary: p.summary || '조건을 이해했어요.',
  }
}

// 현재 조건(열린 축 제외) → ParsedFilter 베이스(P5-C-1 병합의 기반). 태그는 병합하지
// 않는다 — 취향(태그)은 이번 문장이 표현하는 것으로 봐, 초기 기본 태그 혼입을 막는다.
export function parsedFromPrefs(p: FilterPrefs): ParsedFilter {
  return {
    rentType: p.rentType !== ALL_TYPE ? p.rentType : undefined,
    depositMax: p.depositMax !== OPEN_DEPOSIT ? p.depositMax : undefined,
    rentMax: p.rentMax !== OPEN_RENT ? p.rentMax : undefined,
    regions: p.regions.length ? p.regions : undefined,
    buildYear: p.buildYear !== '제한 없음' ? p.buildYear : undefined,
    area: p.area !== '전체' ? p.area : undefined,
    houseTypes: p.houseTypes.length ? p.houseTypes : undefined,
    summary: '',
  }
}

// 이번 문장 파싱(p)을 현재 조건 베이스 위에 덮어쓴다(P5-C-1). 문장에 명시된 필터 축은 p가
// 우선, 없는 축은 현재 조건 유지. 태그·summary·unresolved는 이번 문장(p) 그대로.
export function mergeInto(base: ParsedFilter, p: ParsedFilter): ParsedFilter {
  return {
    rentType: p.rentType ?? base.rentType,
    depositMax: p.depositMax ?? base.depositMax,
    rentMax: p.rentMax ?? base.rentMax,
    regions: p.regions ?? base.regions,
    buildYear: p.buildYear ?? base.buildYear,
    area: p.area ?? base.area,
    houseTypes: p.houseTypes ?? base.houseTypes,
    tags: p.tags,
    unresolved: p.unresolved,
    summary: p.summary,
  }
}

// ParsedFilter → 필터 슬라이스(언급 안 된 축은 '열린 상태'로 채움). 지도 필터와 동형.
export function prefsFromParse(p: ParsedFilter): FilterPrefs {
  return {
    rentType: p.rentType ?? ALL_TYPE,
    depositMax: p.depositMax ?? OPEN_DEPOSIT,
    rentMax: p.rentMax ?? OPEN_RENT,
    regions: p.regions ?? [],
    buildYear: p.buildYear ?? '제한 없음',
    area: p.area ?? '전체',
    houseTypes: p.houseTypes ?? [],
    elevatorRequired: false,
    parkingRequired: false,
  }
}
