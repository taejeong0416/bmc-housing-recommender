import { describe, expect, it } from 'vitest'
import housingsJson from '../generated/housings.json'
import type { GeneratedHousing } from '../types'
import {
  createPreferenceModel,
  eligiblePairwiseHousings,
  featureIds,
  learnPreference,
} from './pairwise'
import { createVirtualPair } from './virtualScenarios'

const candidates = eligiblePairwiseHousings(housingsJson as GeneratedHousing[])

describe('실제 데이터 범위에 맞춘 가상 생활권 비교', () => {
  it('첫 세 질문은 서로 다른 시나리오로 취향 범위를 탐색한다', () => {
    const model = createPreferenceModel()
    const pairs = [0, 1, 2].map((round) =>
      createVirtualPair(round, candidates, model),
    )
    expect(pairs.every((pair) => pair.kind === 'coverage')).toBe(true)
    expect(new Set(pairs.map((pair) => pair.id)).size).toBe(3)
  })

  it('네·다섯 번째 질문은 세부 취향을 구분하는 서로 다른 detail 문항이다', () => {
    const model = createPreferenceModel()
    const pairs = [3, 4].map((round) =>
      createVirtualPair(round, candidates, model),
    )
    const detailIds = [
      'detail-rail-vs-mart',
      'detail-dining-vs-culture',
      'detail-cafe-vs-restaurant',
      'detail-fitness-vs-park',
    ]
    expect(pairs.every((pair) => pair.kind === 'detail')).toBe(true)
    expect(pairs.every((pair) => detailIds.includes(pair.id))).toBe(true)
    expect(new Set(pairs.map((pair) => pair.id)).size).toBe(2)
  })

  it('가상 프로필은 생활환경 여덟 축만 사용하고 실제 관측 범위 안에 있다', () => {
    const pair = createVirtualPair(0, candidates, createPreferenceModel())
    for (const profile of [pair.left, pair.right]) {
      expect(Object.keys(profile.vector).sort()).toEqual([...featureIds].sort())
      expect(
        Object.values(profile.vector).every(
          (value) => value >= 0 && value <= 1,
        ),
      ).toBe(true)
    }
    expect(pair.left.vector).not.toEqual(pair.right.vector)
  })

  it('여섯 번째 질문은 앞서 보지 않은 시나리오로 약한 축을 보강한다', () => {
    let model = createPreferenceModel()
    const seen: string[] = []
    for (let round = 0; round < 5; round++) {
      const pair = createVirtualPair(round, candidates, model, seen)
      seen.push(pair.left.id, pair.right.id)
      model = learnPreference(
        model,
        pair.left.vector,
        pair.right.vector,
        'left',
      )
    }
    const adaptive = createVirtualPair(5, candidates, model, seen)
    expect(adaptive.kind).toBe('adaptive')
    expect(
      seen.some((id) => id.includes(adaptive.id.split('-').slice(1).join('-'))),
    ).toBe(false)
  })

  it('저신뢰 사용자용 일곱·여덟 번째 질문도 적응형으로 보강한다', () => {
    const model = createPreferenceModel()
    const seen: string[] = []
    for (let round = 0; round < 6; round++) {
      const pair = createVirtualPair(round, candidates, model, seen)
      seen.push(pair.left.id, pair.right.id)
    }
    const seventh = createVirtualPair(6, candidates, model, seen)
    seen.push(seventh.left.id, seventh.right.id)
    const eighth = createVirtualPair(7, candidates, model, seen)
    expect(seventh.kind).toBe('adaptive')
    expect(eighth.kind).toBe('adaptive')
  })

  it('선택 카드에는 매물의 정량 조건을 노출하지 않는다', () => {
    const pair = createVirtualPair(0, candidates, createPreferenceModel())
    const copy = JSON.stringify({
      prompt: pair.prompt,
      helper: pair.helper,
      left: {
        title: pair.left.title,
        scene: pair.left.scene,
        tags: pair.left.tags,
        tradeoffs: pair.left.tradeoffs,
      },
      right: {
        title: pair.right.title,
        scene: pair.right.scene,
        tags: pair.right.tags,
        tradeoffs: pair.right.tradeoffs,
      },
    })
    for (const forbidden of ['보증금', '임대료', '면적', '준공', '500m']) {
      expect(copy).not.toContain(forbidden)
    }
  })
})
