import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import shp from 'shpjs'
import { writeJson } from './lib.mjs'

const DATA_DIR = resolve('tag/data/external')

const asFeatureCollection = (value) =>
  Array.isArray(value)
    ? value.flatMap((item) => item.features ?? [])
    : value.features

const busFeatures = asFeatureCollection(
  await shp(await readFile(resolve(DATA_DIR, 'busan_bus_stops_20250121.zip'))),
)
const busStops = busFeatures
  .map((feature) => ({
    id: String(feature.properties?.bstopid ?? ''),
    arsNo: String(feature.properties?.arsno ?? ''),
    name: String(feature.properties?.bstopnm ?? '').trim(),
    type: String(feature.properties?.stoptype ?? '').trim(),
    lng: Number(feature.geometry?.coordinates?.[0]),
    lat: Number(feature.geometry?.coordinates?.[1]),
  }))
  .filter(
    (row) =>
      row.id &&
      row.name &&
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lng),
  )

const sportsFeatures = asFeatureCollection(
  await shp(
    await readFile(resolve(DATA_DIR, 'busan_public_sports_20250414.zip')),
  ),
)
const publicSports = sportsFeatures
  .map((feature) => ({
    id: String(feature.properties?.SKEY ?? feature.properties?.FID ?? ''),
    name: String(feature.properties?.NAME ?? '').trim(),
    facilityType: String(feature.properties?.TYPE_OF_FC ?? '').trim(),
    district: String(feature.properties?.GUGUN ?? '').trim(),
    address: String(
      feature.properties?.ADDRESS || feature.properties?.ADDRESS_JI || '',
    ).trim(),
    referenceDate: String(feature.properties?.DCBYMD ?? '').trim(),
    lng: Number(feature.geometry?.coordinates?.[0]),
    lat: Number(feature.geometry?.coordinates?.[1]),
  }))
  .filter(
    (row) =>
      row.id &&
      row.name &&
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lng),
  )

await writeJson(resolve(DATA_DIR, 'busan_bus_stops.json'), busStops)
await writeJson(resolve(DATA_DIR, 'busan_public_sports.json'), publicSports)
console.log({
  busStops: busStops.length,
  publicSports: publicSports.length,
})
