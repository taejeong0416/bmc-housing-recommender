// 취향 온보딩 파생 유틸 — 콜드스타트 균등 벡터 + 레거시 태그 투영(지도 칩 표시용).
// 개인 선호학습 본체는 pairwise.ts(원자 8피처). 여기 유틸은 초기값·칩 표시 보조.
import type { WeightVector } from '@bmc/shared-types'
import { FEATURE_IDS, THETA } from './registry'

export type Leans = Record<string, number>

/** 균등 사전분포(1/N) — 콜드스타트·초기값. */
export function uniformWeights(): WeightVector {
  const N = FEATURE_IDS.length
  return Object.fromEntries(FEATURE_IDS.map((f) => [f, 1 / N]))
}

// 레거시 태그 UI(baseTags 8종) 표시용 — calm/parking은 baseTags에 없어 제외.
const DISPLAY_TAG_IDS = [
  'cafe',
  'gym',
  'cvs',
  'culture',
  'quiet',
  'shop',
  'transit',
  'park',
]

/** w 벡터 → 레거시 selectedTags/tagWeights 투영(MapScreen 칩 표시용). 바닥 초과만, 3구간 버킷. */
export function deriveDisplayTags(w: WeightVector): {
  selectedTags: string[]
  tagWeights: Record<string, number>
} {
  const selectedTags: string[] = []
  const tagWeights: Record<string, number> = {}
  for (const id of DISPLAY_TAG_IDS) {
    const wi = w[id] ?? 0
    if (wi <= THETA + 1e-9) continue // 바닥 = 미선택
    selectedTags.push(id)
    tagWeights[id] = wi > 0.18 ? 3 : wi > 0.11 ? 2 : 1
  }
  return { selectedTags, tagWeights }
}
