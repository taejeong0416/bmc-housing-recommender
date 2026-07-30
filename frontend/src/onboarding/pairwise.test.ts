import { describe, expect, it } from 'vitest'
import {
  createPreferenceModel,
  eligiblePairwiseHousings,
  featureIds,
  learnPreference,
  PREFERENCE_CATEGORIES,
  preferenceConfidence,
  preferenceProbability,
  rankByLearnedPreference,
  replayPreference,
  type PreferenceVector,
} from './pairwise'
import housingsJson from '../generated/housings.json'
import type { GeneratedHousing } from '../types'

const vector = (patch: Partial<PreferenceVector> = {}) =>
  Object.fromEntries(
    featureIds.map((id) => [id, patch[id] ?? 0]),
  ) as PreferenceVector

describe('개인별 pairwise 온라인 학습', () => {
  it('왼쪽의 카페 장점을 선택하면 카페 계수가 양수가 된다', () => {
    const left = vector({ cafe_choice: 1 })
    const right = vector({ cafe_choice: 0 })
    const model = learnPreference(createPreferenceModel(), left, right, 'left')
    expect(model.weights.cafe_choice).toBeGreaterThan(0)
    expect(model.comparisons).toBe(1)
    expect(preferenceProbability(model, left, right)).toBeGreaterThan(0.5)
  })

  it('오른쪽을 선택하면 같은 특성의 방향이 반대로 학습된다', () => {
    const left = vector({ park_walk: 1 })
    const right = vector({ park_walk: 0 })
    const model = learnPreference(createPreferenceModel(), left, right, 'right')
    expect(model.weights.park_walk).toBeLessThan(0)
    expect(preferenceProbability(model, left, right)).toBeLessThan(0.5)
  })

  it('학습 벡터는 C/D 8개 원자 특징이다(기획안 §2)', () => {
    expect(featureIds).toEqual([
      'rail_access',
      'cafe_choice',
      'fitness_access',
      'supermarket_access',
      'restaurant_choice',
      'culture_access',
      'quiet_residential',
      'park_walk',
    ])
  })

  it('비슷함과 둘 다 다름은 상대선호 모델을 바꾸지 않는다', () => {
    const model = createPreferenceModel()
    expect(
      learnPreference(model, vector({ fitness_access: 1 }), vector(), 'tie'),
    ).toBe(model)
    expect(
      learnPreference(model, vector({ fitness_access: 1 }), vector(), 'reject'),
    ).toBe(model)
  })

  it('이전 질문으로 돌아가면 취소한 응답을 제외한 모델을 복원한다', () => {
    const first = {
      left: vector({ cafe_choice: 1 }),
      right: vector(),
      choice: 'left' as const,
    }
    const second = {
      left: vector({ fitness_access: 1 }),
      right: vector(),
      choice: 'right' as const,
    }
    const afterFirst = replayPreference([first])
    const afterTwo = replayPreference([first, second])
    const rolledBack = replayPreference([first, second].slice(0, -1))

    expect(afterTwo.comparisons).toBe(2)
    expect(rolledBack).toEqual(afterFirst)
    expect(rolledBack.comparisons).toBe(1)
  })

  it('학습 후에도 전체 후보를 보존하되 커버 후보를 상단에 둔다(§6.7·§8.3)', () => {
    // 부산 전역 실데이터는 전 후보가 GIS 커버라 미커버가 없다. 분리 로직 자체를
    // 검증하려면 preference-features에 없는 id의 합성 미커버 후보를 하나 주입한다.
    const syntheticUncovered = {
      ...(housingsJson as GeneratedHousing[])[0],
      id: 'synthetic-uncovered',
    } as GeneratedHousing
    const housings = [
      ...(housingsJson as GeneratedHousing[]),
      syntheticUncovered,
    ]
    const model = learnPreference(
      createPreferenceModel(),
      vector({ cafe_choice: 1 }),
      vector(),
      'left',
    )
    const ranked = rankByLearnedPreference(housings, model)
    // 미커버 후보를 버리지 않아 지도·목록이 쪼그라들지 않는다.
    expect(ranked).toHaveLength(housings.length)
    const covered = ranked.filter((h) => h.scoreSource === 'engine')
    const uncovered = ranked.filter((h) => h.scoreSource !== 'engine')
    expect(covered).toHaveLength(eligiblePairwiseHousings(housings).length)
    expect(uncovered.length).toBeGreaterThan(0)
    // 취향 점수가 매겨진(engine) 후보가 미커버보다 모두 앞에 온다.
    const isEngine = ranked.map((h) => h.scoreSource === 'engine')
    expect(isEngine.lastIndexOf(true)).toBeLessThan(isEngine.indexOf(false))
    // 커버 후보의 취향적합 점수(§8.3)는 0~100 범위다.
    expect(Math.max(...covered.map((h) => h.score ?? 0))).toBeLessThanOrEqual(
      100,
    )
    expect(
      Math.min(...covered.map((h) => h.score ?? 0)),
    ).toBeGreaterThanOrEqual(0)
  })

  it('개인화 추천은 커버 후보를 취향적합 점수가 높은 순으로 정렬한다', () => {
    const housings = housingsJson as GeneratedHousing[]
    const model = {
      weights: vector({ cafe_choice: 0.7, quiet_residential: -0.3 }),
      comparisons: 6,
    }
    const covered = rankByLearnedPreference(housings, model).filter(
      (h) => h.scoreSource === 'engine',
    )
    // 절대 취향적합 점수(§8.3) 내림차순 — 상단일수록 취향에 더 맞는다.
    const scores = covered.map((h) => h.score ?? 0)
    expect(
      scores.every((score, index) => index === 0 || scores[index - 1] >= score),
    ).toBe(true)
    expect(scores[0]).toBe(Math.max(...scores))
  })

  it('서로 반대되는 생활성향은 실제 상위 추천을 다르게 만든다', () => {
    const housings = housingsJson as GeneratedHousing[]
    const activeUrban = {
      weights: vector({
        rail_access: 0.3,
        cafe_choice: 0.2,
        fitness_access: 0.3,
        restaurant_choice: 0.2,
        quiet_residential: -0.3,
        park_walk: -0.2,
      }),
      comparisons: 6,
    }
    const quietGreen = {
      weights: vector({
        rail_access: -0.2,
        cafe_choice: -0.1,
        culture_access: 0.1,
        quiet_residential: 0.3,
        park_walk: 0.3,
      }),
      comparisons: 6,
    }
    const activeTop = rankByLearnedPreference(housings, activeUrban)
      .filter((h) => h.scoreSource === 'engine')
      .slice(0, 3)
      .map((housing) => housing.id)
    const quietTop = rankByLearnedPreference(housings, quietGreen)
      .filter((h) => h.scoreSource === 'engine')
      .slice(0, 3)
      .map((housing) => housing.id)

    expect(activeTop).not.toEqual(quietTop)
    expect(activeTop[0]).not.toBe(quietTop[0])
  })

  it('설명 카테고리는 여덟 feature를 중복 없이 한 번씩 묶는다', () => {
    expect(
      PREFERENCE_CATEGORIES.flatMap((category) => category.features).sort(),
    ).toEqual([...featureIds].sort())
  })

  it('신뢰도는 유효 선택, 서로 다른 시나리오 범위, 선택 신호로 판단한다', () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      leftId: `coverage-test-${index}-left`,
      rightId: `coverage-test-${index}-right`,
      choice: 'left' as const,
    }))
    const confidence = preferenceConfidence(
      { weights: vector({ cafe_choice: 0.2 }), comparisons: 6 },
      history,
    )
    expect(confidence.validChoices).toBe(6)
    expect(confidence.scenarioCoverage).toBe(6)
    expect(confidence.nonChoices).toBe(0)
    expect(confidence.needsMore).toBe(false)
  })

  it('유효 선택이 적으면 선택형 추가 비교가 필요하다', () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      leftId: `coverage-test-${index}-left`,
      rightId: `coverage-test-${index}-right`,
      choice: 'tie' as const,
    }))
    const confidence = preferenceConfidence(createPreferenceModel(), history)
    expect(confidence.level).toBe('low')
    expect(confidence.needsMore).toBe(true)
  })
})
