// Shared domain types for the whole app. These describe the current mock data
// shapes; P0's canonical schema (complexes/units/pricing) will extend/replace
// them once real data ingestion lands.

export type ScreenId =
  | 'preference'
  | 'home'
  | 'map'
  | 'setup'
  | 'swipe'
  | 'prefill'
  | 'detail'
  | 'favorites'

export interface Tag {
  id: string
  label: string
  icon: string
}

export interface Housing {
  id: string
  score: number
  name: string
  tag: string
  loc: string
  deposit: string
  rent: string
  cafe: number
  gym: number
  cvs: number
  highlight: string
}

export interface HomeMarker {
  id: string // 클릭 시 상세(/housings/:id) 라우팅 대상
  score: number
  lat: number
  lng: number
  top?: boolean // 추천 상위(홈 탭과 동일 집합) — 지도에서 강조 핀으로 표시
}

// P0 인제스천 산출물(generated/housings.json)의 단지 단위 스키마 — 단일 원천은 @bmc/shared-types.
export type { GeneratedHousing, FilterMeta } from '@bmc/shared-types'
import type { WeightVector, OnboardingLog } from '@bmc/shared-types'
import type {
  PreferenceChoiceLog,
  PreferenceModel,
  PreferenceOverrides,
} from './onboarding/pairwise'

// State keys backing a multi-select chip group (SetupScreen.mkToggle).
export type ArrayKey = 'houseTypes' | 'buildingTypes' | 'regions'

// State keys backing a single-value <select> (SetupScreen selDef).
export type SelKey = 'rentType' | 'buildYear' | 'area'

export interface StoreState {
  // 취향 정본 = 연속 w 벡터(Σ=1, 각 ≥0.05). 온보딩 산출·엔진 입력·슬라이더가 공유(불변 ②).
  weights: WeightVector
  onboardingLeans: Record<string, number> | null // 1→2단계 축 lean 브릿지(비영속)
  onboardingLog: OnboardingLog | null // 프리필 수정 로깅(로컬 영속, §2-5)
  preferenceModel: PreferenceModel | null // 가상 생활환경 선택으로 온라인 학습한 개인별 계수
  preferenceHistory: PreferenceChoiceLog[]
  comparisonRounds: number // 보류를 포함해 온보딩에서 본 비교쌍 수
  preferenceOverrides: PreferenceOverrides // 진단 화면 직접 보정 — 추론값을 덮어씀(§6.5·§7.6)
  // 레거시 태그 UI(MapScreen 표시·AiScreen)용 파생 투영 — weights에서 유도.
  selectedTags: string[]
  tagWeights: Record<string, number>
  depositMax: number
  rentMax: number
  regions: string[]
  rentType: string
  buildYear: string
  area: string
  houseTypes: string[]
  buildingTypes: string[]
  elevatorRequired: boolean
  parkingRequired: boolean
  favorites: Record<string, boolean>
  favoriteLearningEnabled: boolean // 찜 기반 취향 정교화 반영 여부(§12.7) — 기본 OFF, 첫 찜 맥락 동의로 켜짐
  medicalPreferred: boolean // 선택형 의료축 — 사용자가 '의료 접근 중요'를 명시하면 랭킹에 medical_daily_access 반영(기본 OFF, 8축 학습과 분리)
  noticeSeen: boolean // 서비스 성격 고지 팝업을 확인했는지(첫 진입 1회)
  learningPromptSeen: boolean // 취향 학습 맥락 물음을 한 번이라도 띄웠는지
  learningPromptOpen: boolean // 취향 학습 동의 모달 표시 상태(비영속)
  advancedOpen: boolean
  advanced: Record<string, string> // 고급 설정 선택값(라벨→값) — 필터 비관여, 세션 보관
}

export type StatePatch =
  Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)

export interface StoreValue {
  state: StoreState
  patch: (update: StatePatch) => void
}
