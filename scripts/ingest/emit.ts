import { mkdirSync, writeFileSync } from 'node:fs'
import type { GeneratedHousing } from './aggregate'
import type { Complex, Pricing, Unit } from './canonical'

const HOUSINGS_PATH = 'frontend/src/generated/housings.json' // 비커밋, 앱이 읽는 실데이터
const CANONICAL_PATH = 'data/out/canonical.json' // 비커밋, P2-B-3 DB 시드 입력

/** 산출물 2종 기록. 정렬 고정으로 재실행 멱등(동일 입력 → 동일 diff 없음). */
export function emit(
  housings: GeneratedHousing[],
  canonical: { complexes: Complex[]; units: Unit[]; pricing: Pricing[] },
) {
  const sorted = [...housings].sort((a, b) => a.id.localeCompare(b.id))

  mkdirSync('frontend/src/generated', { recursive: true })
  mkdirSync('data/out', { recursive: true })
  writeFileSync(HOUSINGS_PATH, JSON.stringify(sorted, null, 2) + '\n')
  writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2) + '\n')
}
