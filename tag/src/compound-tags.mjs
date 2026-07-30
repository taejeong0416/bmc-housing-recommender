import { resolve } from 'node:path'
import {
  OUTPUT_DIR,
  baseMetadata,
  geometricMean,
  weightedMean,
  writeJson,
} from './lib.mjs'

const THRESHOLD = 0.65
const COMPONENT_FLOOR = 0.55

const COMPOUND_DEFINITIONS = {
  rail_daily: {
    label: '역세권 생활편의',
    components: ['C.rail_access', 'D.daily_essentials'],
    description: '도시철도와 일상 필수시설을 함께 이용하기 좋은 환경',
  },
  active_transit: {
    label: '대중교통형 액티브 라이프',
    components: ['C.rail_access', 'D.fitness_access'],
    description: '도시철도 접근성과 가까운 운동시설을 함께 갖춘 환경',
  },
  transit_quiet: {
    label: '교통도 챙긴 조용한 주거지',
    components: ['C.rail_access', 'D.quiet_residential'],
    description: '이동 편의와 조용한 주거환경의 균형',
  },
  transit_park: {
    label: '역세권 공원생활',
    components: ['C.rail_access', 'D.park_walk'],
    description: '도시철도와 공원 산책 접근성을 함께 갖춘 환경',
  },
  quiet_green: {
    label: '조용한 숲세권',
    components: ['D.quiet_residential', 'D.park_walk'],
    description: '조용함 추정값과 공원 접근성이 모두 높은 환경',
  },
  daily_green: {
    label: '생활편의형 공원생활',
    components: ['D.daily_essentials', 'D.park_walk'],
    description: '일상 편의시설과 공원을 함께 누리기 좋은 환경',
  },
  compact_rail: {
    label: '콤팩트 역세권',
    components: ['B.compact_confirmed', 'C.rail_access'],
    description: '40㎡ 미만이 확인된 소형 주거와 도시철도 접근성의 결합',
  },
  compact_daily: {
    label: '콤팩트 생활편의',
    components: ['B.compact_confirmed', 'D.daily_essentials'],
    description: '40㎡ 미만이 확인된 소형 주거와 일상 편의의 결합',
  },
  recent_quiet: {
    label: '새집에 가까운 조용한 주거',
    components: ['B.recent_confirmed', 'D.quiet_residential'],
    description: '준공 5년 이내와 조용한 주거환경 추정값의 결합',
  },
  culture_transit: {
    label: '대중교통형 문화생활',
    components: ['C.rail_access', 'D.culture_access'],
    description: '도시철도와 문화·여가 시설을 함께 이용하기 좋은 환경',
  },
}

const buildComponentMap = (b, c, d) => {
  const dailyEssentials = weightedMean([
    { value: d?.scores?.supermarket_access, weight: 0.45 },
    { value: d?.scores?.cvs_access, weight: 0.3 },
    { value: d?.scores?.laundry_access, weight: 0.25 },
  ])
  const urbanActivity = weightedMean([
    { value: d?.scores?.cafe_choice, weight: 0.3 },
    { value: d?.scores?.restaurant_choice, weight: 0.35 },
    { value: d?.scores?.nightlife_access, weight: 0.2 },
    { value: d?.scores?.culture_access, weight: 0.15 },
  ])
  const compactConfirmed =
    Number.isFinite(b?.raw?.areaMaxM2) && b.raw.areaMaxM2 < 40 ? 1 : 0
  const recentConfirmed =
    Number.isFinite(b?.raw?.buildingAgeYears) &&
    b.raw.buildingAgeYears >= 0 &&
    b.raw.buildingAgeYears <= 5
      ? 1
      : 0
  return {
    'B.compact_confirmed': compactConfirmed,
    'B.recent_confirmed': recentConfirmed,
    'C.rail_access': c?.scores?.rail_access ?? null,
    'D.daily_essentials': dailyEssentials,
    'D.urban_activity': urbanActivity,
    'D.fitness_access': d?.scores?.fitness_access ?? null,
    'D.quiet_residential': d?.scores?.quiet_residential ?? null,
    'D.park_walk': d?.scores?.park_walk ?? null,
    'D.culture_access': d?.scores?.culture_access ?? null,
  }
}

export const generateCompoundTags = async ({
  a,
  b,
  c,
  d,
  outputPath = resolve(OUTPUT_DIR, 'compound-tags.json'),
} = {}) => {
  const housingIds = [
    ...new Set([
      ...Object.keys(b.features ?? {}),
      ...Object.keys(c.features ?? {}),
      ...Object.keys(d.features ?? {}),
    ]),
  ]
  const features = Object.fromEntries(
    housingIds.map((housingId) => {
      const bFeature = b.features?.[housingId]
      const cFeature = c.features?.[housingId]
      const dFeature = d.features?.[housingId]
      const components = buildComponentMap(bFeature, cFeature, dFeature)
      const compounds = Object.fromEntries(
        Object.entries(COMPOUND_DEFINITIONS).map(([id, definition]) => {
          const values = definition.components.map((key) => components[key])
          const score = geometricMean(values)
          return [
            id,
            {
              score,
              assigned:
                score != null &&
                score >= THRESHOLD &&
                values.every((value) => value >= COMPONENT_FLOOR),
              components: Object.fromEntries(
                definition.components.map((key, index) => [key, values[index]]),
              ),
            },
          ]
        }),
      )
      const audienceContexts = [
        ...new Set(
          (a.features?.[housingId]?.offers ?? []).flatMap(
            (offer) => offer.supplyTargets ?? [],
          ),
        ),
      ]
      return [
        housingId,
        {
          name: bFeature?.name ?? cFeature?.name ?? dFeature?.name ?? null,
          derived: {
            daily_essentials: components['D.daily_essentials'],
            urban_activity: components['D.urban_activity'],
          },
          compounds,
          assignedTags: Object.entries(compounds)
            .filter(([, compound]) => compound.assigned)
            .map(([id]) => id),
          audienceContexts,
          modelRole: 'explanation_only_score_contribution_zero',
        },
      ]
    }),
  )
  const result = {
    metadata: baseMetadata(
      'A_B_C_D_결합태그',
      [
        resolve(OUTPUT_DIR, 'a-qualification-tags.json'),
        resolve(OUTPUT_DIR, 'b-physical-tags.json'),
        resolve(OUTPUT_DIR, 'c-transport-tags.json'),
        resolve(OUTPUT_DIR, 'd-lifestyle-tags.json'),
      ],
      [
        '결합태그는 추천점수를 다시 올리는 변수가 아니라 설명·탐색·카드 카피용이다.',
        '모든 구성값이 있어야 계산하며 누락값을 0으로 대체하지 않는다.',
        'A는 대상 맥락만 제공하고 실제 자격확인 전에는 결합태그 점수에 넣지 않는다.',
        'B의 소형·신축 결합은 단지 범위가 조건을 완전히 만족할 때만 confirmed=1로 둔다.',
      ],
    ),
    threshold: THRESHOLD,
    componentFloor: COMPONENT_FLOOR,
    formula: '구성요소의 기하평균',
    definitions: COMPOUND_DEFINITIONS,
    features,
  }
  await writeJson(outputPath, result)
  return result
}
