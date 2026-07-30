import { z } from 'zod'

/**
 * 도메인 단일 원천 — canonical 스키마(zod) · GeneratedHousing · 집계 규칙.
 * 인제스천(scripts/ingest)·백엔드(backend)·프론트(frontend)가 같은 정의를 공유한다(HARNESS §1·§4).
 */

// ── canonical 3엔티티 (P0-A-2) ──────────────────────────────────────────────

export const HousingType = z.enum([
  '매입임대',
  '행복주택',
  '통합공공임대',
  '재개발임대',
])
export type HousingType = z.infer<typeof HousingType>

export const Complex = z.object({
  id: z.string(), // 주소(유형단지는 임대주택명) 정규화 해시
  type: HousingType,
  name: z.string(),
  address: z.string(),
  district: z.string(),
  dong: z.string(),
  builtDate: z.string().nullable(), // 사용승인일·준공일자 → ISO
  totalUnits: z.number().int().nonnegative(),
  elevator: z.boolean(),
  parking: z.number().int().nonnegative(),
  lat: z.number().nullable(), // 지오코딩 결과
  lng: z.number().nullable(),
  // 좌표 출처·품질등급 — 로컬 주소/도로 인덱스 결합 결과(태그 C/D 좌표 유효성 게이팅에 사용).
  coordinateSource: z.string().nullable().optional(),
  coordinateAccuracy: z
    .enum(['exact_address', 'road_nearest', 'road_anchor', 'unknown'])
    .nullable()
    .optional(),
})
export type Complex = z.infer<typeof Complex>

export const Unit = z.object({
  complexId: z.string(),
  dong: z.string().optional(),
  ho: z.string(),
  unitType: z.string().optional(), // 주택형(매입임대엔 없음)
  rooms: z.number().int().nonnegative(),
  areaM2: z.number().nonnegative(),
})
export type Unit = z.infer<typeof Unit>

export const Pricing = z.object({
  complexId: z.string(),
  unitType: z.string().optional(),
  ho: z.string().optional(), // 매입임대는 호 단위
  qualifier: z.object({
    supplyClass: z.string().optional(), // 공급계층명(행복)
    incomeBand: z.string().optional(), // 소득구간(통합)
    householdSize: z.number().optional(), // 가구인원수(통합)
    protection: z.string().optional(), // 보호구분명(재개발)
  }),
  deposit: z.number().nonnegative(), // 원
  rent: z.number().nonnegative(), // 원/월
  registeredAt: z.string(),
})
export type Pricing = z.infer<typeof Pricing>

/** 어댑터 계약 — 원천 CSV 스키마당 1모듈. 이후 단계는 유형·포맷과 무관하게 공유. */
export interface AdapterResult {
  complexes?: Complex[]
  units?: Unit[]
  pricing?: Pricing[]
  skipped: { row: number; reason: string }[]
}
export type Adapter = (rows: Record<string, string>[]) => AdapterResult

// ── 단지 단위 응답 스키마 (P0-B-3 = P2-C 응답 = P3-B 응답 구조) ────────────────

/** 앱 8태그 id — tagScores 키. */
export const TAG_IDS = [
  'cafe',
  'gym',
  'cvs',
  'culture',
  'quiet',
  'shop',
  'transit',
  'park',
] as const

/**
 * 엔진 φ feature id = 8태그 + 파생축(ONBOARDING_REDESIGN §2-1).
 * - calm = 100 − 인구밀도 백분위(밀집⟷여유 축, `industry_density.P_Val`). POI 재집계 아니라 §2.1 위반 아님.
 * - parking = 단지 주차대수 백분위(2단계 칩).
 * tagScores/weights·complex_tag_scores.tag 키로 공용.
 */
export const FEATURE_IDS = [...TAG_IDS, 'calm', 'parking'] as const
export type FeatureId = (typeof FEATURE_IDS)[number]

export interface GeneratedHousing {
  id: string
  name: string
  type: HousingType
  address: string
  district: string
  dong: string
  lat: number | null
  lng: number | null
  coordinateSource?: string | null
  coordinateAccuracy?:
    'exact_address' | 'road_nearest' | 'road_anchor' | 'unknown' | null
  builtDate: string | null
  totalUnits: number
  elevator: boolean
  parking: number
  area: { min: number; max: number } // m²
  rooms: { min: number; max: number }
  deposit: { min: number; max: number } // 원
  rent: { min: number; max: number } // 원/월
  pricingRows: {
    unitType?: string
    qualifier: string
    deposit: number
    rent: number
  }[]
  score: number | null
  tagScores: Record<string, number | null>
  /** A. 자격·유형 하드컷 태그(유형·공급계층·유형제도규칙). 인제스천이 파생(scripts/ingest/qualifications). */
  qualifications?: string[]
  /** B. 주거물리 태그(난방·복도·설비·부대시설). K-apt 등 신규 소스 파생, 배지·선택적 하드필터용(scripts/ingest/physical-tags). */
  physicalTags?: string[]
  highlight: string | null
  scoreSource: 'placeholder' | 'engine'
}

/** 필터 옵션 메타 — DB distinct 기반(P2-C-2). 준공연도·면적은 의미 버킷이라 프론트 상수. */
export interface FilterMeta {
  types: string[]
  districts: string[]
}

// ── AI 자연어 검색 파싱 계약 (P5) ────────────────────────────────────────────
// 프론트 데모(Gemini 직접 호출)와 백엔드 프록시(POST /api/search/nl)가 공유하는
// 응답 타입. 프롬프트·JSON 스키마는 각 호출부가 보유(런타임 상수는 CJS dist에서
// 프론트 번들이 못 읽음) — 이 타입이 양쪽 결과 shape의 단일 원천이다.

/** 취향학습 원자 8피처 id(기획안 §7.1) — AI 파싱 tags·pairwise 선호벡터 키. tag/ 고정 거리감쇠 산출과 정합. */
export const PREFERENCE_FEATURE_IDS = [
  'rail_access',
  'cafe_choice',
  'fitness_access',
  'supermarket_access',
  'restaurant_choice',
  'culture_access',
  'quiet_residential',
  'park_walk',
] as const

/**
 * 취향을 모르는 사용자에게 AI가 되묻는 한 턴(P5-C-3). 조건은 있으나 취향이 막연할 때만
 * 채운다. 각 보기는 탭하면 그 선택이 뜻하는 취향 tags(위 8피처)를 누적한다.
 */
export interface ParsedFollowup {
  question: string
  options: { label: string; tags?: { id: string; weight: number }[] }[]
}

/** 자유 문장에서 뽑은 검색 조건. 언급 안 된 축은 생략(undefined) → 필터하지 않음. */
export interface ParsedFilter {
  rentType?: string
  depositMax?: number // 만원
  rentMax?: number // 만원
  regions?: string[]
  buildYear?: string
  area?: string
  houseTypes?: string[]
  tags?: { id: string; weight: number }[] // weight 1~3
  unresolved?: string[] // 조건으로 해석 못한 모호·미지원 표현(있으면 UI가 되물음)
  followup?: ParsedFollowup // 취향이 막연할 때 AI가 되물어 끌어내는 질문(있으면 UI가 보기 노출)
  summary: string
}

// ── 집계 규칙 (인제스천 emit·백엔드 API가 동일 규칙 사용) ─────────────────────

export function range(vals: number[]): { min: number; max: number } {
  const f = vals.filter((v) => Number.isFinite(v))
  return f.length
    ? { min: Math.min(...f), max: Math.max(...f) }
    : { min: 0, max: 0 }
}

/** 가격 조건을 사람이 읽는 라벨로 — 상세 '비용' 탭 행 표시용. */
export function qualifierLabel(p: {
  unitType?: string
  ho?: string
  supplyClass?: string
  incomeBand?: string
  householdSize?: number
  protection?: string
}): string {
  const parts: string[] = []
  if (p.unitType) parts.push(p.unitType)
  if (p.supplyClass) parts.push(p.supplyClass)
  if (p.protection) parts.push(p.protection)
  if (p.incomeBand) parts.push(`소득 ${p.incomeBand}`)
  if (p.householdSize != null) parts.push(`${p.householdSize}인`)
  if (!parts.length && p.ho) parts.push(`${p.ho}호`)
  return parts.join(' · ')
}

/**
 * 데모용 단순 휴리스틱 점수(0~100). 상권 GIS 적재(P3) 전 placeholder.
 * 필드 구조는 P3-B 엔진 응답과 동일 — 엔진 완성 시 값만 교체(scoreSource:'engine').
 */
export function placeholderScore(
  builtDate: string | null,
  totalUnits: number,
): number {
  const year = builtDate ? Number(builtDate.slice(0, 4)) : 2000
  const recency = Math.max(0, Math.min(40, year - 1990)) // 1990→0 … 2030→40
  const scale = Math.min(10, Math.round(totalUnits / 120)) // 규모 소폭 가점
  return Math.min(100, Math.round(55 + recency * 0.9 + scale))
}

// ── 취향 온보딩 2단계 계약 (ONBOARDING_REDESIGN) ──────────────────────────────
// 타입 단일 원천. 런타임 레지스트리(축·카드·칩·상수)는 프론트 번들이 CJS dist 런타임
// 값을 못 읽어 frontend/src/onboarding/registry.ts에 둔다(ai.ts TAG_IDS와 동일 관례).

/** 취향 가중 벡터 — Σ=1, 각 feature ≥0.05(비선택 바닥). 온보딩 산출·엔진 입력·슬라이더 공유. */
export type WeightVector = Record<string, number>

/**
 * 1단계 축 — 양극 대립을 feature 강도로 매핑(§2-3-b). 축은 *입력 도구*이고
 * 엔진 φ는 그대로 feature 백분위 — Σw·φ 선형성 유지.
 */
export interface OnboardingAxis {
  id: string
  label: { pos: string; neg: string } // 예: { pos:'활기', neg:'조용' }
  map: {
    pos: Partial<Record<string, number>> // +극 lean 시 가산할 feature→계수
    neg: Partial<Record<string, number>> // −극 lean 시
  }
}

/** 1단계 A/B 카드 — 단일축(민감도) 또는 2축(트레이드오프). φ는 실단지 백분위. */
export interface OnboardingCard {
  id: string
  kind: 'single' | 'tradeoff'
  axes: string[] // 대립 축 id (1~2)
  prompt: string
  options: {
    key: 'A' | 'B'
    label: string
    blurb: string
    phi: Record<string, number> // 축 id → 0~100 백분위(실단지 근거)
  }[]
}

/** 2단계 인프라 칩 — 이산·독립 시설 유무. id는 FeatureId 중 gym|park|transit|parking. */
export interface InfraChip {
  id: string
  label: string
  icon: string
  live: boolean // 데이터 실활성. false(park/transit)=랭킹 무영향, w는 세팅(도착 시 자동 활성)
}

/** 카드 응답 — A/B/비슷해요. */
export type CardAnswer = 'A' | 'B' | 'similar'

/** 프리필 수정 로깅 — 학습 첫 라벨·프리필 정확도 지표(§2-5). 개인 로그는 로컬만. */
export interface OnboardingLog {
  predicted: string[] // 프리필이 ON한 칩
  accepted: string[] // predicted ∩ 최종 ON
  added: string[] // 최종 ON − predicted (카드가 못 잡은 축)
  removed: string[] // predicted − 최종 ON (카드 추정 오류)
}
