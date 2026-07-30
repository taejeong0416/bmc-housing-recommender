import { useMemo } from 'react'
import { useStore } from '../store'
import { useHousings } from './useHousings'
import { applyPrefs, filterPrefsFromState } from '../lib/filter'
import type { GeneratedHousing } from '../types'
import { rankByLearnedPreference } from '../onboarding/pairwise'
import { finalPreferenceModel } from '../onboarding/refine'
import { medicalDailyScore } from '../lib/listingTags'

// 선택형 의료축(§9.2) — 8축 학습과 분리된 조건부 보정. 사용자가 명시적으로 켤 때만
// 기존 취향 적합도에 medical_daily_access를 고정 가중(0.3)으로 섞어 재정렬한다.
const MEDICAL_AXIS_WEIGHT = 0.3

function applyMedicalPreference(items: GeneratedHousing[]): GeneratedHousing[] {
  const scored = items.map((housing) => {
    const medical = medicalDailyScore(housing.id)
    const base =
      housing.scoreSource === 'engine' && typeof housing.score === 'number'
        ? housing.score / 100
        : null
    if (medical == null) return { housing, key: base ?? 0 }
    const blended =
      base == null
        ? medical
        : (1 - MEDICAL_AXIS_WEIGHT) * base + MEDICAL_AXIS_WEIGHT * medical
    return {
      housing: {
        ...housing,
        score: Math.round(blended * 100),
        scoreSource: 'engine' as const,
        highlight: housing.highlight
          ? `${housing.highlight} · 의료 접근 반영`
          : '의료 접근 반영',
      },
      key: blended,
    }
  })
  return [...scored]
    .sort((a, b) => b.key - a.key || a.housing.id.localeCompare(b.housing.id))
    .map((item) => item.housing)
}

// 추천 결과 수신 이음새(P5-C-3 계약) — 랭킹은 tag/ 고정 거리감쇠 φ + pairwise w를
// 프론트 로컬에서 계산한다(generated/housings.json + preference-features.json 소비).
// 소비 화면(Map·Detail)은 이 훅만 보고, 랭킹 구현은 훅 뒤로 격리된다.
export interface RecommendationsResult {
  items: GeneratedHousing[]
  personalized: boolean // 취향(온보딩·직접보정·찜)이 실제 랭킹에 반영됐는가 — 라벨 일관성용
  isLoading: boolean
  isError: boolean
}

export function useRecommendations(): RecommendationsResult {
  const { state } = useStore()
  // 최종 모델 = pairwise 추론 + 직접 보정(§7.6) + 찜 정교화(§12) — 지도·목록 랭킹에 함께 전파.
  // memo: 매 렌더 favoriteSignal이 모집단 baseline을 재스캔하지 않도록 입력 4개에 고정.
  const model = useMemo(
    () =>
      finalPreferenceModel({
        model: state.preferenceModel,
        overrides: state.preferenceOverrides,
        favorites: state.favorites,
        favoriteLearningEnabled: state.favoriteLearningEnabled,
      }),
    [
      state.preferenceModel,
      state.preferenceOverrides,
      state.favorites,
      state.favoriteLearningEnabled,
    ],
  )
  const personalized = model.comparisons > 0 || state.medicalPreferred
  const housingsQ = useHousings()
  const filtered = applyPrefs(housingsQ.data ?? [], filterPrefsFromState(state))
  const ranked = rankByLearnedPreference(filtered, model)
  const items = state.medicalPreferred ? applyMedicalPreference(ranked) : ranked
  return {
    items,
    personalized,
    isLoading: housingsQ.isLoading,
    isError: housingsQ.isError,
  }
}
