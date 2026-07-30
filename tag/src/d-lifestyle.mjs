import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
import {
  INPUTS,
  OUTPUT_DIR,
  baseMetadata,
  containingGrid,
  createPointIndex,
  empiricalCdfSorted,
  geometricMean,
  isMainModule,
  isRealHousing,
  pointMeasure,
  queryPointIndex,
  readJson,
  round,
  weightedMean,
  writeJson,
} from './lib.mjs'

const POI_FEATURES = {
  cafe_choice: {
    label: '카페 선택지 풍부',
    poiTag: 'cafe',
    radiusMeters: 500,
    decayMeters: 250,
    saturation: 3,
    role: 'ranking_feature',
  },
  fitness_access: {
    label: '운동시설 가까움',
    poiTag: 'gym',
    radiusMeters: 800,
    decayMeters: 400,
    saturation: 2,
    role: 'ranking_feature',
  },
  cvs_access: {
    label: '편의점 가까움',
    poiTag: 'cvs',
    radiusMeters: 400,
    decayMeters: 200,
    saturation: 2,
    role: 'explanation_component',
  },
  supermarket_access: {
    label: '마트 가까움',
    poiTag: 'supermarket',
    radiusMeters: 800,
    decayMeters: 400,
    saturation: 2,
    role: 'ranking_feature',
  },
  market_complex_access: {
    label: '시장·종합상가 가까움',
    poiTag: 'market_complex',
    radiusMeters: 1000,
    decayMeters: 500,
    saturation: 1.5,
    role: 'explanation_component',
    available: false,
  },
  laundry_access: {
    label: '세탁·빨래방 가까움',
    poiTag: 'laundry',
    radiusMeters: 600,
    decayMeters: 300,
    saturation: 1.5,
    role: 'explanation_component',
  },
  restaurant_choice: {
    label: '외식 선택지 풍부',
    poiTag: 'restaurant',
    radiusMeters: 800,
    decayMeters: 400,
    saturation: 5,
    role: 'ranking_feature',
  },
  culture_access: {
    label: '문화·여가 가까움',
    poiTag: 'culture',
    radiusMeters: 1200,
    decayMeters: 600,
    saturation: 2,
    role: 'ranking_feature',
  },
  retail_access: {
    label: '생활상권 풍부',
    poiTag: 'shop',
    radiusMeters: 1000,
    decayMeters: 500,
    saturation: 6,
    role: 'derived_explanation_only',
  },
  nightlife_access: {
    label: '밤에도 활기찬 동네',
    poiTag: 'nightlife',
    radiusMeters: 500,
    decayMeters: 250,
    saturation: 3,
    role: 'opposite_axis_evidence',
  },
}

const MEDICAL_FEATURES = {
  pharmacy_access: {
    label: '약국 가까움',
    facilityKind: 'pharmacy',
    radiusMeters: 800,
    decayMeters: 400,
    saturation: 3.5,
    role: 'medical_component',
    assignmentThreshold: 0.65,
  },
  primary_care_access: {
    label: '일차의료 가까움',
    facilityKind: 'primary_care',
    radiusMeters: 1000,
    decayMeters: 500,
    saturation: 4,
    role: 'medical_component',
    assignmentThreshold: 0.65,
  },
  emergency_access: {
    label: '응급의료기관 접근',
    facilityKind: 'emergency',
    radiusMeters: 5000,
    decayMeters: 2500,
    depthDecay: 0.25,
    saturation: 1,
    role: 'conditional_ranking_feature',
    assignmentThreshold: 0.6,
  },
}

const PARK_CONFIG = {
  radiusMeters: 800,
  decayMeters: 400,
  saturation: 1.5,
}

const UNIVERSITY_CONFIG = {
  radiusMeters: 1200,
  decayMeters: 600,
  depthDecay: 0.5,
  saturation: 0.7,
  proximityAssignmentThreshold: 0.43,
  commercialAssignmentThreshold: 0.56,
  commercialComponentMinimum: 0.6,
  commercialNearestMaximumMeters: 900,
}

const UNIVERSITY_LIFE_WEIGHTS = {
  cafe_choice: 0.3,
  restaurant_choice: 0.3,
  cvs_access: 0.2,
  laundry_access: 0.1,
  culture_access: 0.1,
}

const uniqueBy = (values, key) => [
  ...new Map(values.map((value) => [key(value), value])).values(),
]

const parseParks = (buffer) =>
  uniqueBy(
    parse(buffer.toString('utf8'), {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
      .map((row) => ({
        id: row['관리번호'],
        name: row['공원명'],
        type: row['공원구분'],
        areaM2: Number(row['공원면적']) || null,
        lat: Number(row['위도']),
        lng: Number(row['경도']),
        referenceDate: row['데이터기준일자'],
      }))
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng)),
    (park) => park.id || `${park.name}|${park.lat}|${park.lng}`,
  )

export const generateDTags = async ({
  outputPath = resolve(OUTPUT_DIR, 'd-lifestyle-tags.json'),
} = {}) => {
  const [housings, gis, parksBuffer, publicSports, medical, universities] =
    await Promise.all([
      readJson(INPUTS.housings),
      readJson(INPUTS.gis),
      readFile(INPUTS.parks),
      readJson(INPUTS.publicSports),
      readJson(INPUTS.medical),
      readJson(INPUTS.universities),
    ])
  const candidates = housings.filter(isRealHousing)
  const parks = parseParks(parksBuffer)
  const uniquePois = uniqueBy(
    gis.pois ?? [],
    (poi) =>
      `${poi.tag}|${poi.storeId ?? `${poi.category}|${poi.name ?? ''}|${poi.lng}|${poi.lat}`}`,
  )
  const poisByTag = Object.fromEntries(
    [...new Set(uniquePois.map((poi) => poi.tag))].map((tag) => [
      tag,
      uniquePois.filter((poi) => poi.tag === tag),
    ]),
  )
  const sourcePopulations = (gis.densityGrids ?? [])
    .map((grid) => Number(grid.pop))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const fitnessPoints = uniqueBy(
    [...(poisByTag.gym ?? []), ...publicSports],
    (point) =>
      `${point.storeId ?? point.name ?? ''}|${Number(point.lat).toFixed(5)}|${Number(
        point.lng,
      ).toFixed(5)}`,
  )
  const indexes = Object.fromEntries(
    Object.entries(POI_FEATURES)
      .filter(([, config]) => config.available !== false)
      .map(([id, config]) => [
        id,
        createPointIndex(
          id === 'fitness_access'
            ? fitnessPoints
            : (poisByTag[config.poiTag] ?? []),
        ),
      ]),
  )
  const parkIndex = createPointIndex(parks)
  const universityCampuses = uniqueBy(
    universities.campuses ?? [],
    (campus) => campus.id,
  )
  const universityIndex = createPointIndex(universityCampuses)
  const universityCovered =
    universities?.metadata?.spatialTarget === '부산광역시 전체' &&
    universityCampuses.length > 0
  const medicalByKind = Object.fromEntries(
    Object.values(MEDICAL_FEATURES).map((config) => [
      config.facilityKind,
      uniqueBy(
        (medical.facilities ?? []).filter(
          (facility) => facility.kind === config.facilityKind,
        ),
        (facility) => facility.id,
      ),
    ]),
  )
  const medicalIndexes = Object.fromEntries(
    Object.entries(MEDICAL_FEATURES).map(([id, config]) => [
      id,
      createPointIndex(medicalByKind[config.facilityKind] ?? []),
    ]),
  )
  const medicalCovered = medical?.metadata?.spatialTarget === '부산광역시 전체'

  const rows = candidates.map((housing) => {
    const densityGrid = containingGrid(
      housing.lat,
      housing.lng,
      gis.densityGrids ?? [],
    )
    const zoneGrid = containingGrid(
      housing.lat,
      housing.lng,
      gis.zoneGrids ?? [],
    )
    const poiCovered = Boolean(
      gis?.metadata?.spatialTarget === '부산광역시 전체',
    )
    const contextCovered = Boolean(densityGrid && zoneGrid)
    const measures = Object.fromEntries(
      Object.entries(POI_FEATURES).map(([id, config]) => {
        if (!poiCovered || config.available === false) return [id, null]
        const points = queryPointIndex(
          indexes[id],
          housing.lat,
          housing.lng,
          config.radiusMeters,
        )
        return [id, pointMeasure(housing.lat, housing.lng, points, config)]
      }),
    )
    const medicalMeasures = Object.fromEntries(
      Object.entries(MEDICAL_FEATURES).map(([id, config]) => {
        if (!medicalCovered) return [id, null]
        const points = queryPointIndex(
          medicalIndexes[id],
          housing.lat,
          housing.lng,
          config.radiusMeters,
        )
        return [id, pointMeasure(housing.lat, housing.lng, points, config)]
      }),
    )
    const park = pointMeasure(
      housing.lat,
      housing.lng,
      queryPointIndex(
        parkIndex,
        housing.lat,
        housing.lng,
        PARK_CONFIG.radiusMeters,
      ),
      PARK_CONFIG,
    )
    const universityWalk = universityCovered
      ? pointMeasure(
          housing.lat,
          housing.lng,
          queryPointIndex(
            universityIndex,
            housing.lat,
            housing.lng,
            UNIVERSITY_CONFIG.radiusMeters,
          ),
          UNIVERSITY_CONFIG,
        )
      : null
    const populationCdf = densityGrid
      ? empiricalCdfSorted(Number(densityGrid.pop), sourcePopulations)
      : null
    const residential = zoneGrid?.zoneType?.includes('주거') ?? false
    const zoneQuiet = residential ? 1 : 0
    const quiet =
      contextCovered && measures.nightlife_access
        ? weightedMean([
            { value: 1 - measures.nightlife_access.score, weight: 0.5 },
            { value: 1 - populationCdf, weight: 0.3 },
            { value: zoneQuiet, weight: 0.2 },
          ])
        : null
    const scores = Object.fromEntries(
      Object.keys(POI_FEATURES).map((id) => [id, measures[id]?.score ?? null]),
    )
    for (const id of Object.keys(MEDICAL_FEATURES)) {
      scores[id] = medicalMeasures[id]?.score ?? null
    }
    scores.university_walk_access = universityWalk?.score ?? null
    scores.university_life_mix =
      poiCovered &&
      Object.keys(UNIVERSITY_LIFE_WEIGHTS).every(
        (id) => measures[id]?.score != null,
      )
        ? weightedMean(
            Object.entries(UNIVERSITY_LIFE_WEIGHTS).map(([id, weight]) => ({
              value: measures[id].score,
              weight,
            })),
          )
        : null
    scores.university_commercial_area =
      scores.university_walk_access == null ||
      scores.university_life_mix == null
        ? null
        : [scores.university_walk_access, scores.university_life_mix].includes(
              0,
            )
          ? 0
          : geometricMean(
              [scores.university_walk_access, scores.university_life_mix],
              [0.55, 0.45],
            )
    const dailyMedicalComponents = [
      scores.pharmacy_access,
      scores.primary_care_access,
    ]
    scores.medical_daily_access = dailyMedicalComponents.includes(0)
      ? 0
      : geometricMean(dailyMedicalComponents)
    scores.quiet_residential = quiet
    scores.park_walk = park.score

    const assignedTags = Object.entries(POI_FEATURES)
      .filter(
        ([id]) =>
          scores[id] != null &&
          scores[id] >= 0.65 &&
          measures[id]?.countWithinRadius > 0,
      )
      .map(([id]) => id)
    for (const [id, config] of Object.entries(MEDICAL_FEATURES)) {
      if (
        scores[id] != null &&
        scores[id] >= config.assignmentThreshold &&
        medicalMeasures[id]?.countWithinRadius > 0
      ) {
        assignedTags.push(id)
      }
    }
    if (
      scores.medical_daily_access != null &&
      scores.medical_daily_access >= 0.65 &&
      Math.min(scores.pharmacy_access, scores.primary_care_access) >= 0.55 &&
      medicalMeasures.pharmacy_access?.countWithinRadius > 0 &&
      medicalMeasures.primary_care_access?.countWithinRadius > 0
    ) {
      assignedTags.push('medical_daily_access')
    }
    if (quiet != null && quiet >= 0.55 && residential) {
      assignedTags.push('quiet_residential')
    }
    if (
      park.score >= 0.65 &&
      park.nearestMeters != null &&
      park.nearestMeters <= PARK_CONFIG.radiusMeters
    ) {
      assignedTags.push('park_walk')
    }
    if (
      scores.university_walk_access != null &&
      scores.university_walk_access >=
        UNIVERSITY_CONFIG.proximityAssignmentThreshold &&
      universityWalk.nearestMeters != null &&
      universityWalk.nearestMeters <=
        UNIVERSITY_CONFIG.commercialNearestMaximumMeters
    ) {
      assignedTags.push('university_walk_access')
    }
    if (
      scores.university_commercial_area != null &&
      scores.university_commercial_area >=
        UNIVERSITY_CONFIG.commercialAssignmentThreshold &&
      scores.university_life_mix >=
        UNIVERSITY_CONFIG.commercialComponentMinimum &&
      scores.university_walk_access >=
        UNIVERSITY_CONFIG.proximityAssignmentThreshold &&
      universityWalk.nearestMeters != null &&
      universityWalk.nearestMeters <=
        UNIVERSITY_CONFIG.commercialNearestMaximumMeters
    ) {
      assignedTags.push('university_commercial_area')
    }
    return [
      housing.id,
      {
        name: housing.name,
        address: housing.address,
        coverage: {
          gisLifestyle: poiCovered,
          medicalOfficial: medicalCovered,
          universityOfficial: universityCovered,
          contextualQuiet: contextCovered,
          park: true,
          coordinateAccuracy: housing.coordinateAccuracy ?? 'unknown',
          densityGridId: densityGrid?.gridId ?? null,
          zoneGridId: zoneGrid?.gridId ?? null,
        },
        scores,
        assignedTags,
        evidence: {
          ...measures,
          ...medicalMeasures,
          medical_daily_access:
            scores.medical_daily_access == null
              ? null
              : {
                  score: scores.medical_daily_access,
                  formula: 'sqrt(pharmacy_access × primary_care_access)',
                  pharmacyAccess: scores.pharmacy_access,
                  primaryCareAccess: scores.primary_care_access,
                },
          quiet_residential:
            quiet == null
              ? null
              : {
                  score: quiet,
                  inverseNightlife: round(1 - measures.nightlife_access.score),
                  inversePopulationCdf: round(1 - populationCdf),
                  zoneQuiet,
                  population: densityGrid?.pop ?? null,
                  zoneType: zoneGrid?.zoneType ?? null,
                },
          park_walk: park,
          university_walk_access: universityWalk,
          university_life_mix:
            scores.university_life_mix == null
              ? null
              : {
                  score: scores.university_life_mix,
                  formula:
                    '0.30×카페 + 0.30×외식 + 0.20×편의점 + 0.10×세탁 + 0.10×문화',
                  components: Object.fromEntries(
                    Object.keys(UNIVERSITY_LIFE_WEIGHTS).map((id) => [
                      id,
                      scores[id],
                    ]),
                  ),
                },
          university_commercial_area:
            scores.university_commercial_area == null
              ? null
              : {
                  score: scores.university_commercial_area,
                  formula:
                    '대학대표점 접근성(55%)과 학생생활형 상권구성(45%)의 가중 기하평균',
                  campusAccess: scores.university_walk_access,
                  studentLifeMix: scores.university_life_mix,
                  nearestCampus:
                    universityWalk?.nearestName == null
                      ? null
                      : {
                          name: universityWalk.nearestName,
                          meters: universityWalk.nearestMeters,
                        },
                },
        },
      },
    ]
  })
  const features = Object.fromEntries(rows)
  const coveredCount = rows.filter(
    ([, feature]) => feature.coverage.gisLifestyle,
  ).length

  const result = {
    metadata: baseMetadata(
      'D_생활환경',
      [
        INPUTS.housings,
        INPUTS.gis,
        INPUTS.parks,
        INPUTS.publicSports,
        INPUTS.medical,
        INPUTS.universities,
      ],
      [
        '2024년 부산 전체 GIS를 사용하며 좌표가 확보된 실제 후보만 계산한다.',
        'POI 접근성과 조용함의 격자인구·용도지역 결측을 분리한다.',
        '후보 백분위 대신 고정 거리감쇠·포화함수를 사용한다.',
        '조용함은 실측 소음이 아니라 야간업종·격자인구·용도지역을 결합한 대리지표다.',
        'BSST_YN은 버스정류장 여부이므로 조용함·상권형성 계산에 쓰지 않는다.',
        '시장·종합상가 직접 분류가 없어 market_complex_access는 null로 비활성화한다.',
        '공원은 부산 전체 공식 데이터라 GIS 샘플 범위와 무관하게 계산한다.',
        '의료는 심평원 2026년 6월 부산 전체 공식 좌표를 사용한다.',
        '일차의료는 의원·보건소·보건지소·보건진료소만 포함하고 치과·한의원·요양병원은 섞지 않는다.',
        '응급의료는 특수진료정보의 응급의료기관 분류이며 실시간 운영·수용 가능 여부를 보장하지 않는다.',
        '의료 선호는 자격·연령으로 자동 추정하지 않고 사용자가 명시한 경우에만 개인화 가중치를 활성화한다.',
        '대학상권은 공식 대학 대표주소 접근성과 카페·외식·편의점·세탁·문화 POI 구성을 함께 충족할 때만 부여한다.',
        '대학 캠퍼스는 대학원·사이버대학·폐교·과거 통합 학교를 제외한 부산 대면 대학·전문대학 대표주소 25곳이다.',
        '대학상권은 캠퍼스 경계·출입구·학생수·유동인구를 직접 측정한 값이 아니므로 설명용 파생태그로만 사용하고 독립 개인화 가중치를 두지 않는다.',
        '분기도로 기준점(road_anchor) 후보도 설명값은 계산하지만 고신뢰 개인화 랭킹에서는 제외한다.',
      ],
    ),
    definitions: {
      ...Object.fromEntries(
        Object.entries(POI_FEATURES).map(([id, config]) => [
          id,
          {
            label: config.label,
            role: config.role,
            available: config.available !== false,
            radiusMeters: config.radiusMeters,
            formula:
              '시설 거리감쇠 합을 feature별 고정 포화함수 1-exp(-x/saturation)로 0~1 변환',
          },
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(MEDICAL_FEATURES).map(([id, config]) => [
          id,
          {
            label: config.label,
            role: config.role,
            available: true,
            radiusMeters: config.radiusMeters,
            assignmentThreshold: config.assignmentThreshold,
            source: '건강보험심사평가원 전국 병의원 및 약국 현황 2026.6',
            formula:
              '공식 의료시설 거리감쇠 합을 고정 포화함수 1-exp(-x/saturation)로 0~1 변환',
            caution:
              id === 'emergency_access'
                ? '응급의료기관 지정과 직선거리이며 실시간 진료·수용 가능 여부는 아니다.'
                : '직선거리이며 실제 보행거리·진료시간·진료과목은 반영하지 않는다.',
          },
        ]),
      ),
      medical_daily_access: {
        label: '일상 의료 접근이 편리함',
        role: 'conditional_ranking_feature',
        formula: 'pharmacy_access와 primary_care_access의 기하평균',
        assignmentThreshold: 0.65,
        activation:
          '항상 산출·설명하되 사용자가 의료 접근을 명시적으로 중요하게 선택한 경우에만 개인화 점수에 반영',
      },
      quiet_residential: {
        label: '조용한 주거환경',
        role: 'ranking_feature',
        formula:
          '0.5×(1-야간활기) + 0.3×(1-원천 격자인구 CDF) + 0.2×주거용도 점수',
        assignmentThreshold: 0.55,
        caution: '소음 측정값이 아니므로 “조용함 추정”으로 표시한다.',
      },
      park_walk: {
        label: '공원 산책 가까움',
        role: 'ranking_feature',
        radiusMeters: PARK_CONFIG.radiusMeters,
        caution: '공원 출입구·보행경로·품질이 아닌 대표 좌표 직선거리다.',
      },
      university_walk_access: {
        label: '대학 캠퍼스 가까움',
        role: 'explanation_component',
        available: true,
        radiusMeters: UNIVERSITY_CONFIG.radiusMeters,
        assignmentThreshold: UNIVERSITY_CONFIG.proximityAssignmentThreshold,
        source: '한국대학교육협의회 전국대학및전문대학정보표준데이터 2025',
        formula:
          '대학 대표주소 직선거리의 거리감쇠 합을 고정 포화함수로 0~1 변환',
        caution:
          '캠퍼스 경계·출입구·보행경로가 아닌 학교 대표주소 점까지의 직선거리다.',
      },
      university_life_mix: {
        label: '학생생활형 상권 구성',
        role: 'derived_explanation_component',
        formula: '0.30×카페 + 0.30×외식 + 0.20×편의점 + 0.10×세탁 + 0.10×문화',
        caution:
          '업종 구성의 대리지표이며 학생 이용률이나 유동인구를 직접 측정하지 않는다.',
      },
      university_commercial_area: {
        label: '대학가 생활권',
        role: 'derived_explanation_only',
        formula:
          'university_walk_access와 university_life_mix의 가중 기하평균(0.55:0.45)',
        assignmentThreshold: UNIVERSITY_CONFIG.commercialAssignmentThreshold,
        componentMinimum: UNIVERSITY_CONFIG.commercialComponentMinimum,
        nearestCampusMaximumMeters:
          UNIVERSITY_CONFIG.commercialNearestMaximumMeters,
        scoreContribution: 0,
        caution:
          '기존 카페·외식·편의점·세탁·문화 점수와 중복되므로 별도 개인화 가중치로 다시 더하지 않는다.',
      },
    },
    coverageSummary: {
      candidates: candidates.length,
      gisCoveredCandidates: coveredCount,
      gisMissingCandidates: candidates.length - coveredCount,
      sourcePois: uniquePois.length,
      sourceDensityGrids: gis.densityGrids?.length ?? 0,
      sourceZoneGrids: gis.zoneGrids?.length ?? 0,
      officialParks: parks.length,
      officialPublicSports: publicSports.length,
      officialMedicalFacilities: medical.facilities?.length ?? 0,
      officialPrimaryCare: medicalByKind.primary_care?.length ?? 0,
      officialPharmacies: medicalByKind.pharmacy?.length ?? 0,
      officialEmergency: medicalByKind.emergency?.length ?? 0,
      officialUniversityCampuses: universityCampuses.length,
      universityCoordinateMissing:
        universities?.metadata?.counts?.coordinateMissing ?? null,
      universityWalkAssigned: rows.filter(([, feature]) =>
        feature.assignedTags.includes('university_walk_access'),
      ).length,
      universityCommercialAreaAssigned: rows.filter(([, feature]) =>
        feature.assignedTags.includes('university_commercial_area'),
      ).length,
    },
    features,
  }
  await writeJson(outputPath, result)
  return result
}

if (isMainModule(import.meta.url)) {
  await generateDTags()
}
