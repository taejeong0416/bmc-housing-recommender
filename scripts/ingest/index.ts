/**
 * BMC 주택 인제스천 엔트리 (P0)
 *
 * 흐름: manifest 순회 → 어댑터 → canonical 검증 → 단지 집계 → 지오코딩 → 산출(housings.json) → 리포트
 * 실데이터 도착 시 교체점은 `data/source/`의 CSV + `adapters/` 뿐 (HARNESS_DESIGN §3).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adapters } from './adapters'
import { aggregate } from './aggregate'
import { Complex, Pricing, Unit } from './canonical'
import { emit } from './emit'
import { geocodeHousings } from './geocode'
import {
  derivePhysicalTags,
  resetUnmappedPhysicalTag,
  unmappedPhysicalTag,
} from './physical-tags'
import { resetUnmappedSupplyClass, unmappedSupplyClass } from './qualifications'
import { readCsv } from './util'

// .env(VWORLD_API_KEY 등) 로드 — 없으면 무시(지오코딩은 키 없이 좌표 null로 진행)
try {
  process.loadEnvFile('.env')
} catch {
  /* .env 없음 */
}

const SRC_DIR = 'data/source'
interface ManifestEntry {
  file: string
  adapter: string
}

async function main() {
  const manifest: ManifestEntry[] = JSON.parse(
    readFileSync('scripts/ingest/manifest.json', 'utf8'),
  )

  const complexes: Complex[] = []
  const units: Unit[] = []
  const pricing: Pricing[] = []
  let totalIn = 0
  let totalSkip = 0
  let totalErr = 0

  console.log('[ingest] 파일별 리포트 (입력 = 산출 + 스킵)')
  console.log('─'.repeat(72))

  for (const { file, adapter } of manifest) {
    const fn = adapters[adapter]
    if (!fn) {
      console.error(`  ✗ 알 수 없는 어댑터: ${adapter}`)
      continue
    }
    const rows = readCsv(join(SRC_DIR, file))
    const res = fn(rows)

    let err = 0
    for (const c of res.complexes ?? []) {
      const p = Complex.safeParse(c)
      if (p.success) complexes.push(p.data)
      else if (++err <= 3)
        console.error(`    ✗ Complex 검증 실패:`, p.error.issues[0]?.message)
    }
    for (const u of res.units ?? []) {
      const p = Unit.safeParse(u)
      if (p.success) units.push(p.data)
      else if (++err <= 3)
        console.error(`    ✗ Unit 검증 실패:`, p.error.issues[0]?.message)
    }
    for (const pr of res.pricing ?? []) {
      const p = Pricing.safeParse(pr)
      if (p.success) pricing.push(p.data)
      else if (++err <= 3)
        console.error(`    ✗ Pricing 검증 실패:`, p.error.issues[0]?.message)
    }

    totalIn += rows.length
    totalSkip += res.skipped.length
    totalErr += err
    console.log(
      `  ${adapter.padEnd(16)} 입력 ${String(rows.length).padStart(5)} · 단지 ${String(res.complexes?.length ?? 0).padStart(3)} · 호 ${String(res.units?.length ?? 0).padStart(5)} · 가격 ${String(res.pricing?.length ?? 0).padStart(5)} · 스킵 ${res.skipped.length}${err ? ` · 검증오류 ${err}` : ''}`,
    )
    for (const s of res.skipped.slice(0, 3))
      console.log(`      · 스킵 행 ${s.row}: ${s.reason}`)
  }

  // 제공 원천의 완전 중복 행(현재 매입임대 32건)은 호·가격을 부풀리므로 canonical 키 기준으로
  // 제거한다. 서로 다른 가격 순위/공급계층은 유지한다.
  const uniqueBy = <T>(rows: T[], key: (row: T) => string): T[] => [
    ...new Map(rows.map((row) => [key(row), row])).values(),
  ]
  const dedupedUnits = uniqueBy(
    units,
    (u) =>
      `${u.complexId}|${u.dong ?? ''}|${u.ho}|${u.unitType ?? ''}|${u.rooms}|${u.areaM2}`,
  )
  const dedupedPricing = uniqueBy(
    pricing,
    (p) =>
      `${p.complexId}|${p.unitType ?? ''}|${p.ho ?? ''}|${JSON.stringify(p.qualifier)}|${p.deposit}|${p.rent}|${p.registeredAt}`,
  )

  // 가격→단지 조인: 미매칭(고아) 가격은 산출물에서 제외 — DB 시드 FK 위반·유령 가격 방지
  const complexIds = new Set(complexes.map((c) => c.id))
  const joinedPricing = dedupedPricing.filter((p) =>
    complexIds.has(p.complexId),
  )
  const orphanPricing = dedupedPricing.length - joinedPricing.length

  // 집계 → 지오코딩 → 좌표 역전파(canonical complexes에도 반영) → 산출
  resetUnmappedSupplyClass() // 신규 공급계층 감지 수집기 초기화(A 태그, qualifications.ts)
  resetUnmappedPhysicalTag() // 신규 주거물리 태그 감지 수집기 초기화(B 태그, physical-tags.ts)
  const housings = aggregate(complexes, dedupedUnits, joinedPricing)

  // B. 주거물리 태그 부착 — 임시 소스(B 산출 CSV) 조인, 신규 신호만 harvest(physical-tags.ts)
  const physMap = derivePhysicalTags()
  let physMatched = 0
  for (const h of housings) {
    const pt = physMap.get(h.id)
    if (pt && pt.length) {
      h.physicalTags = pt
      physMatched++
    }
  }

  const geo = await geocodeHousings(housings)
  const coordById = new Map(
    housings.map((h) => [
      h.id,
      {
        lat: h.lat,
        lng: h.lng,
        coordinateSource: h.coordinateSource ?? null,
        coordinateAccuracy: h.coordinateAccuracy ?? null,
      },
    ]),
  )
  for (const c of complexes) {
    const co = coordById.get(c.id)
    if (co) {
      c.lat = co.lat
      c.lng = co.lng
      c.coordinateSource = co.coordinateSource
      c.coordinateAccuracy = co.coordinateAccuracy
    }
  }
  emit(housings, { complexes, units: dedupedUnits, pricing: joinedPricing })

  console.log('─'.repeat(72))
  console.log(
    `[ingest] 합계 단지 ${complexes.length} · 호 ${dedupedUnits.length}(중복제거 ${units.length - dedupedUnits.length}) · 가격 ${dedupedPricing.length}(중복제거 ${pricing.length - dedupedPricing.length}) · 스킵 ${totalSkip} · 검증오류 ${totalErr} (입력 ${totalIn})`,
  )
  if (orphanPricing > 0)
    console.warn(
      `[ingest] ⚠ 단지 미매칭 가격 ${orphanPricing}건 → 산출물에서 제외됨. complex-aliases.json·주소 정규화 점검`,
    )
  // 기본 경로는 주소 반출 없는 로컬 결합(선도소프트 건물주소·도로 인덱스). 외부 API는
  // ALLOW_EXTERNAL_GEOCODING=1 + 키가 있을 때만 보조로 쓴다(geo.skipped는 외부 미사용을 뜻함).
  console.log(
    `[ingest] 지오코딩 좌표 확보 ${geo.filled}/${housings.length} · 정확주소 ${geo.localMatches} · 동일도로 근사 ${geo.approximateMatches} · 분기도로 기준점 ${geo.roadAnchorMatches} · ${geo.skipped ? '외부 API 미사용(로컬 전용)' : `API 호출 ${geo.apiCalls}`} · 미확보 ${geo.failed.length}`,
  )
  if (unmappedSupplyClass.size > 0)
    console.warn(
      `[ingest] ⚠ 미매핑 공급계층 ${unmappedSupplyClass.size}종 → A 태그 누락: ${[...unmappedSupplyClass].join(', ')}. qualifications.ts의 SUPPLY_CLASS_TAG(태그화) 또는 IGNORED_SUPPLY_CLASS(의도적 제외)에 추가할지 결정`,
    )
  console.log(
    `[ingest] 주거물리 태그(B) 부착 ${physMatched}/${housings.length} 단지`,
  )
  if (unmappedPhysicalTag.size > 0)
    console.warn(
      `[ingest] ⚠ 미분류 주거물리 태그 ${unmappedPhysicalTag.size}종: ${[...unmappedPhysicalTag].join(', ')}. physical-tags.ts의 HARVEST(흡수) 또는 IGNORED(의도적 제외)에 추가할지 결정`,
    )
  console.log(
    '[ingest] 산출: frontend/src/generated/housings.json · data/out/canonical.json',
  )

  if (totalErr > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('[ingest] 실패:', err)
  process.exitCode = 1
})
