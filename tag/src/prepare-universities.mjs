import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assert, isMainModule, readJson, writeJson } from './lib.mjs'

const ROOT = resolve('.')
const DEFAULT_SOURCE = resolve(
  ROOT,
  'tag/data/external/raw/national_universities_20260318.json',
)
const DEFAULT_GIS = resolve(ROOT, 'data/out/gis.json')
const DEFAULT_OUTPUT = resolve(
  ROOT,
  'tag/data/external/busan_university_campuses_2025.json',
)

const OFFICIAL_SOURCE_URL =
  'https://www.data.go.kr/data/15107736/standard.do?recommendDataYn=Y'

/**
 * 최신 표준데이터에 남아 있지만 현재 학생 생활권을 만들지 않는 과거 학교 레코드다.
 * 이름만 보고 추정하지 않도록 제외 사유와 공식 확인 URL을 함께 고정한다.
 */
const EXCLUDED_LEGACY_SCHOOLS = new Map([
  [
    '동부산대학교',
    {
      reason: '교육부 학교폐쇄 명령에 따라 2020-08-31 폐쇄',
      sourceUrl:
        'https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=81517&lev=0&m=020402&opType=N&s=moe&statusYN=W',
    },
  ],
  [
    '성심외국어대학',
    {
      reason: '2002년 폐지 및 영산대학교와 통합 인가된 과거 학교명',
      sourceUrl: 'https://www.ysu.ac.kr/kor/CMS/HistoryMgr/list.do?mCode=MN222',
    },
  ],
])

const normalizeAddress = (value = '') =>
  String(value)
    .normalize('NFC')
    .replace(/^대한민국\s+/, '')
    .replace(/^부산시\s+/, '부산광역시 ')
    .replace(/\([^)]*\)\s*$/, '')
    .replace(/[,\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const addressIndex = (addressPoints) => {
  const index = new Map()
  for (const point of addressPoints ?? []) {
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) continue
    for (const address of [point.roadAddress, point.parcelAddress]) {
      if (!address) continue
      index.set(normalizeAddress(address), {
        lat: Number(point.lat),
        lng: Number(point.lng),
        matchedAddress:
          point.roadAddress || point.parcelAddress || normalizeAddress(address),
      })
    }
  }
  return index
}

const selectedPhysicalCampus = (row) =>
  row.CTPV_NM === '부산광역시' &&
  ['대학', '전문대학'].includes(row.UNIV_SE_NM) &&
  !String(row.SCHL_SE_NM).includes('사이버') &&
  !EXCLUDED_LEGACY_SCHOOLS.has(row.SCHL_NM)

const campusId = (row) =>
  [
    row.SCHL_NM,
    row.MAINBRANCH_NM,
    normalizeAddress(row.LCTN_ROAD_NM_ADDR || row.LCTN_LOTNO_ADDR),
  ]
    .join('|')
    .normalize('NFC')

export const prepareUniversities = async ({
  sourcePath = DEFAULT_SOURCE,
  gisPath = DEFAULT_GIS,
  outputPath = DEFAULT_OUTPUT,
} = {}) => {
  const [rawBytes, gis] = await Promise.all([
    readFile(sourcePath),
    readJson(gisPath),
  ])
  const sourceRows = JSON.parse(rawBytes.toString('utf8'))
  assert(Array.isArray(sourceRows), '대학 표준데이터가 배열이 아니다.')

  const busanRows = sourceRows.filter((row) => row.CTPV_NM === '부산광역시')
  const physicalRows = busanRows.filter(selectedPhysicalCampus)
  const coordinates = addressIndex(gis.addressPoints)
  const missingCoordinates = []

  const campuses = [
    ...new Map(
      physicalRows.map((row) => {
        const roadAddress = normalizeAddress(row.LCTN_ROAD_NM_ADDR)
        const parcelAddress = normalizeAddress(row.LCTN_LOTNO_ADDR)
        const coordinate =
          coordinates.get(roadAddress) ?? coordinates.get(parcelAddress)
        if (!coordinate) {
          missingCoordinates.push({
            name: row.SCHL_NM,
            roadAddress,
            parcelAddress,
          })
        }
        const record = {
          id: campusId(row),
          name: row.SCHL_NM,
          campusDivision: row.MAINBRANCH_NM || null,
          universityType: row.UNIV_SE_NM,
          schoolType: row.SCHL_SE_NM,
          foundationType: row.FNDN_FORM_SE_NM || null,
          roadAddress: roadAddress || null,
          parcelAddress: parcelAddress || null,
          lat: coordinate?.lat ?? null,
          lng: coordinate?.lng ?? null,
          coordinateSource: coordinate
            ? 'sundo_store_building_exact_address'
            : 'missing',
          coordinateAccuracy: coordinate ? 'exact_address' : 'unknown',
          referenceYear: row.CRTR_YR || null,
          referenceDate: row.CRTR_YMD || null,
          officialSource: '한국대학교육협의회 전국대학및전문대학정보표준데이터',
        }
        return [record.id, record]
      }),
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name, 'ko'))

  assert(
    missingCoordinates.length === 0,
    `부산 대학 대표주소 좌표 결측 ${missingCoordinates.length}건: ${missingCoordinates
      .map((row) => row.name)
      .join(', ')}`,
  )
  assert(
    campuses.every(
      (campus) =>
        campus.lat >= 34.8 &&
        campus.lat <= 35.8 &&
        campus.lng >= 128.5 &&
        campus.lng <= 129.5,
    ),
    '부산권 범위를 벗어난 대학 좌표가 있다.',
  )

  const result = {
    metadata: {
      schemaVersion: 1,
      dataName: '부산 대면 대학·전문대학 대표 캠퍼스 정규화본',
      spatialTarget: '부산광역시 전체',
      officialSourceUrl: OFFICIAL_SOURCE_URL,
      provider: '한국대학교육협의회',
      sourceReferenceYear: '2025',
      sourceReferenceDate: '2026-03-18',
      normalizationVersion: 1,
      coordinateSource:
        '선도소프트 상가건물 도로명·지번주소의 정확주소 좌표 결합',
      counts: {
        nationalRows: sourceRows.length,
        busanRows: busanRows.length,
        selectedPhysicalCampuses: campuses.length,
        excludedGraduateSchools: busanRows.filter(
          (row) => row.UNIV_SE_NM === '대학원',
        ).length,
        excludedCyberUniversities: busanRows.filter((row) =>
          String(row.SCHL_SE_NM).includes('사이버'),
        ).length,
        excludedLegacySchools: busanRows.filter((row) =>
          EXCLUDED_LEGACY_SCHOOLS.has(row.SCHL_NM),
        ).length,
        coordinateMissing: missingCoordinates.length,
      },
      exclusions: [
        {
          rule: '대학구분명이 대학원인 레코드',
          reason: '학부 생활권과 중복되고 대학원별 중복 레코드가 많아 제외',
        },
        {
          rule: '학교구분명이 사이버대학인 레코드',
          reason: '온라인 중심 학교 주소는 학생 유동·상권을 대표하지 않아 제외',
        },
        ...[...EXCLUDED_LEGACY_SCHOOLS.entries()].map(([name, detail]) => ({
          rule: `학교명=${name}`,
          ...detail,
        })),
      ],
      limitations: [
        '공식 표준데이터의 학교 대표주소를 사용하므로 한 대학의 비공식·부속·별도 캠퍼스를 모두 포괄하지 않는다.',
        '캠퍼스 경계나 출입구가 아닌 대표주소 점 좌표이며 실제 보행거리와 학생 수를 직접 측정하지 않는다.',
        '대학상권 판정은 이 좌표만으로 확정하지 않고 주변 학생생활형 POI 구성과 함께 계산한다.',
      ],
    },
    campuses,
  }
  await writeJson(outputPath, result)
  return result
}

if (isMainModule(import.meta.url)) {
  const result = await prepareUniversities()
  console.log('[tag] 부산 대학 대표 캠퍼스:', result.campuses.length)
}
