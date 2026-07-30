import landmarksRaw from '../generated/landmarks.json'

// 부산 주요 거점(역·대학·업무지구·병원·상권·명소) 큐레이션 목록.
// 표시 전용 — 추천 8축 취향모델에는 개입하지 않는다(주관 편집 데이터라 랭킹 근거로 쓰지 않음).
export interface Landmark {
  id: string
  name: string
  alias: string[]
  category: string
  categoryMinor: string
  district: string
  lat: number
  lng: number
  importance: number
  radiusM: number
  targetUser: string[]
}

export interface NearbyLandmark extends Landmark {
  distanceM: number
}

const landmarks = landmarksRaw as Landmark[]

const EARTH_M = 6371000
const toRad = (deg: number) => (deg * Math.PI) / 180

function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)))
}

// 후보가 랜드마크 영향권(radiusM) 안이면 "근처"로 본다. 실제로 가까운 순, 동률이면 중요도 높은 순.
export function nearbyLandmarks(
  lat: number,
  lng: number,
  limit = 3,
): NearbyLandmark[] {
  return landmarks
    .map((l) => ({ ...l, distanceM: haversine(lat, lng, l.lat, l.lng) }))
    .filter((l) => l.distanceM <= l.radiusM)
    .sort((a, b) => a.distanceM - b.distanceM || b.importance - a.importance)
    .slice(0, limit)
}

// '주변 대표장소' — 생활·여가 성격의 라이프스타일 거점만(역·병원·대학·업무지구 등 기능시설 제외).
// 표시 전용이라 카테고리 큐레이션도 주관 편집 범주에 속한다.
const HIGHLIGHT_CATEGORIES = new Set(['생활편의', '자연·여가'])

export function nearbyHighlights(
  lat: number,
  lng: number,
  limit = 4,
): NearbyLandmark[] {
  return landmarks
    .map((l) => ({ ...l, distanceM: haversine(lat, lng, l.lat, l.lng) }))
    .filter(
      (l) => HIGHLIGHT_CATEGORIES.has(l.category) && l.distanceM <= l.radiusM,
    )
    .sort((a, b) => a.distanceM - b.distanceM || b.importance - a.importance)
    .slice(0, limit)
}

// 키워드로 거점 찾기(역방향) — 이름·별칭 부분일치, 중요도 높은 순. 지역/근처 검색용.
export function findLandmarks(query: string): Landmark[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return landmarks
    .filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.alias.some((a) => a.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.importance - a.importance)
}

// 좌표가 거점 영향권(radiusM) 안인가 — "○○ 근처" 판정.
export function withinLandmark(lat: number, lng: number, l: Landmark): boolean {
  return haversine(lat, lng, l.lat, l.lng) <= l.radiusM
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10}m`
    : `${(meters / 1000).toFixed(1)}km`
}

// 상세 요약 문구: 가장 두드러진 거점 1~2곳을 이름으로 묶는다. 없으면 null.
export function landmarkSummary(lat: number, lng: number): string | null {
  const near = nearbyLandmarks(lat, lng, 2)
  if (!near.length) return null
  return `${near.map((l) => l.name).join('·')} 인근`
}
