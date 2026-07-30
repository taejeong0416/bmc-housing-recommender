import type { Complex, HousingType, Pricing } from '@bmc/shared-types'

/**
 * A. 자격·유형 태그 파생 — 하드컷 필터용(대분류 A).
 * canonical 필드에서 결정론적으로 뽑으므로, 실데이터도 같은 어댑터를 타면 자동 동일 적용(HARNESS §3).
 * 세 갈래: (1) 유형 태그 (2) 공급계층 태그 (3) 유형 제도규칙 태그.
 */

// (2) 공급계층명(행복 pricing supplyClass) → 계층 태그.
//     원문은 콤마로 여러 계층이 결합될 수 있어(예: '신혼부부, 한부모가족') 토큰별로 매핑한다.
const SUPPLY_CLASS_TAG: Record<string, string> = {
  청년: '청년계층',
  대학생: '대학생',
  신혼부부: '신혼부부',
  한부모가족: '한부모',
  고령자: '고령자',
  주거급여수급자: '주거급여수급',
}

// 의도적으로 태그화하지 않는 계층(일회성·특수) — 여기 있으면 신규 감지 경고를 내지 않는다.
const IGNORED_SUPPLY_CLASS = new Set(['센텀2지구 임시거주자'])

// 실데이터 대비 장치: 허용표·무시표 어디에도 없는 '신규' 공급계층 토큰을 수집한다.
// 조용히 드롭되지 않도록 인제스트 종료 시 리포트한다(index.ts). 실행 간 상태가 남지 않게
// 매 인제스트 시작에서 resetUnmappedSupplyClass()로 비운다.
export const unmappedSupplyClass = new Set<string>()
export function resetUnmappedSupplyClass(): void {
  unmappedSupplyClass.clear()
}

// (3) 유형 제도규칙 태그 — 개별 단지 속성이 아니라 유형이 정해지면 따라오는 제도 사실.
//     ⚠ 제도 상수: 실데이터 확정 전 담당자 확인 필요.
//     '분양전환'은 현 소스에 구분 필드가 없어 파생 불가 → 제외.
const TYPE_RULE_TAGS: Record<HousingType, string[]> = {
  통합공공임대: ['소득150이하', '장기거주30년'],
  매입임대: ['청약통장불필요'],
  행복주택: [],
  재개발임대: [],
}

/** 단지 + 그 단지의 pricing 행들 → A 자격·유형 태그(중복 제거, 삽입순). */
export function deriveQualifications(c: Complex, pricing: Pricing[]): string[] {
  const tags = new Set<string>()
  tags.add(c.type) // (1) 유형 태그 = canonical 유형 그대로
  for (const p of pricing) {
    if (!p.qualifier.supplyClass) continue
    for (const raw of p.qualifier.supplyClass.split(',')) {
      const token = raw.trim()
      if (!token) continue
      const tag = SUPPLY_CLASS_TAG[token] // (2) 공급계층(콤마 결합 → 토큰별)
      if (tag) tags.add(tag)
      else if (!IGNORED_SUPPLY_CLASS.has(token)) unmappedSupplyClass.add(token) // 신규 감지
    }
  }
  for (const t of TYPE_RULE_TAGS[c.type]) tags.add(t) // (3) 유형 제도규칙
  return [...tags]
}
