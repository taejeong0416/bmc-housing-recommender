/**
 * 선도소프트 상권 GIS 인제스천 (P3-A-2, M1)
 *
 * 흐름: SHP 3종(data/source/gis/*.zip) → shpjs 파싱 → 좌표변환·8태그 매핑 → data/out/gis.json 산출.
 * 교체점: data/source/gis 의 zip + 이 스크립트 뿐(DATA_SCHEMA §6). DB 적재는 backend seed(M2).
 *
 * 실행: npm run ingest:gis  (오프라인 — DB 불필요, 좌표 bbox·건수 자동 검증)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import shp from 'shpjs'
import { inBusanBbox, type LngLat } from './proj'
import { tagsFor, ZONE_LABEL } from './tags'

const SRC = 'data/source/gis'
const OUT = 'data/out/gis.json'

interface Poi {
  tag: string // cafe/cvs/supermarket/market_complex/laundry/restaurant/gym/shop/culture/nightlife
  category: string // CMSC_S_CD (설명·추적용)
  name: string | null
  storeId: string | null
  buildingId: string | null
  district: string | null
  subcategory: string | null
  lng: number
  lat: number
}
interface AddressPoint {
  roadAddress: string | null
  parcelAddress: string | null
  buildingName: string | null
  buildingId: string | null
  lng: number
  lat: number
}
interface DensityGrid {
  gridId: string
  pop: number
  d: {
    csv: number
    coffee: number
    kfood: number
    pharm: number
    salon: number
  }
  centroid: LngLat
  ring: LngLat[]
}
interface ZoneGrid {
  gridId: string
  zoneCode: string
  zoneType: string
  hasBusStop: boolean
  centroid: LngLat
  ring: LngLat[]
}

type Feature = {
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}

async function parse(file: string): Promise<Feature[]> {
  const buf = readFileSync(join(SRC, file))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const fc = (await shp(ab as ArrayBuffer)) as unknown
  const list = Array.isArray(fc) ? fc : [fc]
  return list.flatMap((c) => (c as { features: Feature[] }).features)
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))
const str = (v: unknown) => (v == null ? '' : String(v).trim())
const outerRing = (g: Feature['geometry']) =>
  (g.coordinates as LngLat[][][])[0] ?? (g.coordinates as LngLat[][])[0] ?? []
const centroidOf = (ring: LngLat[]): LngLat => {
  if (!ring.length) return [NaN, NaN]
  const s = ring.reduce((a, [x, y]) => [a[0] + x, a[1] + y] as LngLat, [
    0, 0,
  ] as LngLat)
  return [s[0] / ring.length, s[1] / ring.length]
}

async function main() {
  // ── 상가-건물: LO/LA(WGS84) 직접 사용, CMSC→태그 매핑(POI당 복수 태그 가능) ──
  const buldFeatures = await parse('buld.zip')
  const pois: Poi[] = []
  const addressPoints = new Map<string, AddressPoint>()
  let noCoord = 0
  let outOfBusan = 0
  for (const f of buldFeatures) {
    const p = f.properties
    const lng = num(p.LO)
    const lat = num(p.LA)
    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      (lng === 0 && lat === 0)
    ) {
      noCoord++
      continue
    }
    if (!inBusanBbox([lng, lat])) {
      outOfBusan++
      continue
    }
    const roadAddress = str(p.RDNMADR) || null
    const parcelAddress = str(p.LNNO_ADRES) || null
    const buildingId = str(p.BD_SN) || null
    const buildingName = str(p.RGST_BD_NM) || str(p.DETL_BD_NM) || null
    const addressKey = `${roadAddress ?? ''}|${parcelAddress ?? ''}|${buildingId ?? ''}`
    if (!addressPoints.has(addressKey)) {
      addressPoints.set(addressKey, {
        roadAddress,
        parcelAddress,
        buildingName,
        buildingId,
        lng,
        lat,
      })
    }
    const tags = tagsFor({
      lCd: str(p.CMSC_L_CD),
      mCd: str(p.CMSC_M_CD),
      sCd: str(p.CMSC_S_CD),
      sName: str(p.CMSC_S_NM),
    })
    for (const tag of tags)
      pois.push({
        tag,
        category: str(p.CMSC_S_CD),
        name: str(p.CM_NM) || null,
        storeId: str(p.CM_BSSH_NO) || null,
        buildingId,
        district: str(p.SIGNGU_NM) || null,
        subcategory: str(p.CMSC_S_NM) || null,
        lng,
        lat,
      })
  }

  // ── 5대 업종-인구 밀집도 격자(5186 폴리곤 → 4326) ──
  const popFeatures = await parse('pop_store.zip')
  const densityGrids: DensityGrid[] = popFeatures.map((f) => {
    const p = f.properties
    const ring = outerRing(f.geometry) // shpjs가 .prj로 이미 WGS84 재투영
    return {
      gridId: str(p.GRID_ID),
      pop: Math.round(num(p.P_Val)) || 0,
      d: {
        csv: Math.round(num(p.D_CSV)) || 0,
        coffee: Math.round(num(p.D_COFFEE)) || 0,
        kfood: Math.round(num(p.D_KFOOD)) || 0,
        pharm: Math.round(num(p.D_PHARM)) || 0,
        salon: Math.round(num(p.D_SALON)) || 0,
      },
      centroid: centroidOf(ring),
      ring,
    }
  })

  // ── 상권·용도지역 격자(5186 폴리곤 → 4326). zoneType은 UCODE로 안전 매핑 ──
  const zoneFeatures = await parse('store_use_area.zip')
  const zoneGrids: ZoneGrid[] = zoneFeatures.map((f) => {
    const p = f.properties
    const ring = outerRing(f.geometry) // shpjs가 .prj로 이미 WGS84 재투영
    const zoneCode = str(p.UCODE)
    return {
      gridId: str(p.GRID_ID),
      zoneCode,
      zoneType: str(p.UNAME) || ZONE_LABEL[zoneCode] || zoneCode,
      hasBusStop: str(p.BSST_YN).toUpperCase() === 'Y',
      centroid: centroidOf(ring),
      ring,
    }
  })

  mkdirSync('data/out', { recursive: true })
  writeFileSync(
    OUT,
    JSON.stringify({
      metadata: {
        sourceVintage: 2024,
        spatialTarget: '부산광역시 전체',
        note: 'BSST_YN은 컬럼정의서상 버스정류장 여부이며 상권 형성 여부가 아니다.',
      },
      pois,
      addressPoints: [...addressPoints.values()],
      densityGrids,
      zoneGrids,
    }),
  )

  // ── 검증 리포트 ──
  const byTag = new Map<string, number>()
  for (const p of pois) byTag.set(p.tag, (byTag.get(p.tag) ?? 0) + 1)
  const inBbox = pois.filter((p) => inBusanBbox([p.lng, p.lat])).length
  const gridInBbox = densityGrids.filter((g) => inBusanBbox(g.centroid)).length
  const zoneBusStop = zoneGrids.filter((g) => g.hasBusStop).length

  console.log(
    '[gis] 상가-건물:',
    buldFeatures.length,
    '건 · 좌표없음 스킵',
    noCoord,
    '· 부산 bbox 밖 스킵',
    outOfBusan,
  )
  console.log(
    '[gis] 태그별 POI:',
    [...byTag.entries()].map(([t, n]) => `${t} ${n}`).join(' · '),
  )
  console.log(`[gis] 주소 포인트: ${addressPoints.size}`)
  console.log(`[gis] POI 좌표 부산 bbox 내: ${inBbox}/${pois.length}`)
  console.log(
    `[gis] 밀집도 격자: ${densityGrids.length} (bbox 내 centroid ${gridInBbox})`,
  )
  console.log(
    `[gis] 용도지역 격자: ${zoneGrids.length} · 버스정류장 포함격자(Y) ${zoneBusStop}`,
  )
  console.log(`[gis] 산출: ${OUT}`)

  // 좌표 변환이 깨지면(격자가 bbox 밖) 실패로 표시 — 5181/5186 혼동 방지 가드
  if (pois.length && inBbox / pois.length < 0.95) {
    console.error('[gis] ✗ POI 좌표 대다수가 부산 bbox 밖 — LO/LA 파싱 점검')
    process.exitCode = 1
  }
  if (densityGrids.length && gridInBbox / densityGrids.length < 0.95) {
    console.error('[gis] ✗ 격자 좌표변환 이상 — 부산/EPSG 5186 확인')
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[gis] 실패:', err)
  process.exitCode = 1
})
