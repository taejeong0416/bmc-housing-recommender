import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// 설명 전용 표시태그 + 선택형 의료축을 프론트로 이관한다(추천 8축 학습과 분리).
// - university_commercial_area: 카드·상세 배지(대학가 생활권). 추천점수 기여 0.
// - medical_daily_access: 사용자가 '의료 접근 중요'를 명시했을 때만 랭킹 보정(선택형 축).
const D = resolve('tag/output/d-lifestyle-tags.json')
const OUTPUT = resolve('frontend/src/generated/listing-tags.json')

const d = await readFile(D, 'utf8').then(JSON.parse)

const listings = {}
for (const [id, feature] of Object.entries(d.features)) {
  const campus = feature.evidence?.university_commercial_area?.nearestCampus
  const universityCommercialArea = feature.assignedTags?.includes(
    'university_commercial_area',
  )
    ? {
        campusName: campus?.name ?? null,
        meters: campus?.meters ?? null,
      }
    : null
  const medicalDaily =
    typeof feature.scores?.medical_daily_access === 'number'
      ? feature.scores.medical_daily_access
      : null
  listings[id] = { universityCommercialArea, medicalDaily }
}

const universityCount = Object.values(listings).filter(
  (l) => l.universityCommercialArea,
).length

const output = {
  meta: {
    source: 'tag/output/d-lifestyle-tags.json',
    note: '설명 전용 배지·선택형 의료축. 추천 8축 학습(preference-features.json)과 분리.',
    listings: Object.keys(listings).length,
    universityCommercialArea: universityCount,
  },
  listings,
}

await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
console.log(
  `[listing-tags] ${Object.keys(listings).length}개 후보(대학가 생활권 ${universityCount}) → ${OUTPUT}`,
)
