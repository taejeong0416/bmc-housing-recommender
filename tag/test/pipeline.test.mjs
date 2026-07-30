import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const load = (file) =>
  readFile(new URL(`../${file}`, import.meta.url), 'utf8').then(JSON.parse)

test('A는 공고 규칙이 없을 때 자격을 임의 확정하지 않는다', async () => {
  const result = await load('output/a-qualification-tags.json')
  const offers = Object.values(result.features).flatMap(
    (feature) => feature.offers,
  )
  assert.ok(offers.length > 0)
  assert.ok(offers.every((offer) => offer.eligibility.status === 'unverified'))
  assert.equal(
    Object.values(result.features).filter(
      (feature) => feature.availability === 'upcoming_application',
    ).length,
    6,
  )
})

test('A는 공고의 주택 범위와 공급트랙을 가격행 단위로 구분한다', async () => {
  const result = await load('output/a-qualification-tags.json')
  const noticeHousingCounts = {}
  const offers = Object.values(result.features).flatMap(
    (feature) => feature.offers,
  )
  for (const feature of Object.values(result.features)) {
    for (const notice of feature.noticeMatch) {
      noticeHousingCounts[notice.noticeId] =
        (noticeHousingCounts[notice.noticeId] ?? 0) + 1
    }
  }
  assert.deepEqual(noticeHousingCounts, {
    'BMC-2026-153': 6,
    'BMC-2026-50': 256,
    'BMC-2026-120': 19,
    'BMC-2025-213': 7,
    'BMC-2025-301': 1,
  })
  for (const offer of offers.filter((candidate) => candidate.rank)) {
    assert.ok(
      offer.matchedTrackIds.every(
        (trackId) =>
          !trackId.startsWith('rank_') || trackId === `rank_${offer.rank}`,
      ),
    )
  }
  const integrated = Object.values(result.features).find(
    (feature) => feature.rentalType === '통합공공임대',
  )
  assert.ok(integrated)
  assert.ok(
    integrated.offers.every(
      (offer) =>
        offer.matchedNoticeIds.includes('BMC-2025-301') &&
        offer.trackSelectionRequired &&
        offer.possibleTrackIds.length === 4,
    ),
  )
})

test('A는 모든 실제 매물에 사용자 표시용 자격요건과 공식 근거를 제공한다', async () => {
  const result = await load('output/a-qualification-tags.json')
  const features = Object.values(result.features)
  assert.equal(features.length, 355)
  assert.ok(
    features.every(
      (feature) =>
        feature.qualificationDisplay?.modelRole === 'hard_filter_only' &&
        feature.qualificationDisplay?.routes?.length > 0 &&
        feature.qualificationDisplay.routes.every(
          (route) =>
            route.aRentalTypeTagId.startsWith('rental_') &&
            (route.commonRequirements.length > 0 ||
              route.tracks.length > 0 ||
              route.incomeTables.length > 0),
        ) &&
        feature.qualificationDisplay.routes.every((route) =>
          route.commonRequirements.every(
            (requirement) =>
              typeof requirement.aRuleId === 'string' &&
              requirement.aRuleId.startsWith('a3:'),
          ),
        ) &&
        feature.qualificationDisplay.routes.every((route) =>
          route.tracks.every(
            (track) =>
              track.aTargetTagIds.length > 0 &&
              track.aTargetTagIds.every((tagId) =>
                tagId.startsWith('target_'),
              ) &&
              track.requirements.every(
                (requirement) =>
                  typeof requirement.aRuleId === 'string' &&
                  requirement.aRuleId.startsWith('a3:'),
              ),
          ),
        ) &&
        feature.qualificationDisplay.routes.every(
          (route) =>
            typeof route.source?.officialUrl === 'string' &&
            route.source.officialUrl.startsWith('https://') &&
            route.source.officialSearchUrl.includes('boardId=BBS_0000004') &&
            typeof route.source.localOfficialDocument === 'string' &&
            route.source.localOfficialDocument.length > 0,
        ),
    ),
  )
  assert.equal(
    features.filter(
      (feature) =>
        feature.qualificationDisplay.coverage === 'type_standard_only',
    ).length,
    76,
  )
  assert.equal(
    features.filter(
      (feature) => feature.qualificationDisplay.coverage === 'matched_notice',
    ).length,
    279,
  )
})

test('A1~A4는 공고·공급트랙·공급행 범위를 보존해 자격정보와 연결된다', async () => {
  const result = await load('output/a-qualification-tags.json')
  const features = Object.values(result.features)
  assert.ok(
    features.every(
      (feature) =>
        feature.aTags?.modelRole === 'hard_filter_only' &&
        feature.aTags.scope === 'notice_route_and_offer' &&
        feature.aTags.a1RentalType.tagId.startsWith('rental_') &&
        feature.aTags.routes.length ===
          feature.qualificationDisplay.routes.length &&
        feature.aTags.a4OfferEligibility.length === feature.offers.length,
    ),
  )
  for (const feature of features) {
    for (const route of feature.aTags.routes) {
      assert.ok(route.a1RentalTypeTagId.startsWith('rental_'))
      assert.ok(
        route.a2SupplyTracks.every(
          (track) =>
            track.targetTagIds.length > 0 &&
            track.targetTagIds.every((tagId) => tagId.startsWith('target_')),
        ),
      )
      assert.ok(
        route.a3QualificationRules.commonRuleIds.every((ruleId) =>
          ruleId.startsWith('a3:'),
        ),
      )
      assert.ok(
        route.a3QualificationRules.incomeRuleIds.every((ruleId) =>
          ruleId.startsWith('a3:income:'),
        ),
      )
      assert.ok(
        route.a3QualificationRules.assetRuleIds.every((ruleId) =>
          ruleId.startsWith('a3:asset:'),
        ),
      )
    }
    assert.ok(
      feature.aTags.a4OfferEligibility.every(
        (offer) => offer.status === 'unverified',
      ),
    )
  }
  const integrated = features.find(
    (feature) => feature.rentalType === '통합공공임대',
  )
  assert.ok(
    integrated.aTags.a4OfferEligibility.every(
      (offer) => offer.trackSelectionRequired,
    ),
  )
})

test('B는 비정상 주차비율을 unknown으로 격리한다', async () => {
  const result = await load('output/b-physical-tags.json')
  const anomalies = Object.values(result.features).filter((feature) =>
    feature.qualityFlags.includes('PARKING_RATIO_SCOPE_OR_DENOMINATOR_ANOMALY'),
  )
  assert.ok(anomalies.length >= 1)
  assert.ok(
    anomalies.every(
      (feature) =>
        feature.raw.parkingPerHousehold === null &&
        feature.tags.parking === 'parking_unknown',
    ),
  )
  assert.equal(
    Object.values(result.features).reduce(
      (sum, feature) => sum + feature.unitFacts.length,
      0,
    ),
    9022,
  )
  const futureDate = Object.values(result.features).find(
    (feature) => feature.raw.builtDate === '2032-10-31',
  )
  assert.ok(futureDate)
  assert.equal(futureDate.raw.buildingAgeYears, null)
  assert.equal(futureDate.tags.ageBand, null)
  assert.ok(futureDate.qualityFlags.includes('FUTURE_OR_INVALID_BUILT_DATE'))
})

test('C 원천은 동해선과 부산김해경전철을 포함한다', async () => {
  const [stations, result] = await Promise.all([
    load('data/external/busan_rail_stations.json'),
    load('output/c-transport-tags.json'),
  ])
  assert.ok(stations.some((station) => station.mode === 'donghae'))
  assert.ok(stations.some((station) => station.mode === 'bgl'))
  assert.equal(result.sourceSummary.donghaeComplexes, 23)
  assert.equal(result.sourceSummary.bglComplexes, 21)
})

test('C/D 산출에는 가상 매물이 없고 수영구 밖 실제 매물도 유지된다', async () => {
  const [c, d] = await Promise.all([
    load('output/c-transport-tags.json'),
    load('output/d-lifestyle-tags.json'),
  ])
  assert.ok(Object.keys(c.features).every((id) => !id.startsWith('demo-')))
  assert.ok(Object.keys(d.features).every((id) => !id.startsWith('demo-')))
  assert.ok(
    Object.values(c.features).some(
      (feature) => !feature.address.includes('수영구'),
    ),
  )
  assert.equal(Object.keys(c.features).length, 355)
  assert.equal(Object.keys(d.features).length, 355)
  assert.ok(
    Object.values(c.features).every((feature) =>
      ['exact_address', 'road_nearest', 'road_anchor'].includes(
        feature.coverage.coordinateAccuracy,
      ),
    ),
  )
})

test('D는 부산 전체 POI를 계산하고 격자 미포함 조용함만 결측으로 남긴다', async () => {
  const result = await load('output/d-lifestyle-tags.json')
  assert.equal(result.coverageSummary.gisMissingCandidates, 0)
  assert.ok(
    Object.values(result.features).every((feature) =>
      Number.isFinite(feature.scores.cafe_choice),
    ),
  )
  const contextualMissing = Object.values(result.features).filter(
    (feature) => !feature.coverage.contextualQuiet,
  )
  assert.ok(contextualMissing.length > 0)
  for (const feature of contextualMissing) {
    assert.equal(feature.scores.quiet_residential, null)
    assert.ok(Number.isFinite(feature.scores.park_walk))
  }
  assert.equal(result.definitions.market_complex_access.available, false)
  assert.ok(result.metadata.notes.some((note) => note.includes('BSST_YN')))
})

test('D 의료 태그는 심평원 부산 공식 분류와 좌표로 계산한다', async () => {
  const result = await load('output/d-lifestyle-tags.json')
  assert.equal(result.coverageSummary.officialPrimaryCare, 2743)
  assert.equal(result.coverageSummary.officialPharmacies, 1733)
  assert.equal(result.coverageSummary.officialEmergency, 29)
  assert.equal(
    result.definitions.medical_daily_access.role,
    'conditional_ranking_feature',
  )
  const features = Object.values(result.features)
  assert.ok(features.every((feature) => feature.coverage.medicalOfficial))
  for (const id of [
    'pharmacy_access',
    'primary_care_access',
    'emergency_access',
    'medical_daily_access',
  ]) {
    assert.ok(
      features.every((feature) => Number.isFinite(feature.scores[id])),
      `${id} 점수 결측`,
    )
    const assigned = features.filter((feature) =>
      feature.assignedTags.includes(id),
    ).length
    assert.ok(assigned > 0 && assigned < features.length)
  }
  assert.ok(
    result.metadata.notes.some((note) =>
      note.includes('사용자가 명시한 경우에만'),
    ),
  )
})

test('결합태그는 설명 전용이며 누락값을 0으로 대체하지 않는다', async () => {
  const result = await load('output/compound-tags.json')
  for (const feature of Object.values(result.features)) {
    assert.equal(feature.modelRole, 'explanation_only_score_contribution_zero')
    for (const compound of Object.values(feature.compounds)) {
      const hasMissing = Object.values(compound.components).some(
        (value) => value === null,
      )
      if (hasMissing) {
        assert.equal(compound.score, null)
        assert.equal(compound.assigned, false)
      }
    }
  }
})
