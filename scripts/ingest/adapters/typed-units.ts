import type { Adapter, Complex, Unit } from '../canonical'
import {
  complexId,
  districtOf,
  isoFromYmd,
  legalDongOf,
  num,
  toInt,
  TYPE_MAP,
} from '../util'

/** 행복·통합·재개발 공용 주택정보. `임대주택유형`으로 분기, 임대주택명 단위 단지 dedupe. */
export const typedUnits: Adapter = (rows) => {
  const complexes = new Map<string, Complex>()
  const units: Unit[] = []
  const skipped: { row: number; reason: string }[] = []

  rows.forEach((r, i) => {
    const rowNo = i + 2
    const type = TYPE_MAP[(r['임대주택유형'] ?? '').trim()]
    if (!type) {
      skipped.push({
        row: rowNo,
        reason: `알 수 없는 임대주택유형: ${r['임대주택유형']}`,
      })
      return
    }
    const name = (r['임대주택명'] ?? '').trim()
    if (!name) {
      skipped.push({ row: rowNo, reason: '임대주택명 없음' })
      return
    }
    const addr = (r['주소'] ?? '').trim()
    const id = complexId(type, name)
    if (!complexes.has(id)) {
      complexes.set(id, {
        id,
        type,
        name,
        address: addr,
        district: districtOf(addr),
        dong: legalDongOf(addr),
        builtDate: isoFromYmd(r['준공일자']),
        totalUnits: toInt(r['세대수']),
        elevator: (r['승강기설치구분'] ?? '').trim() === '설치',
        parking: toInt(r['주차대수']),
        lat: null,
        lng: null,
      })
    }
    units.push({
      complexId: id,
      dong: (r['동'] ?? '').trim() || undefined,
      ho: (r['호'] ?? '').trim(),
      unitType: (r['평형타입'] ?? r['주택형'] ?? '').trim() || undefined,
      rooms: toInt(r['방수']),
      areaM2: num(r['전용면적']),
    })
  })

  return { complexes: [...complexes.values()], units, skipped }
}
