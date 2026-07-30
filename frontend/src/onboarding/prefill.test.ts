import { describe, it, expect } from 'vitest'
import type { Leans } from './weights'
import { predictChips, predictedIds, buildLog } from './prefill'

const on = (leans: Leans) => predictedIds(predictChips(leans))

describe('predictChips — 프리필 규칙', () => {
  it('활기 강함 → 대중교통·헬스장 ON', () => {
    const ids = on({ A1_vibe: 1, A2_character: 0, A3_calm: 0 })
    expect(ids).toContain('transit')
    expect(ids).toContain('gym')
  })

  it('여유 강함 → 공원 ON', () => {
    expect(on({ A1_vibe: 0, A2_character: 0, A3_calm: -1 })).toContain('park')
  })

  it('생활편의 강함 → 주차 ON', () => {
    expect(on({ A1_vibe: 0, A2_character: -1, A3_calm: 0 })).toContain(
      'parking',
    )
  })

  it('평탄한 취향(신호 0) → 아무 칩도 프리토글 안 함', () => {
    expect(on({ A1_vibe: 0, A2_character: 0, A3_calm: 0 })).toHaveLength(0)
  })

  it('모든 예측 강함이어도 최대 3개(4칩 전부 ON 금지)', () => {
    const ids = on({ A1_vibe: 1, A2_character: -1, A3_calm: -1 })
    expect(ids.length).toBeLessThanOrEqual(3)
  })

  it('OFF 칩은 OFF 근거 문장을 받는다', () => {
    const pf = predictChips({ A1_vibe: 0, A2_character: 0, A3_calm: 0 })
    for (const p of pf) {
      expect(p.on).toBe(false)
      expect(p.rationale).toBeTruthy()
    }
  })

  it('레지스트리 4칩 모두 반환(순서 유지)', () => {
    const pf = predictChips({ A1_vibe: 1, A2_character: 0, A3_calm: 0 })
    expect(pf.map((p) => p.chip.id)).toEqual([
      'gym',
      'parking',
      'park',
      'transit',
    ])
  })
})

describe('buildLog — 프리필 수정 로깅', () => {
  it('accepted / added / removed 분해', () => {
    const log = buildLog(['transit', 'gym'], ['transit', 'park'])
    expect(log.predicted).toEqual(['transit', 'gym'])
    expect(log.accepted).toEqual(['transit']) // 예측∩최종
    expect(log.added).toEqual(['park']) // 최종−예측(카드 미포착)
    expect(log.removed).toEqual(['gym']) // 예측−최종(추정 오류)
  })

  it('완전 수용 → added·removed 없음', () => {
    const log = buildLog(['park'], ['park'])
    expect(log.added).toHaveLength(0)
    expect(log.removed).toHaveLength(0)
    expect(log.accepted).toEqual(['park'])
  })
})
