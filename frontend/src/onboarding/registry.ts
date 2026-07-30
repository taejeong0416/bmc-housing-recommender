// 취향 온보딩 파생 상수 — feature 전수·바닥값·2단계 인프라 칩(ONBOARDING §2-1).
// 프론트 번들은 @bmc/shared-types의 런타임 const를 못 읽어 FEATURE_IDS를 로컬 재선언
// (api/ai.ts의 TAG_IDS와 동일 관례). 타입은 shared-types가 단일 원천.
import type { InfraChip } from '@bmc/shared-types'

/** 파생 벡터 feature 전수(레거시 태그 투영·프리필 분모용). */
export const FEATURE_IDS = [
  'cafe',
  'gym',
  'cvs',
  'culture',
  'quiet',
  'shop',
  'transit',
  'park',
  'calm',
  'parking',
] as const

export const THETA = 0.05 // 비선택 feature 바닥

/** 2단계 인프라 칩 4개(§2-1). park/transit는 외부데이터 미확보라 live=false. */
export const CHIPS: InfraChip[] = [
  { id: 'gym', label: '헬스장', icon: 'fitness_center', live: true },
  { id: 'parking', label: '주차', icon: 'local_parking', live: true },
  { id: 'park', label: '공원·자연', icon: 'park', live: false },
  { id: 'transit', label: '대중교통', icon: 'directions_bus', live: false },
]
