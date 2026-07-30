import { describe, expect, it } from 'vitest'
import preferenceData from '../generated/preference-features.json'
import { createPreferenceModel, type PreferenceModel } from './pairwise'
import {
  betaForFavorites,
  effectivePreferenceModel,
  favoriteSignal,
  finalPreferenceModel,
} from './refine'

const sampleId = Object.keys(
  (preferenceData as { features: Record<string, unknown> }).features,
)[0]

const modelWith = (
  weights: Partial<PreferenceModel['weights']>,
  comparisons = 3,
): PreferenceModel => ({
  weights: { ...createPreferenceModel().weights, ...weights },
  comparisons,
})

describe('effectivePreferenceModel', () => {
  it('직접 보정이 추론 가중치를 덮어쓴다', () => {
    const m = effectivePreferenceModel(modelWith({ cafe_choice: 0.1 }), {
      cafe_choice: -0.4,
    })
    expect(m.weights.cafe_choice).toBe(-0.4)
  })

  it('보정만 있고 학습이 없어도 랭킹이 작동하도록 comparisons≥1', () => {
    const m = effectivePreferenceModel(createPreferenceModel(), {
      fitness_access: 0.4,
    })
    expect(m.comparisons).toBe(1)
  })
})

describe('betaForFavorites', () => {
  it('찜 개수에 비례하되 0.25로 상한(§12.4)', () => {
    expect(betaForFavorites(0)).toBe(0)
    expect(betaForFavorites(1)).toBeCloseTo(0.05)
    expect(betaForFavorites(3)).toBeCloseTo(0.15)
    expect(betaForFavorites(5)).toBe(0.25)
    expect(betaForFavorites(10)).toBe(0.25)
  })
})

describe('favoriteSignal', () => {
  it('빈 찜은 신호 없음', () => {
    expect(favoriteSignal([]).validCount).toBe(0)
  })
})

describe('finalPreferenceModel', () => {
  it('찜 반영을 끄면 유효 모델과 동일', () => {
    const base = {
      model: modelWith({ cafe_choice: 0.1 }),
      overrides: { fitness_access: 0.4 },
    }
    const off = finalPreferenceModel({
      ...base,
      favorites: { [sampleId]: true },
      favoriteLearningEnabled: false,
    })
    const eff = effectivePreferenceModel(base.model, base.overrides)
    expect(off.weights).toEqual(eff.weights)
  })

  it('직접 설정한 feature는 찜 보정이 덮어쓰지 못한다(§12.4)', () => {
    const out = finalPreferenceModel({
      model: modelWith({}),
      overrides: { cafe_choice: 0.4 },
      favorites: { [sampleId]: true },
      favoriteLearningEnabled: true,
    })
    expect(out.weights.cafe_choice).toBe(0.4)
  })

  it('찜만 있고 온보딩·보정이 없으면 랭킹을 활성화하지 않는다(§12.1)', () => {
    const out = finalPreferenceModel({
      model: null,
      overrides: {},
      favorites: { [sampleId]: true },
      favoriteLearningEnabled: true,
    })
    // comparisons 0 → rankByLearnedPreference가 순위를 바꾸지 않는다(찜은 온보딩 이후 신호).
    expect(out.comparisons).toBe(0)
  })
})
