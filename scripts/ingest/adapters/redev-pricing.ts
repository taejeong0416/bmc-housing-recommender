import type { Adapter, Pricing } from '../canonical'
import { complexId, isoFromMdy, num, resolveAlias } from '../util'

/** 재개발임대 보증금·임대료(주택형×보호구분). 사업지구→임대주택명 결합. */
export const redevPricing: Adapter = (rows) => {
  const pricing: Pricing[] = []
  const skipped: { row: number; reason: string }[] = []

  rows.forEach((r, i) => {
    const rowNo = i + 2
    const name = resolveAlias((r['사업지구'] ?? '').trim())
    if (!name) {
      skipped.push({ row: rowNo, reason: '사업지구 없음' })
      return
    }
    const deposit = num(r['표준보증금'])
    const rent = num(r['표준임대료'])
    if (!Number.isFinite(deposit) || !Number.isFinite(rent)) {
      skipped.push({ row: rowNo, reason: '금액 파싱 실패' })
      return
    }
    pricing.push({
      complexId: complexId('재개발임대', name),
      unitType: (r['주택형'] ?? '').trim() || undefined,
      qualifier: { protection: (r['보호구분명'] ?? '').trim() || undefined },
      deposit,
      rent,
      registeredAt: isoFromMdy(r['등록일']) ?? '',
    })
  })

  return { pricing, skipped }
}
