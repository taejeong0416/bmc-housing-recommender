import preferenceDataJson from '../generated/preference-features.json'
import type { GeneratedHousing } from '../types'

// 취향학습 8축 = C(입지·교통) rail + D(생활환경) 7종. tag/ 고정 거리감쇠 산출과 정합(기획안 §2).
export const PREFERENCE_FEATURES = [
  { id: 'rail_access', label: '도시철도 접근', icon: 'train' },
  { id: 'cafe_choice', label: '카페 선택지', icon: 'local_cafe' },
  { id: 'fitness_access', label: '운동시설 접근', icon: 'fitness_center' },
  { id: 'supermarket_access', label: '마트 접근', icon: 'shopping_cart' },
  { id: 'restaurant_choice', label: '외식 선택지', icon: 'restaurant' },
  { id: 'culture_access', label: '문화·여가', icon: 'palette' },
  { id: 'quiet_residential', label: '조용한 주거', icon: 'volume_off' },
  { id: 'park_walk', label: '공원 산책', icon: 'park' },
] as const

export type PreferenceFeatureId = (typeof PREFERENCE_FEATURES)[number]['id']
export type PreferenceVector = Record<PreferenceFeatureId, number>
export type PairChoice = 'left' | 'right' | 'tie' | 'reject'

// 사용자가 진단 화면에서 명시적으로 고정한 feature별 가중치. 추론값을 덮어쓰며(§7.6),
// 값이 있는 feature는 모델 재학습·찜 보정이 다시 뒤집지 못한다(§12.4).
export type PreferenceOverrides = Partial<Record<PreferenceFeatureId, number>>

export interface PreferenceModel {
  weights: PreferenceVector
  comparisons: number
}

export interface PreferenceChoiceLog {
  leftId: string
  rightId: string
  choice: PairChoice
}

export interface PreferenceReplayStep {
  left: PreferenceVector
  right: PreferenceVector
  choice: PairChoice
}

export type PreferenceConfidenceLevel = 'clear' | 'developing' | 'low'

export interface PreferenceConfidence {
  level: PreferenceConfidenceLevel
  label: string
  validChoices: number
  scenarioCoverage: number
  nonChoices: number
  needsMore: boolean
}

export const PREFERENCE_CATEGORIES = [
  {
    id: 'transit',
    label: '교통 접근',
    icon: 'directions_transit',
    features: ['rail_access'],
  },
  {
    id: 'lifestyle',
    label: '카페·외식·문화',
    icon: 'interests',
    features: ['cafe_choice', 'restaurant_choice', 'culture_access'],
  },
  {
    id: 'daily',
    label: '운동·장보기',
    icon: 'shopping_basket',
    features: ['fitness_access', 'supermarket_access'],
  },
  {
    id: 'calm',
    label: '조용함·공원',
    icon: 'spa',
    features: ['quiet_residential', 'park_walk'],
  },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  icon: string
  features: readonly PreferenceFeatureId[]
}>

// tag/ 산출 evidence는 8축 균일 구조 — 반경 내 시설 수·최근접 거리/이름.
type FeatureEvidenceItem = {
  count: number
  nearestMeters: number | null
  nearestName: string | null
}
type FeatureEvidence = Record<PreferenceFeatureId, FeatureEvidenceItem>

interface ListingPreferenceFeature {
  values: PreferenceVector
  evidence: FeatureEvidence
}

const preferenceData = preferenceDataJson as unknown as {
  meta: Record<string, unknown>
  features: Record<string, ListingPreferenceFeature>
}

export const preferenceMeta = preferenceData.meta
export const featureIds = PREFERENCE_FEATURES.map((f) => f.id)
export const featureDefinition = Object.fromEntries(
  PREFERENCE_FEATURES.map((f) => [f.id, f]),
) as Record<PreferenceFeatureId, (typeof PREFERENCE_FEATURES)[number]>

export const zeroVector = (): PreferenceVector =>
  Object.fromEntries(featureIds.map((id) => [id, 0])) as PreferenceVector

export const createPreferenceModel = (): PreferenceModel => ({
  weights: zeroVector(),
  comparisons: 0,
})

export const getListingFeature = (
  housingId: string,
): ListingPreferenceFeature | null => preferenceData.features[housingId] ?? null

export const allPreferenceVectors = (): PreferenceVector[] =>
  Object.values(preferenceData.features).map((feature) => feature.values)

export const eligiblePairwiseHousings = (housings: GeneratedHousing[]) =>
  housings.filter(
    (housing) =>
      getListingFeature(housing.id) != null &&
      // 가격 0은 무료가 아니라 원천 결측이다. 비교 카드에서는 판단 교란을 막기 위해 제외한다.
      (housing.rent.max > 0 || housing.deposit.max > 0),
  )

const sigmoid = (v: number) => 1 / (1 + Math.exp(-v))

export function preferenceProbability(
  model: PreferenceModel,
  left: PreferenceVector,
  right: PreferenceVector,
): number {
  return sigmoid(
    featureIds.reduce(
      (sum, id) => sum + model.weights[id] * (left[id] - right[id]),
      0,
    ),
  )
}

/**
 * 한 번의 가상 생활환경 선택으로 개인별 pairwise logistic model을 온라인 업데이트한다.
 * lr은 학습 속도, l2는 5회 같은 소표본에서 한 태그로 과도하게 쏠리는 것을 막는 규제다.
 */
export function learnPreference(
  model: PreferenceModel,
  left: PreferenceVector,
  right: PreferenceVector,
  choice: PairChoice,
  lr = 0.8,
  l2 = 0.015,
): PreferenceModel {
  if (choice === 'tie' || choice === 'reject') return model
  const y = choice === 'left' ? 1 : -1
  const margin = featureIds.reduce(
    (sum, id) => sum + model.weights[id] * (left[id] - right[id]),
    0,
  )
  const likelihoodGradient = y * sigmoid(-y * margin)
  const weights = { ...model.weights }
  for (const id of featureIds) {
    const difference = left[id] - right[id]
    weights[id] =
      model.weights[id] * (1 - lr * l2) + lr * likelihoodGradient * difference
  }
  return { weights, comparisons: model.comparisons + 1 }
}

/** AI 파싱 태그(원자 8피처 id·weight 1~3) → 선호모델. AI 검색도 LIVE 랭킹의 단일 8피처 모델로 흘린다(기획안 §7.1). */
export function preferenceModelFromTags(
  tags: { id: string; weight: number }[],
): PreferenceModel {
  const weights = zeroVector()
  for (const t of tags)
    if (t.id in weights)
      weights[t.id as PreferenceFeatureId] = Math.max(0, t.weight)
  return { weights, comparisons: 1 }
}

/** 이전 응답을 수정할 때 남은 선택만 처음부터 재생해 같은 모델 상태를 복원한다. */
export function replayPreference(
  steps: PreferenceReplayStep[],
): PreferenceModel {
  return steps.reduce(
    (model, step) => learnPreference(model, step.left, step.right, step.choice),
    createPreferenceModel(),
  )
}

export const scenarioIdentity = (id: string) =>
  id.match(/^(?:coverage|detail|adaptive)-(.+)-(?:left|right)$/)?.[1] ?? null

/** 5회 결과가 초기 추천에 충분한지 판단하는 UX용 휴리스틱이다. */
export function preferenceConfidence(
  model: PreferenceModel,
  history: PreferenceChoiceLog[],
): PreferenceConfidence {
  const uniqueScenarios = new Set(
    history
      .map((log) => scenarioIdentity(log.leftId))
      .filter((id): id is string => Boolean(id)),
  ).size
  const nonChoices = history.filter(
    (log) => log.choice === 'tie' || log.choice === 'reject',
  ).length
  const meanSignal =
    featureIds.reduce((sum, id) => sum + Math.abs(model.weights[id]), 0) /
    featureIds.length
  const choicePart = Math.min(1, model.comparisons / 5)
  const coveragePart = Math.min(1, uniqueScenarios / 5)
  const signalPart = Math.min(1, meanSignal / 0.12)
  const score = choicePart * 0.5 + coveragePart * 0.25 + signalPart * 0.25
  const level: PreferenceConfidenceLevel =
    model.comparisons < 3
      ? 'low'
      : model.comparisons >= 4 && score >= 0.72
        ? 'clear'
        : score >= 0.5
          ? 'developing'
          : 'low'
  return {
    level,
    label:
      level === 'clear'
        ? '방향이 비교적 선명해요'
        : level === 'developing'
          ? '초기 방향이 보이기 시작했어요'
          : '아직 선택 신호가 적어요',
    validChoices: model.comparisons,
    scenarioCoverage: uniqueScenarios,
    nonChoices,
    needsMore:
      history.length >= 5 &&
      history.length < 7 &&
      (model.comparisons < 4 || uniqueScenarios < 4 || level === 'low'),
  }
}

export function preferenceCategorySignals(model: PreferenceModel) {
  return PREFERENCE_CATEGORIES.map((category) => {
    const score =
      category.features.reduce((sum, id) => sum + model.weights[id], 0) /
      category.features.length
    return { ...category, score }
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
}

export function candidateTradeoff(
  housingId: string,
  model: PreferenceModel,
): string {
  const feature = getListingFeature(housingId)
  if (!feature) return '생활환경 세부 근거를 추가 확인해 주세요.'
  const mismatch = featureIds
    .map((id) => {
      const weight = model.weights[id]
      const value = feature.values[id]
      return {
        id,
        weight,
        mismatch: weight >= 0 ? weight * (1 - value) : -weight * value,
      }
    })
    .sort((a, b) => b.mismatch - a.mismatch)[0]
  if (!mismatch || mismatch.mismatch < 0.025)
    return '현재 취향에서 두드러지는 생활환경 약점이 적은 후보예요.'
  const label = featureDefinition[mismatch.id].label
  return mismatch.weight >= 0
    ? `${label}: 다른 상위 후보보다 낮을 수 있어요.`
    : `${label}: 이번 선택 방향과 다소 거리가 있을 수 있어요.`
}

/** feature별 근거 문구 — 설명(추천이유)에 붙는 거리·개수 데이터(§8.6). 직선거리로 표기. */
function evidenceText(
  id: PreferenceFeatureId,
  evidence: FeatureEvidence,
): string {
  if (id === 'quiet_residential')
    return '야간업종·생활밀도 기준으로 정온한 편으로 추정'
  const e = evidence[id]
  if (id === 'rail_access')
    return e.nearestName
      ? `가까운 역 ${e.nearestName}${e.nearestMeters != null ? ` 직선 ${e.nearestMeters}m` : ''}`
      : '도시철도 접근'
  const near =
    e.nearestMeters != null ? `, 최근접 직선 ${e.nearestMeters}m` : ''
  const noun = id === 'park_walk' ? '공원' : '시설'
  return `주변 ${noun} ${e.count}곳${near}`
}

/**
 * 추천 이유(§8.6) — 실제 점수 기여도(가중치×feature값)가 가장 큰 선호 방향을 근거와 함께 설명한다.
 * 설명문과 계산 feature가 어긋나지 않도록 랭킹과 동일한 기여도를 사용한다.
 */
export function candidateReason(
  housingId: string,
  model: PreferenceModel,
): string | null {
  const feature = getListingFeature(housingId)
  if (!feature) return null
  const best = featureIds
    .map((id) => ({
      id,
      weight: model.weights[id],
      contribution: model.weights[id] * feature.values[id],
    }))
    .filter((item) => item.weight > 0 && item.contribution > 0.02)
    .sort((a, b) => b.contribution - a.contribution)[0]
  if (!best) return null
  const label = featureDefinition[best.id].label
  return `${label} — ${evidenceText(best.id, feature.evidence)}`
}

export function strongestPreferences(model: PreferenceModel, limit = 4) {
  return featureIds
    .map((id) => ({ ...featureDefinition[id], weight: model.weights[id] }))
    .filter((item) => Math.abs(item.weight) > 0.025)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, limit)
}

// 8축 취향모델 → 레거시 태그(baseTags) 가중치 투영 — MapScreen '내 맞춤 조건' 칩 표시용.
const LEGACY_TAG_OF: Partial<Record<PreferenceFeatureId, string>> = {
  rail_access: 'transit',
  cafe_choice: 'cafe',
  fitness_access: 'gym',
  supermarket_access: 'shop',
  restaurant_choice: 'cvs',
  culture_access: 'culture',
  quiet_residential: 'quiet',
  park_walk: 'park',
}

export function legacyWeightsFromModel(model: PreferenceModel) {
  const legacyIds = [
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
  ]
  const acc = Object.fromEntries(legacyIds.map((id) => [id, 0])) as Record<
    string,
    number
  >
  for (const id of featureIds) {
    const legacy = LEGACY_TAG_OF[id]
    if (legacy) acc[legacy] = Math.max(0, model.weights[id])
  }
  const positive = legacyIds.map((id) => acc[id])
  const sum = positive.reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    legacyIds.map((id, i) => [id, sum > 0 ? positive[i] / sum : 0.1]),
  )
}

// 취향 적합도 절대 점수(기획안 §8.3): Score = Σ|wⱼ|·fitⱼ / Σ|wⱼ| × 100.
// 후보 풀과 무관한 절대값 — 동일 시설구성이면 풀이 바뀌어도 같은 점수(§8.2, 후보 내 백분위 금지).
// 선호(+w)는 값 그대로, 회피(−w)는 반대 방향(1−값). 결측 축은 분자·분모에서 모두 제외.
function preferenceFitScore(
  weights: PreferenceVector,
  values: PreferenceVector,
): number {
  let num = 0
  let den = 0
  for (const id of featureIds) {
    const w = weights[id]
    const v = values[id]
    if (v == null || !Number.isFinite(v)) continue
    const aw = Math.abs(w)
    if (aw === 0) continue
    const fit = w >= 0 ? v : 1 - v
    num += aw * Math.min(1, Math.max(0, fit))
    den += aw
  }
  return den === 0 ? 50 : Math.round((num / den) * 100)
}

export function rankByLearnedPreference(
  housings: GeneratedHousing[],
  model: PreferenceModel | null,
): GeneratedHousing[] {
  if (!model || model.comparisons === 0) return housings
  // 생활환경 점수를 설명할 수 있고 가격정보가 있는 실제 후보만 개인화 추천에 노출한다.
  // 점수는 후보 풀과 무관한 절대 적합도(기획안 §8.3).
  const scored = eligiblePairwiseHousings(housings)
    .map((housing) => {
      const feature = getListingFeature(housing.id)
      return feature
        ? { housing, score: preferenceFitScore(model.weights, feature.values) }
        : null
    })
    .filter((item): item is { housing: GeneratedHousing; score: number } =>
      Boolean(item),
    )
  if (!scored.length) return housings

  const top = strongestPreferences(model, 2)
    .filter((item) => item.weight > 0)
    .map((item) => item.label)
    .join(' · ')

  const ranked = [...scored].sort(
    (a, b) => b.score - a.score || a.housing.id.localeCompare(b.housing.id),
  )

  const rankedCovered = ranked.map(({ housing, score }) => ({
    ...housing,
    score,
    scoreSource: 'engine' as const,
    highlight: top ? `${top} 취향 반영` : '선택 취향 반영',
  }))

  // 생활환경 데이터가 없는 후보는 버리지 않는다(§6.7·§8.3). 원래 점수를 유지한 채
  // 취향순위가 매겨진 후보 뒤에 붙여, 지도·목록에서 사라지지 않게 한다.
  const coveredIds = new Set(scored.map((item) => item.housing.id))
  const uncovered = housings.filter((housing) => !coveredIds.has(housing.id))
  return [...rankedCovered, ...uncovered]
}
