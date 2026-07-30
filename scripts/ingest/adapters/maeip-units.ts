import type { Adapter, Complex, Unit } from '../canonical'
import {
  complexId,
  districtOf,
  isoFromYmd,
  legalDongOf,
  num,
  parseAddrSuffix,
  stripAddrSuffix,
  toInt,
} from '../util'

/** 매입임대 주택정보(호 단위). 주소 접미 제거 후 단지 dedupe, 행마다 1 Unit. */
export const maeipUnits: Adapter = (rows) => {
  const complexes = new Map<string, Complex>()
  const units: Unit[] = []
  const skipped: { row: number; reason: string }[] = []

  rows.forEach((r, i) => {
    const rowNo = i + 2
    const addr = (r['주소'] ?? '').trim()
    if (!addr) {
      skipped.push({ row: rowNo, reason: '주소 없음' })
      return
    }
    const norm = stripAddrSuffix(addr)
    const id = complexId('매입임대', norm)
    if (!complexes.has(id)) {
      const { dong } = parseAddrSuffix(addr)
      const short = norm.replace(/^\S+[시도]\s+\S+[구군]\s+/, '')
      complexes.set(id, {
        id,
        type: '매입임대',
        name: `매입임대 · ${short}`,
        address: norm,
        district: districtOf(addr),
        dong: dong || legalDongOf(addr),
        builtDate: isoFromYmd(r['사용승인일']),
        totalUnits: toInt(r['세대수']),
        elevator: (r['승강기설치구분'] ?? '').trim() === '설치',
        parking: toInt(r['주차대수']),
        lat: null,
        lng: null,
      })
    }
    units.push({
      complexId: id,
      ho: (r['호'] ?? '').trim(),
      rooms: toInt(r['방수']),
      areaM2: num(r['전용면적']),
    })
  })

  return { complexes: [...complexes.values()], units, skipped }
}
