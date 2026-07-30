import type { Adapter, Pricing } from '../canonical'
import { complexId, isoFromMdy, num, stripAddrSuffix } from '../util'

/** 매입임대 보증금·임대료(호 단위 평균표준가). 주소+호명으로 단지·호 결합. */
export const maeipPricing: Adapter = (rows) => {
  const pricing: Pricing[] = []
  const skipped: { row: number; reason: string }[] = []

  rows.forEach((r, i) => {
    const rowNo = i + 2
    const addr = (r['주소'] ?? '').trim()
    if (!addr) {
      skipped.push({ row: rowNo, reason: '주소 없음' })
      return
    }
    const deposit = num(r['평균표준보증금'])
    const rent = num(r['평균표준임대료'])
    if (!Number.isFinite(deposit) || !Number.isFinite(rent)) {
      skipped.push({ row: rowNo, reason: '금액 파싱 실패' })
      return
    }
    pricing.push({
      complexId: complexId('매입임대', stripAddrSuffix(addr)),
      ho: (r['호명'] ?? '').trim() || undefined,
      qualifier: {},
      deposit,
      rent,
      registeredAt: isoFromMdy(r['등록일']) ?? '',
    })
  })

  return { pricing, skipped }
}
