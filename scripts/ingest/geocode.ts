import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { GeneratedHousing } from './aggregate'

/**
 * 주소 → 위경도.
 *
 * 기본 경로는 주소를 외부로 전송하지 않는 로컬 결합이다.
 * 1) 선도소프트 상가건물의 정확 도로명/지번주소
 * 2) 같은 도로의 가까운 건물
 * 3) `○○로173번길` → `○○로 173` 분기점
 *
 * 2·3은 실제 건물 중심점이 아니므로 정확주소와 구분해 품질등급을 남긴다.
 * 외부 API는 ALLOW_EXTERNAL_GEOCODING=1을 명시한 경우에만 보조 경로로 사용한다.
 */

const CACHE_PATH = 'data/cache/geocode.json'
const LOCAL_GIS_PATH = 'data/out/gis.json'
type CoordinateAccuracy =
  'exact_address' | 'road_nearest' | 'road_anchor' | 'unknown'
type Coord = {
  lat: number
  lng: number
  provider: string
  accuracy?: CoordinateAccuracy
} | null

const normalizeAddress = (value: string) =>
  value
    .normalize('NFC')
    .replace(/^대한민국\s+/, '')
    .replace(/^부산시\s+/, '부산광역시 ')
    .replace(/\([^)]*\)\s*$/, '')
    .replace(/[,\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function loadLocalAddressIndex(): Map<string, Coord> {
  if (!existsSync(LOCAL_GIS_PATH)) return new Map()
  try {
    const gis = JSON.parse(readFileSync(LOCAL_GIS_PATH, 'utf8'))
    const index = new Map<string, Coord>()
    for (const point of gis.addressPoints ?? []) {
      const coord = {
        lat: Number(point.lat),
        lng: Number(point.lng),
        provider: 'sundo-store-building',
        accuracy: 'exact_address' as const,
      }
      if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) continue
      for (const address of [point.roadAddress, point.parcelAddress]) {
        if (address) index.set(normalizeAddress(address), coord)
      }
    }
    return index
  } catch {
    return new Map()
  }
}

type RoadAddressPoint = {
  road: string
  roadName: string
  primary: number
  secondary: number
  lat: number
  lng: number
}

const splitRoadAddress = (
  value: string,
): {
  road: string
  roadName: string
  prefix: string
  primary: number
  secondary: number
} | null => {
  const normalized = normalizeAddress(value)
  const match = normalized.match(
    /^(.*\s)?([^\s]+(?:대로|로|길))\s+(\d+)(?:-(\d+))?$/,
  )
  if (!match) return null
  return {
    prefix: match[1] ?? '',
    roadName: match[2],
    road: `${match[1] ?? ''}${match[2]}`,
    primary: Number(match[3]),
    secondary: Number(match[4] ?? 0),
  }
}

type RoadIndexes = {
  byFullRoad: Map<string, RoadAddressPoint[]>
  byRoadName: Map<string, RoadAddressPoint[]>
}

function loadLocalRoadIndexes(): RoadIndexes {
  const empty = {
    byFullRoad: new Map<string, RoadAddressPoint[]>(),
    byRoadName: new Map<string, RoadAddressPoint[]>(),
  }
  if (!existsSync(LOCAL_GIS_PATH)) return empty
  try {
    const gis = JSON.parse(readFileSync(LOCAL_GIS_PATH, 'utf8'))
    const byFullRoad = new Map<string, RoadAddressPoint[]>()
    const byRoadName = new Map<string, RoadAddressPoint[]>()
    for (const point of gis.addressPoints ?? []) {
      if (!point.roadAddress) continue
      const parsed = splitRoadAddress(point.roadAddress)
      if (!parsed) continue
      const row = {
        road: parsed.road,
        roadName: parsed.roadName,
        primary: parsed.primary,
        secondary: parsed.secondary,
        lat: Number(point.lat),
        lng: Number(point.lng),
      }
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue
      const fullRoadRows = byFullRoad.get(parsed.road) ?? []
      fullRoadRows.push(row)
      byFullRoad.set(parsed.road, fullRoadRows)
      const roadNameRows = byRoadName.get(parsed.roadName) ?? []
      roadNameRows.push(row)
      byRoadName.set(parsed.roadName, roadNameRows)
    }
    return { byFullRoad, byRoadName }
  } catch {
    return empty
  }
}

const nearestRoadPoint = (
  primary: number,
  secondary: number,
  candidates: RoadAddressPoint[],
): { point: RoadAddressPoint; primaryGap: number } | null => {
  let best: {
    score: number
    point: RoadAddressPoint
    primaryGap: number
  } | null = null
  for (const candidate of candidates) {
    const primaryGap = Math.abs(candidate.primary - primary)
    const score =
      primaryGap + Math.min(10, Math.abs(candidate.secondary - secondary)) * 0.1
    if (!best || score < best.score)
      best = { score, point: candidate, primaryGap }
  }
  return best ? { point: best.point, primaryGap: best.primaryGap } : null
}

const parentRoad = (
  target: ReturnType<typeof splitRoadAddress>,
): { fullRoad: string; roadName: string; primary: number } | null => {
  if (!target) return null
  const match = target.roadName.match(
    /^(.*(?:대로|로))(\d+)번(?:[가-힣]*길|안길)$/,
  )
  if (!match) return null
  return {
    fullRoad: `${target.prefix}${match[1]}`,
    roadName: match[1],
    primary: Number(match[2]),
  }
}

const approximateFromRoad = (address: string, indexes: RoadIndexes): Coord => {
  const target = splitRoadAddress(address)
  if (!target) return null

  // 같은 도로의 건물번호는 도로 진행방향에 따른 근사 위치를 제공한다.
  const sameRoad = nearestRoadPoint(
    target.primary,
    target.secondary,
    indexes.byFullRoad.get(target.road) ?? [],
  )
  if (sameRoad && sameRoad.primaryGap <= 80) {
    return {
      lat: sameRoad.point.lat,
      lng: sameRoad.point.lng,
      provider:
        sameRoad.primaryGap <= 20 ? 'sundo-road-nearest' : 'sundo-road-anchor',
      accuracy: sameRoad.primaryGap <= 20 ? 'road_nearest' : 'road_anchor',
    }
  }

  // 분기도로 자체 표본이 없으면 원도로의 분기 건물번호를 기준점으로 쓴다.
  const parent = parentRoad(target)
  if (!parent) return null
  const sameDistrictParent = nearestRoadPoint(
    parent.primary,
    0,
    indexes.byFullRoad.get(parent.fullRoad) ?? [],
  )
  if (sameDistrictParent && sameDistrictParent.primaryGap <= 30) {
    return {
      lat: sameDistrictParent.point.lat,
      lng: sameDistrictParent.point.lng,
      provider: 'sundo-parent-road-anchor',
      accuracy: 'road_anchor',
    }
  }

  // 원천 구 표기 오류·경계도로만 도로명 전역 색인으로 한 번 더 찾는다.
  const crossDistrictParent = nearestRoadPoint(
    parent.primary,
    0,
    indexes.byRoadName.get(parent.roadName) ?? [],
  )
  if (crossDistrictParent && crossDistrictParent.primaryGap <= 30) {
    return {
      lat: crossDistrictParent.point.lat,
      lng: crossDistrictParent.point.lng,
      provider: 'sundo-parent-road-anchor-cross-district',
      accuracy: 'road_anchor',
    }
  }
  return null
}

function loadCache(): Record<string, Coord> {
  if (!existsSync(CACHE_PATH)) return {}
  try {
    const raw: Record<string, Coord> = JSON.parse(
      readFileSync(CACHE_PATH, 'utf8'),
    )
    // 성공 좌표만 신뢰 — 과거 실패(null)는 재실행 시 재시도
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v != null))
  } catch {
    return {}
  }
}
function saveCache(cache: Record<string, Coord>) {
  mkdirSync('data/cache', { recursive: true })
  // 실패(null)는 영구화하지 않는다 — 일시 장애(네트워크·쿼터)가 좌표를 영구 결손시키지 않도록
  const ok = Object.fromEntries(
    Object.entries(cache).filter(([, v]) => v != null),
  )
  writeFileSync(CACHE_PATH, JSON.stringify(ok, null, 2) + '\n')
}

async function vworld(address: string, key: string): Promise<Coord> {
  for (const type of ['road', 'parcel'] as const) {
    const url =
      `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0` +
      `&crs=epsg:4326&format=json&type=${type}&address=${encodeURIComponent(address)}&key=${key}`
    try {
      const res = await fetch(url)
      const data: any = await res.json()
      if (data?.response?.status === 'OK') {
        const p = data.response.result.point
        return {
          lat: Number(p.y),
          lng: Number(p.x),
          provider: `vworld-${type}`,
        }
      }
    } catch {
      /* 네트워크 오류 시 다음 타입/보조 제공자로 */
    }
  }
  return null
}

async function kakao(address: string, key: string): Promise<Coord> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${key}` } },
    )
    const data: any = await res.json()
    const doc = data?.documents?.[0]
    if (doc)
      return { lat: Number(doc.y), lng: Number(doc.x), provider: 'kakao' }
  } catch {
    /* noop */
  }
  return null
}

export interface GeocodeReport {
  filled: number
  localMatches: number
  approximateMatches: number
  roadAnchorMatches: number
  crossDistrictMatches: number
  failed: string[] // 좌표 미확보 단지 id
  apiCalls: number
  skipped: boolean // 키 없어 API 호출 자체를 건너뜀
}

/** housings의 lat/lng을 주소 기준으로 채운다(캐시 우선). 실패는 null 유지 → 지도에서 제외. */
export async function geocodeHousings(
  housings: GeneratedHousing[],
): Promise<GeocodeReport> {
  const cache = loadCache()
  const localAddresses = loadLocalAddressIndex()
  const localRoads = loadLocalRoadIndexes()
  const vkey = process.env.VWORLD_API_KEY
  const kkey = process.env.KAKAO_REST_KEY
  // 외부 API는 주소 데이터 반출이므로 사용자가 명시적으로 허용한 경우에만 쓴다.
  const allowExternal = process.env.ALLOW_EXTERNAL_GEOCODING === '1'
  const report: GeocodeReport = {
    filled: 0,
    localMatches: 0,
    approximateMatches: 0,
    roadAnchorMatches: 0,
    crossDistrictMatches: 0,
    failed: [],
    apiCalls: 0,
    skipped: !allowExternal || (!vkey && !kkey),
  }

  for (const h of housings) {
    const addr = h.address
    if (!addr) {
      report.failed.push(h.id)
      continue
    }
    // 정확주소가 새로 확보됐을 수 있으므로 과거 근사 캐시보다 항상 우선한다.
    const exactLocal = localAddresses.get(normalizeAddress(addr))
    if (exactLocal) cache[addr] = exactLocal
    if (!(addr in cache)) {
      const approximate = approximateFromRoad(addr, localRoads)
      if (approximate) {
        cache[addr] = approximate
      }
    }
    if (!(addr in cache)) {
      if (!allowExternal || (!vkey && !kkey)) {
        report.failed.push(h.id)
        continue
      }
      let coord: Coord = null
      if (vkey) coord = await vworld(addr, vkey)
      if (!coord && kkey) coord = await kakao(addr, kkey)
      cache[addr] = coord
      report.apiCalls++
    }
    const hit = cache[addr]
    if (hit) {
      h.lat = hit.lat
      h.lng = hit.lng
      h.coordinateSource = hit.provider
      h.coordinateAccuracy =
        hit.accuracy ??
        (hit.provider === 'sundo-road-nearest'
          ? 'road_nearest'
          : hit.provider === 'sundo-store-building'
            ? 'exact_address'
            : hit.provider.includes('road-anchor')
              ? 'road_anchor'
              : 'unknown')
      if (h.coordinateAccuracy === 'exact_address') report.localMatches++
      else if (h.coordinateAccuracy === 'road_nearest')
        report.approximateMatches++
      else if (h.coordinateAccuracy === 'road_anchor')
        report.roadAnchorMatches++
      if (hit.provider.includes('cross-district')) report.crossDistrictMatches++
      report.filled++
    } else {
      report.failed.push(h.id)
    }
  }

  saveCache(cache)
  return report
}
