import { resolve } from 'node:path'
import {
  INPUTS,
  OUTPUT_DIR,
  baseMetadata,
  isMainModule,
  readJson,
  round,
  writeJson,
} from './lib.mjs'

const DATA_AS_OF = '2026-06-30'
const currentYear = 2026

const areaBand = (area) => {
  if (!Number.isFinite(area)) return null
  if (area < 25) return 'area_under_25'
  if (area < 40) return 'area_25_40'
  if (area < 60) return 'area_40_60'
  return 'area_60_plus'
}

const bandsIntersectingRange = (min, max, classifier) => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  const probes = [min, max]
  if (min < 25 && max >= 25) probes.push(25)
  if (min < 40 && max >= 40) probes.push(40)
  if (min < 60 && max >= 60) probes.push(60)
  return [...new Set(probes.map(classifier).filter(Boolean))]
}

const ageBand = (years) => {
  if (!Number.isFinite(years)) return null
  if (years <= 5) return 'age_0_5'
  if (years <= 10) return 'age_6_10'
  if (years <= 20) return 'age_11_20'
  return 'age_21_plus'
}

const complexSizeBand = (count) => {
  if (!Number.isFinite(count)) return null
  if (count < 50) return 'complex_under_50'
  if (count < 500) return 'complex_50_499'
  return 'complex_500_plus'
}

const parkingBand = (ratio) => {
  if (!Number.isFinite(ratio)) return 'parking_unknown'
  if (ratio >= 1) return 'parking_1_plus'
  if (ratio >= 0.5) return 'parking_0_5_1'
  return 'parking_under_0_5'
}

const buildingAgeYears = (date) => {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  const years = currentYear - parsed.getFullYear()
  return years < 0 ? null : years
}

export const generateBTags = async ({
  outputPath = resolve(OUTPUT_DIR, 'b-physical-tags.json'),
} = {}) => {
  const [housings, canonical] = await Promise.all([
    readJson(INPUTS.housings),
    readJson(INPUTS.canonical),
  ])
  const unitsByComplex = new Map()
  for (const unit of canonical.units ?? []) {
    const rows = unitsByComplex.get(unit.complexId) ?? []
    rows.push(unit)
    unitsByComplex.set(unit.complexId, rows)
  }
  const features = Object.fromEntries(
    housings
      .filter((housing) => !String(housing.id).startsWith('demo-'))
      .map((housing) => {
        const ageYears = buildingAgeYears(housing.builtDate)
        const totalUnits = Number(housing.totalUnits)
        const parkingSpaces = Number(housing.parking)
        const parkingRatio =
          totalUnits > 0 && parkingSpaces >= 0
            ? parkingSpaces / totalUnits
            : null
        const futureBuiltDate =
          housing.builtDate != null &&
          Number(housing.builtDate.slice(0, 4)) > currentYear
        // 재개발 원천의 주차대수는 전체 혼합단지, totalUnits는 BMC 임대호수로
        // 집계 범위가 달라 비율을 만들 수 없다.
        const parkingScopeMismatch = housing.type === '재개발임대'
        const parkingAnomaly =
          parkingScopeMismatch || (parkingRatio != null && parkingRatio > 3)
        const areaBands = bandsIntersectingRange(
          Number(housing.area?.min),
          Number(housing.area?.max),
          areaBand,
        )
        const unitFacts = (unitsByComplex.get(housing.id) ?? []).map((unit) => ({
          dong: unit.dong ?? null,
          ho: unit.ho,
          unitType: unit.unitType ?? null,
          areaM2: unit.areaM2,
          rooms: unit.rooms,
          areaBand: areaBand(unit.areaM2),
        }))
        return [
          housing.id,
          {
            name: housing.name,
            address: housing.address,
            raw: {
              areaMinM2: housing.area?.min ?? null,
              areaMaxM2: housing.area?.max ?? null,
              roomsMin: housing.rooms?.min ?? null,
              roomsMax: housing.rooms?.max ?? null,
              builtDate: housing.builtDate ?? null,
              buildingAgeYears: ageYears,
              totalUnits: Number.isFinite(totalUnits) ? totalUnits : null,
              elevator:
                typeof housing.elevator === 'boolean' ? housing.elevator : null,
              parkingSpaces: Number.isFinite(parkingSpaces)
                ? parkingSpaces
                : null,
              parkingPerHousehold: parkingAnomaly ? null : round(parkingRatio),
              parkingRatioScope:
                parkingScopeMismatch
                  ? 'whole_complex_parking_over_bmc_rental_units'
                  : 'same_complex_scope_assumed',
            },
            tags: {
              areaBands,
              areaBandAmbiguous: areaBands.length > 1,
              roomRange:
                Number.isFinite(housing.rooms?.min) &&
                Number.isFinite(housing.rooms?.max)
                  ? `${housing.rooms.min}_${housing.rooms.max}`
                  : 'rooms_unknown',
              ageBand: ageBand(ageYears),
              complexSizeBand: complexSizeBand(totalUnits),
              elevator:
                housing.elevator === true
                  ? 'elevator_present'
                  : housing.elevator === false
                    ? 'elevator_absent'
                    : 'elevator_unknown',
              parking: parkingAnomaly
                ? 'parking_unknown'
                : parkingBand(parkingRatio),
            },
            unitFacts,
            qualityFlags: [
              ...(areaBands.length > 1 ? ['COMPLEX_LEVEL_AREA_RANGE'] : []),
              ...(parkingAnomaly
                ? ['PARKING_RATIO_SCOPE_OR_DENOMINATOR_ANOMALY']
                : []),
              ...(futureBuiltDate
                ? ['FUTURE_OR_INVALID_BUILT_DATE']
                : []),
              ...(parkingSpaces === 0
                ? ['PARKING_REPORTED_ZERO_NOT_MISSING']
                : []),
              'UNIT_FLOOR_AND_OPTION_DATA_NOT_IN_GENERATED_HOUSING',
            ],
            modelRole: 'hard_filter_fact_or_explicit_tiebreak_only',
          },
        ]
      }),
  )
  const result = {
    metadata: baseMetadata(
      'B_주거물리',
      [INPUTS.housings, INPUTS.canonical],
      [
        '가격·면적·방수는 가능하면 공급호/주택형 단위로 필터링해야 한다.',
        'unitFacts는 2026-06-30 원천의 호별 면적·방수·주택형을 보존하며 하드필터는 이 배열에 적용한다.',
        '단지 범위 면적 밴드는 요약·설명용이고 개별 호의 적합 판정에 쓰지 않는다.',
        '재개발 주차대수는 전체 혼합단지, 세대수는 BMC 임대호수라 분모 범위가 다르므로 비율을 만들지 않는다.',
        '그 밖의 주차대수/세대수 3 초과도 범위 또는 분모 오류 가능성이 있어 unknown으로 격리한다.',
        '기준연도보다 미래인 준공일은 원문을 보존하되 건물연령·연식태그를 만들지 않는다.',
        '주차 0은 결측으로 바꾸지 않고 원천의 보고값 0으로 보존한다.',
      ],
    ),
    definitions: {
      modelRole: 'hard_filter_fact_or_explicit_tiebreak_only',
      dataAsOf: DATA_AS_OF,
      areaBands: ['area_under_25', 'area_25_40', 'area_40_60', 'area_60_plus'],
      ageBands: ['age_0_5', 'age_6_10', 'age_11_20', 'age_21_plus'],
      complexSizeBands: [
        'complex_under_50',
        'complex_50_499',
        'complex_500_plus',
      ],
      parkingBands: [
        'parking_1_plus',
        'parking_0_5_1',
        'parking_under_0_5',
        'parking_unknown',
      ],
      excludedClaims: [
        '가성비',
        '보안안심',
        '자녀키우기좋은',
        '풀옵션(개별 옵션 근거 없이)',
      ],
    },
    features,
  }
  await writeJson(outputPath, result)
  return result
}

if (isMainModule(import.meta.url)) {
  await generateBTags()
}
