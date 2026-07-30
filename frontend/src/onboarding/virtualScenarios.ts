import type { GeneratedHousing } from '../types'
import {
  allPreferenceVectors,
  featureDefinition,
  featureIds,
  getListingFeature,
  scenarioIdentity,
  type PreferenceChoiceLog,
  type PreferenceFeatureId,
  type PreferenceModel,
  type PreferenceVector,
} from './pairwise'

export type VirtualPairKind = 'coverage' | 'detail' | 'adaptive'

// 카드 대표 이미지 테마(기획안 §4.2) — 취향 8축을 대표하는 생활장면. 프로필의 지배 축에
// 맞춰 하나씩 얹으며, 한 쌍(A·B)은 서로 다른 테마를 써서 이미지로도 구분되게 한다(§4.4).
// 파일은 public/onboarding/. cafe·culture 사진은 준비 대상(없으면 텍스트 헤더로 대체).
export type SceneTheme =
  | 'dining'
  | 'cafe'
  | 'culture'
  | 'fitness'
  | 'park'
  | 'transit'
  | 'calm'
  | 'mart'

export interface VirtualTag {
  icon: string
  label: string
}

export interface VirtualProfile {
  id: string
  title: string
  scene: string
  icon: string
  theme?: SceneTheme
  tags: VirtualTag[]
  tradeoffs: VirtualTag[]
  vector: PreferenceVector
}

export interface VirtualPair {
  id: string
  kind: VirtualPairKind
  prompt: string
  helper: string
  targetFeatures: PreferenceFeatureId[]
  left: VirtualProfile
  right: VirtualProfile
}

type ProfileCopy = Omit<VirtualProfile, 'id' | 'vector'>

interface ScenarioTemplate {
  id: string
  phase: 'broad' | 'detail'
  targetFeatures: PreferenceFeatureId[]
  leftLevels: Partial<Record<PreferenceFeatureId, 'high' | 'low'>>
  rightLevels: Partial<Record<PreferenceFeatureId, 'high' | 'low'>>
  prompt: string
  left: ProfileCopy
  right: ProfileCopy
}

// 가상 매물 비교 시나리오(기획안 §3~§6). 8개 취향축을 네 상위 카테고리로 묶는다.
//   G1 이동·생활편의  = rail_access, supermarket_access
//   G2 도시활동·사교  = cafe_choice, restaurant_choice, culture_access
//   G3 건강·야외활동  = fitness_access, park_walk
//   G4 정온·휴식      = quiet_residential
// broad(§5) = 카테고리 사이 비교로 큰 취향 방향을 잡는다(기본 5회의 앞 구간).
// detail(§5 Q5·§6) = 한 카테고리 안에서 세부축을 나눈다(다중축 카테고리에만 존재, G4 제외).
const SCENARIOS: ScenarioTemplate[] = [
  // ── broad: 카테고리 사이 비교(§5) ──────────────────────────────────────
  {
    // G2 도시활동·사교 대 G4 정온·휴식 (§5 Q1)
    id: 'social-vs-quiet',
    phase: 'broad',
    targetFeatures: [
      'cafe_choice',
      'restaurant_choice',
      'culture_access',
      'quiet_residential',
    ],
    leftLevels: {
      cafe_choice: 'high',
      restaurant_choice: 'high',
      culture_access: 'high',
      quiet_residential: 'low',
    },
    rightLevels: {
      cafe_choice: 'low',
      restaurant_choice: 'low',
      culture_access: 'low',
      quiet_residential: 'high',
    },
    prompt: '주말을 동네에서 즐기기와 조용히 충전하기 중 무엇이 더 좋나요?',
    left: {
      title: '카페·문화를 가까이 누리는 도심 생활',
      scene: '집을 나서면 카페와 음식점, 문화공간이 이어지는 동네예요.',
      icon: 'interests',
      theme: 'dining',
      tags: [
        { icon: 'local_cafe', label: '카페 선택지' },
        { icon: 'restaurant', label: '외식 선택지' },
        { icon: 'palette', label: '문화·여가 접근' },
      ],
      tradeoffs: [
        { icon: 'volume_up', label: '저녁에도 주변 활기가 이어질 수 있어요' },
      ],
    },
    right: {
      title: '차분한 골목에서 충전하는 생활',
      scene: '자극이 적고 조용해 집에서 편히 쉬기 좋은 동네예요.',
      icon: 'spa',
      theme: 'calm',
      tags: [
        { icon: 'volume_off', label: '조용한 주거환경' },
        { icon: 'self_improvement', label: '집 중심 휴식' },
      ],
      tradeoffs: [
        {
          icon: 'directions_transit',
          label: '여가는 다른 생활권으로 이동해야 해요',
        },
      ],
    },
  },
  {
    // G1 이동·생활편의 대 G3 건강·야외활동 (§5 Q2)
    id: 'mobility-vs-outdoor',
    phase: 'broad',
    targetFeatures: [
      'rail_access',
      'supermarket_access',
      'fitness_access',
      'park_walk',
    ],
    leftLevels: {
      rail_access: 'high',
      supermarket_access: 'high',
      fitness_access: 'low',
      park_walk: 'low',
    },
    rightLevels: {
      rail_access: 'low',
      supermarket_access: 'low',
      fitness_access: 'high',
      park_walk: 'high',
    },
    prompt: '평일의 편리한 이동과 가까운 운동·산책 중 어느 쪽이 더 중요한가요?',
    left: {
      title: '역과 장보기가 가까워 일상이 간결한 생활',
      scene: '역과 마트가 가까워 이동과 생필품 해결이 편한 동네예요.',
      icon: 'directions_transit',
      theme: 'transit',
      tags: [
        { icon: 'train', label: '역세권·철도 접근' },
        { icon: 'shopping_cart', label: '장보기 편의' },
      ],
      tradeoffs: [
        { icon: 'fitness_center', label: '운동·녹지 선택지는 적을 수 있어요' },
      ],
    },
    right: {
      title: '운동과 산책을 일상으로 만드는 생활',
      scene: '운동시설과 공원이 가까워 몸을 움직이기 좋은 동네예요.',
      icon: 'directions_run',
      theme: 'park',
      tags: [
        { icon: 'fitness_center', label: '운동시설 접근' },
        { icon: 'park', label: '공원·산책 접근' },
      ],
      tradeoffs: [
        { icon: 'train', label: '역·장보기 동선이 길어질 수 있어요' },
      ],
    },
  },
  {
    // G1 이동·생활편의 대 G2 도시활동·사교
    id: 'mobility-vs-social',
    phase: 'broad',
    targetFeatures: [
      'rail_access',
      'supermarket_access',
      'cafe_choice',
      'restaurant_choice',
      'culture_access',
    ],
    leftLevels: {
      rail_access: 'high',
      supermarket_access: 'high',
      cafe_choice: 'low',
      restaurant_choice: 'low',
      culture_access: 'low',
    },
    rightLevels: {
      rail_access: 'low',
      supermarket_access: 'low',
      cafe_choice: 'high',
      restaurant_choice: 'high',
      culture_access: 'high',
    },
    prompt:
      '이동이 편한 생활과 동네 여가가 풍부한 생활 중 어느 쪽이 더 끌리나요?',
    left: {
      title: '이동과 생필품 해결이 간편한 생활',
      scene: '역과 마트가 가까워 하루 동선이 짧은 동네예요.',
      icon: 'directions_transit',
      theme: 'transit',
      tags: [
        { icon: 'train', label: '역세권·철도 접근' },
        { icon: 'shopping_cart', label: '장보기 편의' },
      ],
      tradeoffs: [
        { icon: 'local_cafe', label: '카페·문화 선택지는 거리가 있어요' },
      ],
    },
    right: {
      title: '카페·외식·문화가 가까운 생활',
      scene: '카페와 음식점, 문화공간을 가까이 즐기기 좋은 동네예요.',
      icon: 'interests',
      theme: 'dining',
      tags: [
        { icon: 'local_cafe', label: '카페 선택지' },
        { icon: 'restaurant', label: '외식 선택지' },
        { icon: 'palette', label: '문화·여가 접근' },
      ],
      tradeoffs: [
        { icon: 'train', label: '역·장보기 동선이 조금 길 수 있어요' },
      ],
    },
  },
  {
    // G3 건강·야외활동 대 G4 정온·휴식
    id: 'outdoor-vs-quiet',
    phase: 'broad',
    targetFeatures: ['fitness_access', 'park_walk', 'quiet_residential'],
    leftLevels: {
      fitness_access: 'high',
      park_walk: 'high',
      quiet_residential: 'low',
    },
    rightLevels: {
      fitness_access: 'low',
      park_walk: 'low',
      quiet_residential: 'high',
    },
    prompt: '몸을 움직이는 야외활동과 자극이 적은 휴식 중 무엇을 더 원하나요?',
    left: {
      title: '운동과 공원 산책이 가까운 생활',
      scene: '운동시설과 공원이 가까워 활동적으로 지내기 좋은 동네예요.',
      icon: 'directions_run',
      theme: 'fitness',
      tags: [
        { icon: 'fitness_center', label: '운동시설 접근' },
        { icon: 'park', label: '공원·산책 접근' },
      ],
      tradeoffs: [
        { icon: 'volume_up', label: '주변이 늘 조용하진 않을 수 있어요' },
      ],
    },
    right: {
      title: '조용한 주거에서 쉬어가는 생활',
      scene: '생활밀도가 낮아 집에서 편히 쉬기 좋은 동네예요.',
      icon: 'spa',
      theme: 'calm',
      tags: [
        { icon: 'volume_off', label: '조용한 주거환경' },
        { icon: 'self_improvement', label: '집 중심 휴식' },
      ],
      tradeoffs: [
        {
          icon: 'directions_walk',
          label: '운동·산책은 이동이 필요할 수 있어요',
        },
      ],
    },
  },
  {
    // G1 이동·생활편의 대 G4 정온·휴식
    id: 'mobility-vs-quiet',
    phase: 'broad',
    targetFeatures: ['rail_access', 'supermarket_access', 'quiet_residential'],
    leftLevels: {
      rail_access: 'high',
      supermarket_access: 'high',
      quiet_residential: 'low',
    },
    rightLevels: {
      rail_access: 'low',
      supermarket_access: 'low',
      quiet_residential: 'high',
    },
    prompt:
      '이동과 장보기가 편한 생활과 조용한 주거환경 중 어느 쪽이 더 끌리나요?',
    left: {
      title: '역과 마트가 가까워 생활이 편리한 동네',
      scene: '역과 마트가 가까워 오가기 편한 생활권이에요.',
      icon: 'directions_transit',
      // 역·마트 근접 생활권 — 장보기 편의를 강조하므로 마트 장면 사진을 얹어
      // 다른 역세권(transit) 프로필과 대표 사진이 겹치지 않게 한다.
      theme: 'mart',
      tags: [
        { icon: 'train', label: '역세권·철도 접근' },
        { icon: 'shopping_cart', label: '장보기 편의' },
      ],
      tradeoffs: [
        { icon: 'volume_up', label: '번화한 만큼 조용하진 않을 수 있어요' },
      ],
    },
    right: {
      title: '한적하고 조용한 주거 중심 동네',
      scene: '생활밀도가 낮아 차분하게 지내기 좋은 동네예요.',
      icon: 'volume_off',
      theme: 'calm',
      tags: [
        { icon: 'volume_off', label: '조용한 주거환경' },
        { icon: 'weekend', label: '낮은 생활밀도' },
      ],
      tradeoffs: [
        {
          icon: 'directions_transit',
          label: '역·마트까지 거리가 있을 수 있어요',
        },
      ],
    },
  },
  {
    // G2 도시활동·사교 대 G3 건강·야외활동
    id: 'social-vs-outdoor',
    phase: 'broad',
    targetFeatures: [
      'cafe_choice',
      'restaurant_choice',
      'culture_access',
      'fitness_access',
      'park_walk',
    ],
    leftLevels: {
      cafe_choice: 'high',
      restaurant_choice: 'high',
      culture_access: 'high',
      fitness_access: 'low',
      park_walk: 'low',
    },
    rightLevels: {
      cafe_choice: 'low',
      restaurant_choice: 'low',
      culture_access: 'low',
      fitness_access: 'high',
      park_walk: 'high',
    },
    prompt:
      '카페·외식·문화가 있는 동네와 운동·공원이 가까운 동네 중 어디가 좋나요?',
    left: {
      title: '카페·외식·문화를 즐기는 생활',
      scene: '카페와 음식점, 문화공간이 가까워 여가가 풍부한 동네예요.',
      icon: 'interests',
      theme: 'dining',
      tags: [
        { icon: 'local_cafe', label: '카페 선택지' },
        { icon: 'restaurant', label: '외식 선택지' },
        { icon: 'palette', label: '문화·여가 접근' },
      ],
      tradeoffs: [{ icon: 'park', label: '운동·녹지는 가깝지 않을 수 있어요' }],
    },
    right: {
      title: '운동과 공원 산책이 일상인 생활',
      scene: '운동시설과 공원이 가까워 야외활동을 이어가기 좋은 동네예요.',
      icon: 'directions_run',
      theme: 'park',
      tags: [
        { icon: 'fitness_center', label: '운동시설 접근' },
        { icon: 'park', label: '공원·산책 접근' },
      ],
      tradeoffs: [
        { icon: 'local_cafe', label: '카페·문화 선택지는 적을 수 있어요' },
      ],
    },
  },
  // ── detail: 카테고리 안 세부축 비교(§5 Q5·§6) ─────────────────────────
  {
    // G1 세부: 역세권 대 장보기
    id: 'rail-vs-mart',
    phase: 'detail',
    targetFeatures: ['rail_access', 'supermarket_access'],
    leftLevels: { rail_access: 'high', supermarket_access: 'low' },
    rightLevels: { rail_access: 'low', supermarket_access: 'high' },
    prompt: '역세권 이동과 장보기 편의 중 무엇을 더 우선하고 싶나요?',
    left: {
      title: '역이 가까워 이동이 빠른 생활',
      scene: '도시철도역이 가까워 어디로든 나서기 편한 동네예요.',
      icon: 'train',
      theme: 'transit',
      tags: [
        { icon: 'train', label: '역세권·철도 접근' },
        { icon: 'schedule', label: '짧은 통근' },
      ],
      tradeoffs: [{ icon: 'shopping_cart', label: '마트까지는 거리가 있어요' }],
    },
    right: {
      title: '마트가 가까워 장보기가 편한 생활',
      scene: '마트가 가까워 장보기와 생필품 구매가 가벼운 동네예요.',
      icon: 'shopping_cart',
      theme: 'mart',
      tags: [
        { icon: 'shopping_cart', label: '장보기 편의' },
        { icon: 'shopping_basket', label: '가벼운 장보기 동선' },
      ],
      tradeoffs: [{ icon: 'train', label: '역까지는 도보 거리가 있어요' }],
    },
  },
  {
    // G2 세부: 카페+외식 대 문화 (§5 도시활동·사교 후속 처리)
    id: 'dining-vs-culture',
    phase: 'detail',
    targetFeatures: ['cafe_choice', 'restaurant_choice', 'culture_access'],
    leftLevels: {
      cafe_choice: 'high',
      restaurant_choice: 'high',
      culture_access: 'low',
    },
    rightLevels: {
      cafe_choice: 'low',
      restaurant_choice: 'low',
      culture_access: 'high',
    },
    prompt:
      '카페·외식이 풍부한 생활과 문화·여가가 가까운 생활 중 어느 쪽이 좋나요?',
    left: {
      title: '카페와 맛집이 가까운 생활',
      scene: '카페와 음식점이 많아 먹고 마시기 좋은 동네예요.',
      icon: 'restaurant',
      theme: 'dining',
      tags: [
        { icon: 'local_cafe', label: '카페 선택지' },
        { icon: 'restaurant', label: '외식 선택지' },
      ],
      tradeoffs: [
        { icon: 'palette', label: '문화·전시 공간은 이동이 필요해요' },
      ],
    },
    right: {
      title: '문화·여가를 가까이 누리는 생활',
      scene: '문화시설과 여가공간이 가까워 취향을 채우기 좋은 동네예요.',
      icon: 'palette',
      theme: 'culture',
      tags: [
        { icon: 'palette', label: '문화·여가 접근' },
        { icon: 'auto_awesome', label: '취향 발견 산책' },
      ],
      tradeoffs: [
        { icon: 'restaurant', label: '카페·외식 밀집도는 낮은 편이에요' },
      ],
    },
  },
  {
    // G2 세부: 카페 대 외식 (§6 Q6)
    id: 'cafe-vs-restaurant',
    phase: 'detail',
    targetFeatures: ['cafe_choice', 'restaurant_choice'],
    leftLevels: { cafe_choice: 'high', restaurant_choice: 'low' },
    rightLevels: { cafe_choice: 'low', restaurant_choice: 'high' },
    prompt: '카페에서 머무는 시간과 다양한 외식 선택지 중 무엇이 더 끌리나요?',
    left: {
      title: '카페가 많아 머물기 좋은 생활',
      scene: '카페가 많아 앉아서 시간을 보내기 좋은 동네예요.',
      icon: 'local_cafe',
      theme: 'cafe',
      tags: [
        { icon: 'local_cafe', label: '카페 선택지' },
        { icon: 'self_improvement', label: '머무는 여가' },
      ],
      tradeoffs: [
        { icon: 'restaurant', label: '외식 선택지는 상대적으로 적어요' },
      ],
    },
    right: {
      title: '외식 선택지가 다양한 생활',
      scene: '음식점이 많아 다양하게 사먹기 좋은 동네예요.',
      icon: 'restaurant',
      theme: 'dining',
      tags: [
        { icon: 'restaurant', label: '외식 선택지' },
        { icon: 'ramen_dining', label: '다양한 먹거리' },
      ],
      tradeoffs: [{ icon: 'local_cafe', label: '카페 밀집도는 낮은 편이에요' }],
    },
  },
  {
    // G3 세부: 운동시설 대 공원·산책
    id: 'fitness-vs-park',
    phase: 'detail',
    targetFeatures: ['fitness_access', 'park_walk'],
    leftLevels: { fitness_access: 'high', park_walk: 'low' },
    rightLevels: { fitness_access: 'low', park_walk: 'high' },
    prompt: '실내 운동시설과 공원·산책 환경 중 무엇을 더 가까이 두고 싶나요?',
    left: {
      title: '운동시설이 가까워 꾸준히 움직이는 생활',
      scene: '헬스·체육시설이 가까워 운동을 이어가기 좋은 동네예요.',
      icon: 'fitness_center',
      theme: 'fitness',
      tags: [
        { icon: 'fitness_center', label: '운동시설 접근' },
        { icon: 'schedule', label: '짧은 운동 동선' },
      ],
      tradeoffs: [{ icon: 'park', label: '가까운 공원·녹지는 적을 수 있어요' }],
    },
    right: {
      title: '공원 산책이 일상인 생활',
      scene: '공원이 가까워 산책과 바깥 시간을 누리기 좋은 동네예요.',
      icon: 'park',
      theme: 'park',
      tags: [
        { icon: 'park', label: '공원·산책 접근' },
        { icon: 'directions_walk', label: '걷기 좋은 동네' },
      ],
      tradeoffs: [
        { icon: 'fitness_center', label: '실내 운동시설은 이동이 필요해요' },
      ],
    },
  },
]

type Distribution = Record<
  PreferenceFeatureId,
  { low: number; median: number; high: number; spread: number }
>

const quantile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0.5
  const index = (sorted.length - 1) * q
  const lower = Math.floor(index)
  const fraction = index - lower
  return sorted[lower] + (sorted[lower + 1] - sorted[lower] || 0) * fraction
}

const distributionFrom = (candidates: GeneratedHousing[]): Distribution => {
  const local = candidates
    .map((housing) => getListingFeature(housing.id)?.values)
    .filter((vector): vector is PreferenceVector => Boolean(vector))
  const global = allPreferenceVectors()

  return Object.fromEntries(
    featureIds.map((id) => {
      const localValues = local.map((vector) => vector[id])
      const globalValues = global.map((vector) => vector[id])
      const source = localValues.length >= 2 ? localValues : globalValues
      let low = quantile(source, 0.2)
      let high = quantile(source, 0.8)
      let median = quantile(source, 0.5)
      // 지나치게 좁은 필터에서는 수영구 전체의 관측 범위로만 보완한다.
      if (high - low < 0.04 && globalValues.length) {
        low = quantile(globalValues, 0.2)
        high = quantile(globalValues, 0.8)
        median = quantile(globalValues, 0.5)
      }
      return [id, { low, median, high, spread: Math.max(0, high - low) }]
    }),
  ) as Distribution
}

const informationScore = (
  template: ScenarioTemplate,
  distribution: Distribution,
) =>
  template.targetFeatures.reduce(
    (sum, id) => sum + distribution[id].spread,
    0,
  ) / template.targetFeatures.length

const templatesByInformation = (
  templates: ScenarioTemplate[],
  distribution: Distribution,
) =>
  [...templates].sort((a, b) => {
    const scoreGap =
      informationScore(b, distribution) - informationScore(a, distribution)
    return scoreGap || a.id.localeCompare(b.id)
  })

const vectorFor = (
  levels: ScenarioTemplate['leftLevels'],
  distribution: Distribution,
): PreferenceVector =>
  Object.fromEntries(
    featureIds.map((id) => [
      id,
      levels[id] ? distribution[id][levels[id]!] : distribution[id].median,
    ]),
  ) as PreferenceVector

const makePair = (
  template: ScenarioTemplate,
  distribution: Distribution,
  kind: VirtualPairKind,
): VirtualPair => {
  const left = {
    ...template.left,
    id: `${kind}-${template.id}-left`,
    vector: vectorFor(template.leftLevels, distribution),
  }
  const right = {
    ...template.right,
    id: `${kind}-${template.id}-right`,
    vector: vectorFor(template.rightLevels, distribution),
  }
  return {
    id: `${kind}-${template.id}`,
    kind,
    prompt: template.prompt,
    helper:
      kind === 'coverage'
        ? '서로 다른 생활방식을 비교해 취향의 큰 방향을 찾고 있어요.'
        : kind === 'detail'
          ? '비슷한 생활가치 안에서 무엇을 더 우선하는지 구분해요.'
          : '앞선 선택에서 아직 애매한 취향을 한 번 더 살펴봐요.',
    targetFeatures: template.targetFeatures,
    left,
    right,
  }
}

export function createVirtualPair(
  round: number,
  candidates: GeneratedHousing[],
  model: PreferenceModel,
  seenProfileIds: string[] = [],
): VirtualPair {
  const distribution = distributionFrom(candidates)
  const broad = templatesByInformation(
    SCENARIOS.filter((template) => template.phase === 'broad'),
    distribution,
  )
  const detail = templatesByInformation(
    SCENARIOS.filter((template) => template.phase === 'detail'),
    distribution,
  )

  if (round < 3) return makePair(broad[round], distribution, 'coverage')

  if (round < 5) return makePair(detail[round - 3], distribution, 'detail')

  const adaptiveScore = (template: ScenarioTemplate) => {
    const uncertainty =
      template.targetFeatures.reduce(
        (sum, id) => sum + 1 / (0.15 + Math.abs(model.weights[id])),
        0,
      ) / template.targetFeatures.length
    return informationScore(template, distribution) * uncertainty
  }
  const adaptiveTemplates = templatesByInformation(
    SCENARIOS,
    distribution,
  ).sort(
    (a, b) => adaptiveScore(b) - adaptiveScore(a) || a.id.localeCompare(b.id),
  )

  // 저신뢰 사용자용 선택형 추가 질문(핵심 5문항 이후)은 이미 본 시나리오를 우선 피한다.
  const seenScenarios = new Set(
    seenProfileIds
      .map((id) => scenarioIdentity(id))
      .filter((id): id is string => Boolean(id)),
  )
  const adaptive =
    adaptiveTemplates.find((template) => !seenScenarios.has(template.id)) ??
    adaptiveTemplates[(round - 5) % adaptiveTemplates.length]
  return makePair(adaptive, distribution, 'adaptive')
}

export const virtualScenarioCount = SCENARIOS.length

const SCENARIO_BY_ID = new Map(
  SCENARIOS.map((template) => [template.id, template]),
)

export interface ChoiceTally {
  id: PreferenceFeatureId
  label: string
  icon: string
  count: number
}

/**
 * 온보딩 A/B 선택에서 사용자가 고른 쪽이 강조한 취향을 집계한다(예: 공원 산책 4회 선택).
 * 무승부·둘 다 거절은 어느 쪽도 고르지 않았으므로 세지 않는다.
 */
export function tallyChoiceFeatures(
  history: PreferenceChoiceLog[],
): ChoiceTally[] {
  const counts = new Map<PreferenceFeatureId, number>()
  for (const log of history) {
    const template = SCENARIO_BY_ID.get(scenarioIdentity(log.leftId) ?? '')
    if (!template) continue
    const levels =
      log.choice === 'left'
        ? template.leftLevels
        : log.choice === 'right'
          ? template.rightLevels
          : null
    if (!levels) continue
    for (const id of Object.keys(levels) as PreferenceFeatureId[]) {
      if (levels[id] === 'high') counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: featureDefinition[id].label,
      icon: featureDefinition[id].icon,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}
