// 유효 취향 가중치 = pairwise 추론 + 사용자 직접 보정(§6.5·§7.6).
// 찜 기반 정교화(§12)는 이 위에 별도 계층으로 얹는다(finalPreferenceModel, 후속).
import {
  allPreferenceVectors,
  createPreferenceModel,
  featureIds,
  getListingFeature,
  PREFERENCE_CATEGORIES,
  zeroVector,
  type PreferenceFeatureId,
  type PreferenceModel,
  type PreferenceOverrides,
  type PreferenceVector,
} from './pairwise'

// 진단 화면에서 사용자가 카테고리 방향을 직접 고정하는 3상태.
export type OverrideLevel = 'prefer' | 'auto' | 'avoid'

// 명시적 보정은 추론값보다 큰 강한 신호(§7.6). 6회 학습 가중치(|w|~0.05~0.2)를 확실히 지배한다.
export const OVERRIDE_MAGNITUDE = 0.4

export const overrideWeight = (level: OverrideLevel): number | undefined =>
  level === 'prefer'
    ? OVERRIDE_MAGNITUDE
    : level === 'avoid'
      ? -OVERRIDE_MAGNITUDE
      : undefined

export const hasOverrides = (overrides: PreferenceOverrides): boolean =>
  featureIds.some((id) => overrides[id] !== undefined)

/** 카테고리 소속 feature가 모두 같은 방향으로 고정됐으면 그 방향, 아니면 '자동'. */
export function categoryOverrideLevel(
  overrides: PreferenceOverrides,
  features: readonly PreferenceFeatureId[],
): OverrideLevel {
  const levels = features.map((id) => {
    const w = overrides[id]
    return w === undefined ? 'auto' : w > 0 ? 'prefer' : 'avoid'
  })
  return levels.every((l) => l === levels[0]) ? levels[0] : 'auto'
}

/** 카테고리 방향 직접 설정 — 소속 feature 전부에 override를 부여하거나('자동') 해제한다. */
export function setCategoryOverride(
  overrides: PreferenceOverrides,
  features: readonly PreferenceFeatureId[],
  level: OverrideLevel,
): PreferenceOverrides {
  const next = { ...overrides }
  const w = overrideWeight(level)
  for (const id of features) {
    if (w === undefined) delete next[id]
    else next[id] = w
  }
  return next
}

/**
 * 유효 모델 — 추론 가중치에 사용자 보정을 덮어쓴 것. 랭킹·설명이 소비하는 단일 원천.
 * 보정만 있고 학습이 없어도 랭킹이 작동하도록 comparisons를 1 이상으로 둔다.
 */
export function effectivePreferenceModel(
  model: PreferenceModel | null,
  overrides: PreferenceOverrides,
): PreferenceModel {
  const base = model ?? createPreferenceModel()
  const weights = { ...base.weights }
  let overridden = false
  for (const id of featureIds) {
    const o = overrides[id]
    if (o !== undefined) {
      weights[id] = o
      overridden = true
    }
  }
  return {
    weights,
    comparisons: base.comparisons > 0 ? base.comparisons : overridden ? 1 : 0,
  }
}

// 진단 화면 카테고리 렌더 순서(추론 신호 크기순 정렬은 화면에서 수행).
export const CORRECTION_CATEGORIES = PREFERENCE_CATEGORIES

// ── 찜 기반 취향 정교화(§12) ──────────────────────────────────────────────

/** 찜한 후보 id만 추린다(토글 off 제외). */
export const favoriteIds = (favorites: Record<string, boolean>): string[] =>
  Object.keys(favorites).filter((id) => favorites[id])

/** 생활환경 데이터가 있어 학습에 쓸 수 있는 찜 수. */
export const activeFavoriteCount = (ids: string[]): number =>
  ids.filter((id) => getListingFeature(id) != null).length

/** 찜 개수별 보정 비중 β — 보수적 상한 0.25(§12.4). */
export function betaForFavorites(count: number): number {
  if (count <= 0) return 0
  return Math.min(0.25, count * 0.05)
}

/**
 * 찜 신호(§12.3) = 찜한 후보 feature − 비교 가능 후보 평균. 데이터에 흔한 특성이
 * 취향으로 과대 반영되지 않도록 상대적 차이를 쓴다. 비교 기준(노출집합)은 MVP에서
 * 전체 후보 모집단으로 근사한다. 가격·면적 등 기본조건 축은 feature 공간에 없어 자연 제외.
 */
export function favoriteSignal(ids: string[]): {
  vector: PreferenceVector
  validCount: number
} {
  const favVectors = ids
    .map((id) => getListingFeature(id))
    .filter((f): f is NonNullable<typeof f> => f != null)
    .map((f) => f.values)
  if (!favVectors.length) return { vector: zeroVector(), validCount: 0 }

  const pool = allPreferenceVectors()
  const baseline = zeroVector()
  if (pool.length)
    for (const id of featureIds)
      baseline[id] = pool.reduce((sum, v) => sum + v[id], 0) / pool.length

  const vector = zeroVector()
  for (const id of featureIds)
    vector[id] =
      favVectors.reduce((sum, v) => sum + (v[id] - baseline[id]), 0) /
      favVectors.length
  return { vector, validCount: favVectors.length }
}

/**
 * 최종 모델 = 유효(추론+직접보정) 위에 찜 신호를 β만큼 얹은 것(§12.4).
 * 직접 보정한 feature는 찜이 다시 뒤집지 못하도록 마지막에 override를 재확정한다.
 */
export function finalPreferenceModel(args: {
  model: PreferenceModel | null
  overrides: PreferenceOverrides
  favorites: Record<string, boolean>
  favoriteLearningEnabled: boolean
}): PreferenceModel {
  const base = effectivePreferenceModel(args.model, args.overrides)
  if (!args.favoriteLearningEnabled) return base

  const ids = favoriteIds(args.favorites)
  const { vector, validCount } = favoriteSignal(ids)
  const beta = betaForFavorites(validCount)
  if (beta <= 0) return base

  const weights = { ...base.weights }
  for (const id of featureIds) {
    if (args.overrides[id] !== undefined) continue // 직접 설정 보호(§12.4)
    weights[id] = (1 - beta) * base.weights[id] + beta * vector[id]
  }
  // 찜은 '온보딩 이후' 신호(§12.1) — 온보딩·직접보정으로 이미 취향이 있을 때만 랭킹에
  // 반영한다. 찜만으로 comparisons를 만들어 전체를 학습모드로 뒤집지 않는다.
  return { weights, comparisons: base.comparisons }
}
