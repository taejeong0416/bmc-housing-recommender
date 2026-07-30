import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve('.')
export const TAG_ROOT = resolve('tag')
export const INPUTS = {
  housings: resolve('frontend/src/generated/housings.json'),
  canonical: resolve('data/out/canonical.json'),
  gis: resolve('data/out/gis.json'),
  parks: resolve('tag/data/external/busan_urban_parks.csv'),
  rail: resolve('tag/data/external/busan_rail_stations.json'),
  busStops: resolve('tag/data/external/busan_bus_stops.json'),
  publicSports: resolve('tag/data/external/busan_public_sports.json'),
  medical: resolve('tag/data/external/busan_medical_facilities_20260630.json'),
  universities: resolve(
    'tag/data/external/busan_university_campuses_2025.json',
  ),
  manifest: resolve('tag/data/external/manifest.json'),
  noticeRules: resolve('tag/data/contracts/notice_rules.json'),
}
export const OUTPUT_DIR = resolve('tag/output')

export const assert = (condition, message) => {
  if (!condition) throw new Error(`[tag-pipeline] ${message}`)
}

export const clamp01 = (value) => Math.max(0, Math.min(1, value))
export const round = (value, digits = 4) =>
  value == null ? null : Number(Number(value).toFixed(digits))

export const sha256 = (buffer) =>
  createHash('sha256').update(buffer).digest('hex')

export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

export const readJsonIfExists = async (path, fallback = null) => {
  try {
    return await readJson(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

export const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export const isRealHousing = (housing) =>
  !String(housing?.id ?? '').startsWith('demo-') &&
  Number.isFinite(housing?.lat) &&
  Number.isFinite(housing?.lng)

export const isMainModule = (metaUrl) =>
  process.argv[1] != null && resolve(process.argv[1]) === fileURLToPath(metaUrl)

export const haversine = (aLat, aLng, bLat, bLng) => {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export const pointMeasure = (
  lat,
  lng,
  points,
  { radiusMeters, decayMeters, depthDecay = 0.85, saturation = 1 },
) => {
  const distances = points
    .map((point) => ({
      point,
      meters: haversine(lat, lng, point.lat, point.lng),
    }))
    .filter(({ meters }) => Number.isFinite(meters))
    .sort((left, right) => left.meters - right.meters)
  const nearby = distances.filter(({ meters }) => meters <= radiusMeters)
  const accessibility = nearby.reduce(
    (sum, { meters }, index) =>
      sum + depthDecay ** index * (1 / (1 + meters / decayMeters)),
    0,
  )
  return {
    score: round(clamp01(1 - Math.exp(-accessibility / saturation))),
    accessibility: round(accessibility, 6),
    countWithinRadius: nearby.length,
    nearestMeters: distances.length ? Math.round(distances[0].meters) : null,
    nearestName: distances[0]?.point?.name ?? null,
    distanceType: 'straight',
    radiusMeters,
  }
}

/** 수만 건 POI를 후보마다 전수 탐색하지 않도록 약 1.1km 격자로 색인한다. */
export const createPointIndex = (points, cellDegrees = 0.01) => {
  const buckets = new Map()
  for (const point of points) {
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) continue
    const x = Math.floor(point.lng / cellDegrees)
    const y = Math.floor(point.lat / cellDegrees)
    const key = `${x}:${y}`
    const rows = buckets.get(key) ?? []
    rows.push(point)
    buckets.set(key, rows)
  }
  return { buckets, cellDegrees }
}

export const queryPointIndex = (index, lat, lng, radiusMeters) => {
  const latDegrees = radiusMeters / 111_000
  const lngDegrees =
    radiusMeters / Math.max(1, 111_000 * Math.cos((lat * Math.PI) / 180))
  const minX = Math.floor((lng - lngDegrees) / index.cellDegrees)
  const maxX = Math.floor((lng + lngDegrees) / index.cellDegrees)
  const minY = Math.floor((lat - latDegrees) / index.cellDegrees)
  const maxY = Math.floor((lat + latDegrees) / index.cellDegrees)
  const rows = []
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      rows.push(...(index.buckets.get(`${x}:${y}`) ?? []))
    }
  }
  return rows
}

export const pointInRing = (lng, lat, ring) => {
  if (!Array.isArray(ring) || ring.length < 3) return false
  let inside = false
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current++
  ) {
    const [currentLng, currentLat] = ring[current]
    const [previousLng, previousLat] = ring[previous]
    const crosses = currentLat > lat !== previousLat > lat
    if (!crosses) continue
    const intersectionLng =
      ((previousLng - currentLng) * (lat - currentLat)) /
        (previousLat - currentLat) +
      currentLng
    if (lng < intersectionLng) inside = !inside
  }
  return inside
}

export const containingGrid = (lat, lng, grids) =>
  grids.find(
    (grid) => Array.isArray(grid.ring) && pointInRing(lng, lat, grid.ring),
  ) ?? null

export const empiricalCdf = (value, population) => {
  const finite = population.filter(Number.isFinite).sort((a, b) => a - b)
  if (!Number.isFinite(value) || !finite.length) return null
  if (finite.length === 1) return 0.5
  const less = finite.filter((candidate) => candidate < value).length
  const equal = finite.filter((candidate) => candidate === value).length
  return round((less + Math.max(0, equal - 1) / 2) / (finite.length - 1))
}

export const empiricalCdfSorted = (value, finiteSorted) => {
  if (!Number.isFinite(value) || !finiteSorted.length) return null
  if (finiteSorted.length === 1) return 0.5
  const lowerBound = (target, strictGreater = false) => {
    let low = 0
    let high = finiteSorted.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (
        finiteSorted[mid] < target ||
        (strictGreater && finiteSorted[mid] === target)
      ) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    return low
  }
  const less = lowerBound(value)
  const lessOrEqual = lowerBound(value, true)
  const equal = lessOrEqual - less
  return round((less + Math.max(0, equal - 1) / 2) / (finiteSorted.length - 1))
}

export const geometricMean = (values, weights = null) => {
  if (
    !values.length ||
    values.some((value) => value == null || !Number.isFinite(value))
  )
    return null
  const safeValues = values.map((value) => Math.max(0.0001, clamp01(value)))
  const effectiveWeights = weights ?? safeValues.map(() => 1)
  const weightSum = effectiveWeights.reduce((sum, weight) => sum + weight, 0)
  return round(
    Math.exp(
      safeValues.reduce(
        (sum, value, index) => sum + effectiveWeights[index] * Math.log(value),
        0,
      ) / weightSum,
    ),
  )
}

export const weightedMean = (items) => {
  if (
    !items.length ||
    items.some(
      ({ value, weight }) =>
        value == null || !Number.isFinite(value) || !Number.isFinite(weight),
    )
  )
    return null
  const weightSum = items.reduce((sum, { weight }) => sum + weight, 0)
  return round(
    items.reduce((sum, { value, weight }) => sum + value * weight, 0) /
      weightSum,
  )
}

export const verifyManifest = async () => {
  const manifest = await readJson(INPUTS.manifest)
  for (const file of manifest.files ?? []) {
    const bytes = await readFile(resolve(file.path))
    assert(
      sha256(bytes) === file.sha256,
      `외부데이터 SHA-256 불일치: ${file.path}`,
    )
  }
  return manifest
}

export const baseMetadata = (category, inputs, notes = []) => ({
  schemaVersion: 1,
  category,
  generatedAt: new Date().toISOString(),
  spatialTarget: '부산광역시 전체',
  inputs,
  notes,
})
