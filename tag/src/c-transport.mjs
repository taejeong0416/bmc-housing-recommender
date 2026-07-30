import { resolve } from 'node:path'
import {
  INPUTS,
  OUTPUT_DIR,
  baseMetadata,
  isMainModule,
  isRealHousing,
  pointMeasure,
  readJson,
  writeJson,
} from './lib.mjs'

const RAIL_CONFIG = {
  radiusMeters: 800,
  decayMeters: 400,
  saturation: 1,
}
const TRANSFER_CONFIG = {
  radiusMeters: 1000,
  decayMeters: 500,
  saturation: 1,
}
const BUS_STOP_CONFIG = {
  radiusMeters: 400,
  decayMeters: 200,
  saturation: 2,
}

const canonicalStationName = (name = '') =>
  String(name)
    .replace(/\([^)]*호선\)$/, '')
    .replace(/역$/, '')
    .trim()

const groupStations = (rows) => {
  const byName = new Map()
  for (const row of rows) {
    const name = canonicalStationName(row.name)
    byName.set(name, [...(byName.get(name) ?? []), row])
  }
  const grouped = []
  for (const [name, sameNameRecords] of byName) {
    const transferRecords = sameNameRecords.filter((row) => row.transfer)
    const nonTransferRecords = sameNameRecords.filter((row) => !row.transfer)
    if (transferRecords.length) grouped.push([name, transferRecords])
    for (const record of nonTransferRecords) grouped.push([name, [record]])
  }
  return grouped.map(([name, records]) => ({
    name: `${name}역`,
    lat:
      records.reduce((sum, row) => sum + row.lat, 0) /
      Math.max(1, records.length),
    lng:
      records.reduce((sum, row) => sum + row.lng, 0) /
      Math.max(1, records.length),
    lines: [...new Set(records.map((row) => row.lineName))],
    modes: [...new Set(records.map((row) => row.mode))],
    transfer: records.some((row) => row.transfer),
    records,
  }))
}

export const generateCTags = async ({
  outputPath = resolve(OUTPUT_DIR, 'c-transport-tags.json'),
} = {}) => {
  const [housings, railRows, busStops] = await Promise.all([
    readJson(INPUTS.housings),
    readJson(INPUTS.rail),
    readJson(INPUTS.busStops),
  ])
  const candidates = housings.filter(isRealHousing)
  const stations = groupStations(railRows)
  const metroStations = stations.filter((station) =>
    station.modes.includes('metro'),
  )
  const donghaeStations = stations.filter((station) =>
    station.modes.includes('donghae'),
  )
  const bglStations = stations.filter((station) =>
    station.modes.includes('bgl'),
  )
  const transferStations = stations.filter((station) => station.transfer)

  const features = Object.fromEntries(
    candidates.map((housing) => {
      const rail = pointMeasure(housing.lat, housing.lng, stations, RAIL_CONFIG)
      const metro = pointMeasure(
        housing.lat,
        housing.lng,
        metroStations,
        RAIL_CONFIG,
      )
      const donghae = pointMeasure(
        housing.lat,
        housing.lng,
        donghaeStations,
        RAIL_CONFIG,
      )
      const bgl = pointMeasure(
        housing.lat,
        housing.lng,
        bglStations,
        RAIL_CONFIG,
      )
      const transfer = pointMeasure(
        housing.lat,
        housing.lng,
        transferStations,
        TRANSFER_CONFIG,
      )
      const bus = pointMeasure(
        housing.lat,
        housing.lng,
        busStops,
        BUS_STOP_CONFIG,
      )
      const badges = []
      if (rail.nearestMeters != null && rail.nearestMeters <= 400) {
        badges.push('rail_walk_400')
      } else if (rail.nearestMeters != null && rail.nearestMeters <= 800) {
        badges.push('rail_walk_800')
      }
      if (donghae.nearestMeters != null && donghae.nearestMeters <= 800) {
        badges.push('donghae_walk_800')
      }
      if (bgl.nearestMeters != null && bgl.nearestMeters <= 800) {
        badges.push('bgl_walk_800')
      }
      if (
        transfer.nearestMeters != null &&
        transfer.nearestMeters <= TRANSFER_CONFIG.radiusMeters
      ) {
        badges.push('rail_transfer_walk_1000')
      }
      if (bus.nearestMeters != null && bus.nearestMeters <= 300) {
        badges.push('bus_stop_walk_300')
      }
      return [
        housing.id,
        {
          name: housing.name,
          address: housing.address,
          coverage: {
            coordinateAccuracy: housing.coordinateAccuracy ?? 'unknown',
          },
          scores: {
            rail_access: rail.score,
            metro_access: metro.score,
            donghae_access: donghae.score,
            bgl_access: bgl.score,
            transfer_access: transfer.score,
            bus_stop_proximity: bus.score,
          },
          badges,
          evidence: { rail, metro, donghae, bgl, transfer, bus },
        },
      ]
    }),
  )

  const result = {
    metadata: baseMetadata(
      'C_입지교통',
      [INPUTS.housings, INPUTS.rail, INPUTS.busStops],
      [
        '수영구 필터를 두지 않고 좌표가 있는 부산 전체 후보를 계산한다.',
        '후보 내 백분위 대신 고정 거리감쇠식을 써서 후보 수가 바뀌어도 같은 거리가 같은 점수를 갖는다.',
        '동해선과 부산김해경전철을 포함한다.',
        '버스정류소 접근은 노선·배차 정보가 없으므로 추천가중치가 아니라 표시·근거용이다.',
        '선도소프트 상가-건물의 정확주소 좌표가 없는 주택은 동일도로 인접점(road_nearest) 또는 분기도로 기준점(road_anchor)을 별도 표시한다.',
        'road_anchor는 C 값을 생성하되 건물의 정확 위치로 해석하거나 고신뢰 개인화 랭킹에 사용하지 않는다.',
      ],
    ),
    definitions: {
      rail_access: {
        label: '도시철도 접근성',
        role: 'ranking_feature',
        coverage: '부산 1~4호선 + 동해선 + 부산김해경전철',
        formula:
          '반경 800m 역사 거리감쇠 합을 고정 포화함수 1-exp(-x)로 0~1 변환',
      },
      metro_access: {
        label: '부산도시철도 접근성',
        role: 'explanation_component',
      },
      donghae_access: {
        label: '동해선 접근성',
        role: 'explanation_component',
      },
      bgl_access: {
        label: '부산김해경전철 접근성',
        role: 'explanation_component',
      },
      transfer_access: {
        label: '환승역 접근성',
        role: 'secondary_explanation',
        caution: 'rail_access와 중복 합산하지 않는다.',
      },
      bus_stop_proximity: {
        label: '버스정류소 가까움',
        role: 'display_and_seed_only',
        caution:
          '정류소 수만으로 노선 다양성·배차·첫차·막차를 알 수 없어 버스 편리로 표현하지 않는다.',
      },
      badges: {
        rail_walk_400: '도시철도 도보권 400m',
        rail_walk_800: '도시철도 도보권 800m',
        donghae_walk_800: '동해선 도보권',
        bgl_walk_800: '부산김해경전철 도보권',
        rail_transfer_walk_1000: '환승역 1km권',
        bus_stop_walk_300: '버스정류소 300m권',
      },
    },
    sourceSummary: {
      stationRows: railRows.length,
      stationComplexes: stations.length,
      metroComplexes: metroStations.length,
      donghaeComplexes: donghaeStations.length,
      bglComplexes: bglStations.length,
      transferComplexes: transferStations.length,
      busStops: busStops.length,
      candidates: candidates.length,
    },
    features,
  }
  await writeJson(outputPath, result)
  return result
}

if (isMainModule(import.meta.url)) {
  await generateCTags()
}
