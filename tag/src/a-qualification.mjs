import { resolve } from 'node:path'
import {
  INPUTS,
  OUTPUT_DIR,
  baseMetadata,
  isMainModule,
  readJson,
  readJsonIfExists,
  writeJson,
} from './lib.mjs'
import { buildQualificationDisplay } from './qualification-display.mjs'

const RENTAL_TYPES = [
  '행복주택',
  '통합공공임대',
  '매입임대',
  '재개발임대',
  '영구임대',
]

const TARGET_ALIASES = [
  ['대학생', ['대학생']],
  ['청년', ['청년']],
  ['신혼·한부모', ['신혼부부', '한부모가족', '신혼', '한부모']],
  ['고령자', ['고령자']],
  ['주거급여수급자', ['주거급여수급자', '주거급여']],
  ['산단근로자', ['산업단지근로자', '산단근로자']],
  ['일반', ['일반공급', '일반']],
]

const normalizeRentalType = (value = '') =>
  RENTAL_TYPES.find((type) => String(value).includes(type)) ?? '기타공공임대'

const targetGroupsFromQualifier = (qualifier = '') => {
  const text = String(qualifier)
  const targets = TARGET_ALIASES.filter(([, aliases]) =>
    aliases.some((alias) => text.includes(alias)),
  ).map(([target]) => target)
  return targets.length ? [...new Set(targets)] : ['기타·공고확인필요']
}

const normalize = (value = '') =>
  String(value)
    .normalize('NFC')
    .replace(/\([^)]*\)/g, '')
    .replace(/^부산광역시\s*/, '')
    .replace(/\s+/g, '')
    .trim()

const compareNumericRule = (actual, operator, expected) => {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return null
  if (operator === '<=') return actual <= expected
  if (operator === '<') return actual < expected
  if (operator === '>=') return actual >= expected
  if (operator === '>') return actual > expected
  if (operator === '==') return actual === expected
  throw new Error(`지원하지 않는 비교연산자: ${operator}`)
}

export const noticeMatchForHousing = (housing, notice) => {
  if (normalizeRentalType(housing.type) !== notice.rentalType) return null
  if (
    notice.complexNames?.length &&
    !notice.complexNames.some(
      (name) => normalize(name) === normalize(housing.name),
    )
  ) {
    return null
  }
  if (
    notice.addressMatchers?.length &&
    !notice.addressMatchers.some((matcher) =>
      normalize(housing.address).includes(normalize(matcher)),
    )
  ) {
    return null
  }
  if (
    notice.districts?.length &&
    !notice.districts.includes(housing.district)
  ) {
    return null
  }
  if (notice.complexNames?.length) return 'complex_name_exact'
  if (notice.addressMatchers?.length) return 'normalized_address_contains'
  if (notice.districts?.length) return 'district_waitlist_scope'
  return 'rental_type'
}

const summarizeNotice = (noticeId, notice) => ({
  noticeId,
  title: notice.title,
  announcementDate: notice.announcementDate,
  applicationStart: notice.applicationStart,
  applicationEnd: notice.applicationEnd,
  statusAsOf: notice.statusAsOf,
  applicationMode: notice.applicationMode,
  unitSelectable: notice.unitSelectable,
  matchBasis: notice.matchBasis ?? null,
  source: notice.source,
  supplyTracks: (notice.tracks ?? []).map((track) => ({
    id: track.id,
    label: track.label,
  })),
})

const availabilityFor = (notices) => {
  if (!notices.length) return 'inventory_only'
  if (notices.some((notice) => notice.statusAsOf === 'open'))
    return 'open_for_application'
  if (notices.some((notice) => notice.statusAsOf === 'upcoming'))
    return 'upcoming_application'
  return 'closed_reference'
}

export const evaluateEligibility = (
  profile,
  noticeRule,
  selectedTracks = [],
  { trackSelectionRequired = false } = {},
) => {
  if (!profile || !noticeRule) {
    return {
      status: 'unverified',
      reasonCodes: ['NOTICE_RULE_OR_USER_PROFILE_MISSING'],
    }
  }
  const rules = [
    ...(noticeRule.commonRules ?? []).map((rule) => ({
      ...rule,
      scope: 'common',
    })),
    ...selectedTracks.flatMap((track) =>
      (track.rules ?? []).map((rule) => ({
        ...rule,
        scope: `track:${track.id}`,
      })),
    ),
  ]
  const checks = []
  for (const rule of rules) {
    let result = null
    if (rule.type === 'number') {
      result = compareNumericRule(
        profile[rule.field],
        rule.operator,
        rule.value,
      )
    } else if (
      rule.type === 'boolean' &&
      typeof profile[rule.field] === 'boolean'
    ) {
      result = profile[rule.field] === rule.value
    } else if (rule.type === 'enum' && profile[rule.field] != null) {
      result = (rule.allowed ?? []).includes(profile[rule.field])
    } else if (rule.type === 'household_size_table') {
      const householdSize = Number(profile.householdSize)
      const threshold = rule.values?.[String(householdSize)]
      result = compareNumericRule(profile[rule.field], rule.operator, threshold)
    } else if (rule.type === 'range_or_social_beginner') {
      const age = Number(profile.age)
      const workYears = Number(profile.socialBeginnerWorkYears)
      const ageKnown = Number.isFinite(age)
      const workKnown = Number.isFinite(workYears)
      if (ageKnown || workKnown) {
        result =
          (ageKnown && age >= rule.min && age <= rule.max) ||
          (workKnown && workYears <= rule.socialBeginnerWorkYearsMax)
      }
    } else if (rule.type === 'track_evidence') {
      const actual = profile[rule.field]
      if (typeof actual === 'boolean') result = actual
      else if (Number.isFinite(actual) && Number.isFinite(rule.value))
        result = actual <= rule.value
    } else if (rule.type === 'same_as_application_district') {
      if (profile[rule.field] != null && profile.applicationDistrict != null) {
        result = profile[rule.field] === profile.applicationDistrict
      }
    }
    const requiresReview = rule.automation !== 'hard' && result !== false
    checks.push({
      ruleId: rule.id ?? rule.field,
      scope: rule.scope,
      automation: rule.automation ?? 'not_declared',
      result:
        result == null
          ? 'unknown'
          : result
            ? requiresReview
              ? 'review_required'
              : 'pass'
            : 'fail',
    })
  }
  for (const track of selectedTracks) {
    if (!track.rules?.length && Object.keys(track).length > 2) {
      checks.push({
        ruleId: 'TRACK_RULE_NOT_NORMALIZED',
        scope: `track:${track.id}`,
        automation: 'manual_review',
        result: 'review_required',
      })
    }
  }
  if (trackSelectionRequired) {
    checks.push({
      ruleId: 'ELIGIBILITY_TRACK_SELECTION_REQUIRED',
      scope: 'track',
      automation: 'user_input_then_official_review',
      result: 'unknown',
    })
  }
  if (checks.some((check) => check.result === 'fail')) {
    return { status: 'ineligible', reasonCodes: ['RULE_FAILED'], checks }
  }
  if (
    checks.some(
      (check) =>
        check.result === 'unknown' || check.result === 'review_required',
    )
  ) {
    return {
      status: 'conditional',
      reasonCodes: ['ADDITIONAL_CONFIRMATION_REQUIRED'],
      checks,
    }
  }
  return {
    status: 'likely_eligible',
    reasonCodes: ['ALL_CODED_RULES_PASSED'],
    checks,
  }
}

const TRACK_TARGET_ALIASES = {
  student: ['대학생', '취업준비생'],
  youth: ['청년', '사회초년생'],
  newlywed_single_parent: ['신혼부부', '예비신혼부부', '한부모'],
  senior: ['고령자'],
  housing_benefit: ['주거급여수급자', '주거급여'],
  general: ['일반'],
}

export const matchingTracksForOffer = (row, notice) => {
  const tracks = notice.tracks ?? []
  if (!tracks.length) return []
  if (row.rank) {
    return tracks.filter((track) => track.id === `rank_${row.rank}`)
  }
  const qualifier = String(row.supplyClass ?? row.qualifier ?? '').normalize(
    'NFC',
  )
  if (!qualifier) return []
  return tracks.filter((track) => {
    const aliases = TRACK_TARGET_ALIASES[track.id] ?? [track.label]
    return aliases.some((alias) => qualifier.includes(alias))
  })
}

const offerNoticeMatches = (row, notices) =>
  notices
    .map((notice) => {
      const selectedTracks = matchingTracksForOffer(row, notice)
      const hasTracks = (notice.tracks ?? []).length > 0
      // 통합공공임대의 가격행은 소득구간·가구원수별 임대료다.
      // 청년/신혼/고령자/일반은 가격행의 속성이 아니라 신청자 자격트랙이다.
      const trackSelectionRequired =
        notice.rentalType === '통합공공임대' && hasTracks
      return {
        notice,
        selectedTracks,
        possibleTracks: trackSelectionRequired ? notice.tracks : selectedTracks,
        trackSelectionRequired,
        compatible:
          !hasTracks || selectedTracks.length > 0 || trackSelectionRequired,
      }
    })
    .filter((match) => match.compatible)

/**
 * 공고 원문에서 만든 설명·판정 데이터를 A1~A4 태그 체계에 연결한다.
 * A2/A3를 단지 단위로 합집합하지 않고 공고(route)·공급트랙 범위를 보존한다.
 */
export const buildATagLinks = ({
  rentalType,
  qualificationDisplay,
  offers,
}) => {
  const routes = qualificationDisplay.routes.map((route) => ({
    routeId: route.id,
    sourceKind: route.kind,
    matchBasis: route.basis,
    availability: route.status,
    a1RentalTypeTagId: route.aRentalTypeTagId,
    a2SupplyTracks: route.tracks.map((track) => ({
      trackId: track.id,
      label: track.label,
      targetTagIds: track.aTargetTagIds,
    })),
    a3QualificationRules: {
      commonRuleIds: route.commonRequirements.map(
        (requirement) => requirement.aRuleId,
      ),
      trackRuleIds: route.tracks.map((track) => ({
        trackId: track.id,
        ruleIds: track.requirements.map((requirement) => requirement.aRuleId),
      })),
      incomeRuleIds: route.incomeTables.map((table) => table.aRuleId),
      assetRuleIds: route.assetLimits.map((limit) => limit.aRuleId),
    },
    source: route.source,
  }))
  return {
    modelRole: 'hard_filter_only',
    scope: 'notice_route_and_offer',
    a1RentalType: {
      tagId: routes[0]?.a1RentalTypeTagId ?? 'rental_other',
      label: rentalType,
    },
    routes,
    a4OfferEligibility: offers.map((offer) => ({
      offerId: offer.offerId,
      status: offer.eligibility.status,
      reasonCodes: offer.eligibility.reasonCodes,
      matchedNoticeIds: offer.matchedNoticeIds,
      matchedTrackIds: offer.matchedTrackIds,
      possibleTrackIds: offer.possibleTrackIds,
      trackSelectionRequired: offer.trackSelectionRequired,
    })),
    policy: {
      missingUserInput: 'unverified',
      excludeOnlyWhen: 'explicit_rule_failure',
      preferenceScoreUsage: false,
    },
  }
}

export const generateATags = async ({
  outputPath = resolve(OUTPUT_DIR, 'a-qualification-tags.json'),
  userProfile = null,
} = {}) => {
  const [housings, noticeRules] = await Promise.all([
    readJson(INPUTS.housings),
    readJsonIfExists(INPUTS.noticeRules, { notices: {} }),
  ])
  const notices = Object.entries(noticeRules.notices ?? {})
  const features = Object.fromEntries(
    housings
      .filter((housing) => !String(housing.id).startsWith('demo-'))
      .map((housing) => {
        const rentalType = normalizeRentalType(housing.type)
        const relevantNotices = notices
          .map(([noticeId, notice]) => ({
            noticeId,
            ...notice,
            matchBasis: noticeMatchForHousing(housing, notice),
          }))
          .filter((notice) => notice.matchBasis != null)
        const noticeSummaries = relevantNotices.map((notice) =>
          summarizeNotice(notice.noticeId, notice),
        )
        const availability = availabilityFor(relevantNotices)
        const rows = housing.pricingRows?.length
          ? housing.pricingRows
          : [
              {
                unitType: null,
                qualifier: '',
                deposit: null,
                rent: null,
              },
            ]
        const offers = rows.map((row, index) => {
          const offerId = `${housing.id}:offer:${index + 1}`
          const compatibleNotices = offerNoticeMatches(row, relevantNotices)
          const primaryMatch = compatibleNotices[0] ?? null
          const noticeTargets = compatibleNotices.flatMap(
            ({ possibleTracks }) => possibleTracks.map((track) => track.label),
          )
          const qualifierTargets = targetGroupsFromQualifier(row.qualifier)
          const supplyTargets = [
            ...new Set(
              qualifierTargets[0] === '기타·공고확인필요' &&
                noticeTargets.length
                ? noticeTargets
                : qualifierTargets,
            ),
          ]
          return {
            offerId,
            rentalType,
            unitType: row.unitType ?? null,
            rank: row.rank ?? null,
            supplyTargets,
            qualifierRaw: row.qualifier || null,
            price: {
              deposit: row.deposit ?? null,
              monthlyRent: row.rent ?? null,
            },
            eligibility: evaluateEligibility(
              userProfile,
              primaryMatch?.notice,
              primaryMatch?.selectedTracks ?? [],
              {
                trackSelectionRequired:
                  primaryMatch?.trackSelectionRequired ?? false,
              },
            ),
            matchedNoticeIds: compatibleNotices.map(
              ({ notice }) => notice.noticeId,
            ),
            matchedTrackIds: compatibleNotices.flatMap(({ selectedTracks }) =>
              selectedTracks.map((track) => track.id),
            ),
            possibleTrackIds: compatibleNotices.flatMap(({ possibleTracks }) =>
              possibleTracks.map((track) => track.id),
            ),
            trackSelectionRequired: compatibleNotices.some(
              ({ trackSelectionRequired }) => trackSelectionRequired,
            ),
            noticeMatchBasis: compatibleNotices.map(({ notice }) => ({
              noticeId: notice.noticeId,
              basis: notice.matchBasis,
              unitSelectable: notice.unitSelectable,
            })),
            availability: availabilityFor(
              compatibleNotices.map(({ notice }) => notice),
            ),
          }
        })
        const qualificationDisplay = buildQualificationDisplay({
          housing,
          rentalType,
          relevantNotices,
          noticeRules,
        })
        return [
          housing.id,
          {
            name: housing.name,
            address: housing.address,
            rentalType,
            availability,
            noticeMatch: noticeSummaries,
            typeStandard: noticeRules.typeStandards?.[rentalType] ?? null,
            aTags: buildATagLinks({
              rentalType,
              qualificationDisplay,
              offers,
            }),
            qualificationDisplay,
            offers,
          },
        ]
      }),
  )
  const result = {
    metadata: baseMetadata(
      'A_자격유형',
      [INPUTS.housings, INPUTS.noticeRules],
      [
        'A는 추천가중치가 아니라 공고·공급트랙 단위 하드필터이다.',
        '공고 규칙 또는 사용자 정보가 없으면 부적격으로 처리하지 않고 unverified를 반환한다.',
        '주택 단위 공고범위와 가격·공급행 단위 공급트랙 연결을 분리하고 matchBasis를 감사필드로 남긴다.',
        '매입임대 순위 공란은 임의 추정하지 않으며 같은 rank_N 트랙에만 연결한다.',
        '통합공공임대 자격트랙은 가격행 속성이 아니므로 신청자가 트랙을 고르기 전까지 trackSelectionRequired로 둔다.',
        '재고(inventory)와 모집공고(availability)를 분리하며 공고 종료 주택을 현재 신청 가능하다고 표시하지 않는다.',
        '일반 매입임대는 구별 대기자 모집이므로 개별 주택 선택 가능으로 표시하지 않는다.',
        '공적자료 확인이 필요한 규칙은 자동 확정하지 않고 conditional/unverified로 남긴다.',
      ],
    ),
    definitions: {
      rentalTypes: RENTAL_TYPES,
      supplyTargets: TARGET_ALIASES.map(([target]) => target),
      eligibilityStates: [
        'likely_eligible',
        'conditional',
        'ineligible',
        'unverified',
      ],
      availabilityStates: [
        'open_for_application',
        'upcoming_application',
        'closed_reference',
        'inventory_only',
      ],
      modelRole: 'hard_filter_only',
    },
    features,
  }
  await writeJson(outputPath, result)
  return result
}

if (isMainModule(import.meta.url)) {
  await generateATags()
}
