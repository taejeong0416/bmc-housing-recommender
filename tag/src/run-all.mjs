import { resolve } from 'node:path'
import { generateATags } from './a-qualification.mjs'
import { generateBTags } from './b-physical.mjs'
import { generateCTags } from './c-transport.mjs'
import { generateDTags } from './d-lifestyle.mjs'
import { generateCompoundTags } from './compound-tags.mjs'
import { OUTPUT_DIR, verifyManifest, writeJson } from './lib.mjs'

console.log('[tag] 외부데이터 무결성을 확인합니다.')
const manifest = await verifyManifest()

console.log('[tag] A 자격·유형 태그를 계산합니다.')
const a = await generateATags()
console.log('[tag] B 주거물리 태그를 계산합니다.')
const b = await generateBTags()
console.log('[tag] C 입지·교통 태그를 계산합니다.')
const c = await generateCTags()
console.log('[tag] D 생활환경 태그를 계산합니다.')
const d = await generateDTags()
console.log('[tag] 결합태그를 계산합니다.')
const compound = await generateCompoundTags({ a, b, c, d })

const countBy = (values) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [
        value,
        values.filter((candidate) => candidate === value).length,
      ]),
  )

const aFeatures = Object.values(a.features)
const dFeatures = Object.values(d.features)

const summary = {
  generatedAt: new Date().toISOString(),
  spatialTarget: '부산광역시 전체',
  externalManifestVersion: manifest.schemaVersion,
  counts: {
    aHousings: Object.keys(a.features).length,
    aOffers: Object.values(a.features).reduce(
      (sum, feature) => sum + feature.offers.length,
      0,
    ),
    bHousings: Object.keys(b.features).length,
    cHousings: Object.keys(c.features).length,
    dHousings: Object.keys(d.features).length,
    dGisCovered: d.coverageSummary.gisCoveredCandidates,
    dGisMissing: d.coverageSummary.gisMissingCandidates,
    dOfficialUniversityCampuses: d.coverageSummary.officialUniversityCampuses,
    dUniversityWalkAssigned: d.coverageSummary.universityWalkAssigned,
    dUniversityCommercialAreaAssigned:
      d.coverageSummary.universityCommercialAreaAssigned,
    dContextualQuietCovered: dFeatures.filter(
      (feature) => feature.coverage.contextualQuiet,
    ).length,
    preferenceReadyHousings: dFeatures.filter(
      (feature) =>
        feature.coverage.contextualQuiet &&
        feature.coverage.coordinateAccuracy !== 'road_anchor',
    ).length,
    coordinateAccuracy: countBy(
      dFeatures.map((feature) => feature.coverage.coordinateAccuracy),
    ),
    availability: countBy(aFeatures.map((feature) => feature.availability)),
    compoundHousings: Object.keys(compound.features).length,
    assignedCompounds: Object.values(compound.features).reduce(
      (sum, feature) => sum + feature.assignedTags.length,
      0,
    ),
  },
  files: [
    'a-qualification-tags.json',
    'b-physical-tags.json',
    'c-transport-tags.json',
    'd-lifestyle-tags.json',
    'compound-tags.json',
  ].map((file) => resolve(OUTPUT_DIR, file)),
}
await writeJson(resolve(OUTPUT_DIR, 'summary.json'), summary)
console.log('[tag] 완료:', summary.counts)
