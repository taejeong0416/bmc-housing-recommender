// 프리필 매핑(ONBOARDING_REDESIGN §2-4). 1단계 lean → 2단계 칩 예측 → 상위 2~3 ON + 근거.
// 규칙표(RATIONALE·chipScore)는 인터페이스 뒤로 분리 — GIS 상관분석 나오면 이 표만 교체.
import type { InfraChip, OnboardingLog } from '@bmc/shared-types'
import type { Leans } from './weights'
import { CHIPS } from './registry'

const PREDICT_THRESHOLD = 0.15 // 이 미만 신호는 프리토글 안 함
const MAX_ON = 3 // 4칩 전부 ON 금지(조사 §3: 전부 아님/없음 아님)

// 칩별 ON/OFF 근거 문장(끈 칩도 근거 — 조사 §3 반사실 권장).
const RATIONALE: Record<string, { on: string; off: string }> = {
  transit: {
    on: "활기찬 도심을 고르셔서 '대중교통'을 켰어요",
    off: '조용한 쪽이라 대중교통은 뺐어요 — 필요하면 켜세요',
  },
  gym: {
    on: "활기찬 동네엔 헬스장이 많아 '헬스장'을 켰어요",
    off: '특별한 신호가 없어 헬스장은 꺼뒀어요',
  },
  park: {
    on: "여유로운 쪽을 고르셔서 '공원·자연'을 켰어요",
    off: '밀집·도심을 고르셔서 공원은 뺐어요',
  },
  parking: {
    on: "생활편의·정주형을 고르셔서 '주차'를 켰어요",
    off: '특별한 신호가 없어 주차는 꺼뒀어요',
  },
}

// 칩 예측점수 = 1단계 lean의 함수(§2-4-a). lean∈[−1,1]이라 칩 간 비교 가능.
function chipScore(id: string, L: Leans): number {
  const vibe = Math.max(0, L.A1_vibe ?? 0) // 활기 lean
  switch (id) {
    case 'transit':
      return vibe
    case 'gym':
      return vibe * 0.8
    case 'park':
      return Math.max(0, -(L.A3_calm ?? 0)) // 여유 lean
    case 'parking':
      return Math.max(0, -(L.A2_character ?? 0)) // 생활편의 lean
    default:
      return 0
  }
}

export interface ChipPrefill {
  chip: InfraChip
  on: boolean
  score: number
  rationale: string
}

/** lean → 칩별 프리필(레지스트리 순서 유지). 상위 2~3 ON, 나머지 OFF. */
export function predictChips(leans: Leans): ChipPrefill[] {
  const scored = CHIPS.map((chip) => ({
    chip,
    score: chipScore(chip.id, leans),
  }))
  const onIds = new Set(
    scored
      .filter((s) => s.score > PREDICT_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ON)
      .map((s) => s.chip.id),
  )
  return scored.map(({ chip, score }) => {
    const on = onIds.has(chip.id)
    return { chip, on, score, rationale: RATIONALE[chip.id][on ? 'on' : 'off'] }
  })
}

/** 프리필 결과에서 ON 칩 id. */
export function predictedIds(prefill: ChipPrefill[]): string[] {
  return prefill.filter((p) => p.on).map((p) => p.chip.id)
}

/** 예측 vs 최종 사용자 선택 → 수정 로깅(§2-5). added=카드 미포착, removed=추정 오류. */
export function buildLog(
  predicted: string[],
  finalOn: string[],
): OnboardingLog {
  const P = new Set(predicted)
  const F = new Set(finalOn)
  return {
    predicted,
    accepted: predicted.filter((c) => F.has(c)),
    added: finalOn.filter((c) => !P.has(c)),
    removed: predicted.filter((c) => !F.has(c)),
  }
}
