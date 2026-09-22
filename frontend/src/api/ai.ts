// AI 자연어 검색 — 자유 문장을 검색 조건으로 구조화 파싱(취향/조건 필드에 매핑).
// 응답 타입(ParsedFilter)은 @bmc/shared-types 단일 원천. 모델 호출은 항상 프록시
// (POST /api/search/nl — 배포는 Pages Function, 로컬은 백엔드)가 서버 키로 수행하고,
// 프롬프트·스키마는 프록시 쪽 nl-search 모듈이 보유한다.
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

/** 이전 대화 한 턴 — 모델이 앞 답변을 이어받아 되묻도록 프록시에 함께 보낸다. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export type { ParsedFilter, ParsedFollowup }

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

export async function parseQuery(
  text: string,
  context?: ParseContext,
  history: ChatTurn[] = [],
): Promise<ParsedFilter> {
  const ctx = context ? buildContextText(context) : null
  const raw = await apiPost<Partial<ParsedFilter>>('api/search/nl', {
    text,
    ...(ctx ? { context: ctx } : {}),
    ...(history.length ? { history } : {}),
  })
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
