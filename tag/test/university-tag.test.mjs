import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const load = (file) =>
  readFile(new URL(file, import.meta.url), 'utf8').then(JSON.parse)

test('대학 원천은 부산 대면 대표 캠퍼스 25곳으로 정규화된다', async () => {
  const universities = await load(
    '../data/external/busan_university_campuses_2025.json',
  )
  assert.equal(universities.campuses.length, 25)
  assert.equal(universities.metadata.counts.coordinateMissing, 0)
  assert.ok(
    universities.campuses.every(
      (campus) =>
        campus.coordinateAccuracy === 'exact_address' &&
        !campus.schoolType.includes('사이버') &&
        !['동부산대학교', '성심외국어대학'].includes(campus.name),
    ),
  )
})

test('대학가 생활권은 접근성과 학생생활형 상권을 함께 충족한다', async () => {
  const result = await load('../output/d-lifestyle-tags.json')
  assert.equal(result.coverageSummary.candidates, 355)
  assert.equal(result.coverageSummary.officialUniversityCampuses, 25)
  assert.equal(result.coverageSummary.universityCoordinateMissing, 0)
  assert.equal(
    result.definitions.university_walk_access.role,
    'explanation_component',
  )
  assert.equal(
    result.definitions.university_commercial_area.role,
    'derived_explanation_only',
  )
  assert.equal(
    result.definitions.university_commercial_area.scoreContribution,
    0,
  )

  const features = Object.values(result.features)
  assert.ok(features.every((feature) => feature.coverage.universityOfficial))
  assert.ok(
    features.every(
      (feature) =>
        Number.isFinite(feature.scores.university_walk_access) &&
        Number.isFinite(feature.scores.university_life_mix) &&
        Number.isFinite(feature.scores.university_commercial_area),
    ),
  )

  const walkAssigned = features.filter((feature) =>
    feature.assignedTags.includes('university_walk_access'),
  )
  const commercialAssigned = features.filter((feature) =>
    feature.assignedTags.includes('university_commercial_area'),
  )
  assert.equal(walkAssigned.length, 107)
  assert.equal(commercialAssigned.length, 73)

  for (const feature of commercialAssigned) {
    const evidence = feature.evidence.university_commercial_area
    assert.ok(evidence.nearestCampus.meters <= 900)
    assert.ok(feature.scores.university_walk_access >= 0.43)
    assert.ok(feature.scores.university_life_mix >= 0.6)
    assert.ok(feature.scores.university_commercial_area >= 0.56)
  }
})
