const OFFICIAL_NOTICE_SEARCH_URL =
  'https://www.bmc.busan.kr/board/list2.do?boardId=BBS_0000004&menuCd=DOM_000000101001003000&contentsSid=29&cpath='

const RENTAL_TYPE_TAG_IDS = {
  행복주택: 'rental_happy',
  통합공공임대: 'rental_integrated_public',
  매입임대: 'rental_purchase',
  재개발임대: 'rental_redevelopment',
  영구임대: 'rental_permanent',
}

const TARGET_TAG_IDS_BY_TRACK = {
  student: ['target_student'],
  youth: ['target_youth'],
  newlywed_single_parent: [
    'target_newlywed',
    'target_prospective_newlywed',
    'target_single_parent',
  ],
  senior: ['target_senior'],
  housing_benefit: ['target_housing_benefit'],
  general: ['target_general'],
  rank_1: ['target_youth', 'target_low_income'],
  rank_2: ['target_youth'],
  rank_3: ['target_youth'],
  general_rank_1: [
    'target_low_income',
    'target_disabled',
    'target_housing_benefit',
  ],
  general_rank_2: ['target_low_income', 'target_disabled'],
}

const OFFICIAL_INFO_URLS = {
  매입임대: 'https://www.bmc.busan.kr/index.do?menuCd=DOM_000000103002007003',
  행복주택: 'https://www.bmc.busan.kr/index.do?menuCd=DOM_000000103002001003',
  통합공공임대:
    'https://www.bmc.busan.kr/index.do?menuCd=DOM_000000103002013003',
  재개발임대: 'https://www.bmc.busan.kr/index.do?menuCd=DOM_000000103002009002',
}

const OFFICIAL_NOTICE_URLS = {
  'BMC-2026-50':
    'https://bmc.busan.kr/board/view.do?boardId=BBS_0000004&dataSid=800322&menuCd=DOM_000000101001003000',
  'BMC-2026-120':
    'https://apply.bmc.busan.kr/smw/smw113020/selectPbancRentHouseList.do',
  'BMC-2025-213':
    'https://apply.bmc.busan.kr/smw/smw113010/selectPbancDetailView.do?gvPgmId=SMW113010M00&pbancKndCd=01&pbancNo=71',
  'BMC-2025-301':
    'https://apply.bmc.busan.kr/smw/smw113010/selectPbancDetailView.do?pbancNo=75&pbanckndcd=01',
}

const HISTORICAL_PROPERTY_REFERENCES = {
  '시청앞 행복주택 1단지': {
    title: '시청앞 행복주택 1단지 입주자모집 공고문(정정)',
    announcementDate: '2024-10-11',
    localOfficialDocument:
      '최근 공고문(행복주택)/4. 시청앞 행복주택 1단지 입주자모집 공고문(정정)(2024년 10월).hwpx',
    note: '단지별 과거 공고가 확인되며, 화면의 금액 기준은 더 최근 행복주택 기준을 함께 사용한다.',
  },
}

const AUTOMATION_LABELS = {
  hard: '입력값으로 사전 확인',
  hard_then_official_review: '입력 후 공적자료 확인',
  hard_and_manual_branch: '입력 및 증빙 확인',
  manual_review: '서류·공적자료 확인',
  user_input_then_official_review: '공급대상 선택 후 확인',
}

const FIELD_LABELS = {
  adult: '성년 여부',
  householdHousingStatus: '무주택 요건',
  age: '연령',
  applicationsPerHousehold: '중복신청 제한',
  yearsSinceIllegalSublease: '불법전대 제한',
  studentOrGraduateWithinYears: '대학생·취업준비생 요건',
  married: '혼인 여부',
  monthlyIncome: '월평균소득',
  applicantAndParentsMonthlyIncome: '본인·부모 월평균소득',
  applicantMonthlyIncome: '본인 월평균소득',
  applicantAssets: '신청자 총자산',
  householdAssets: '세대 총자산',
  totalAssets: '세대 총자산',
  vehicleValue: '자동차 가액',
  ownsValuedVehicle: '자동차 보유기준',
  housingSubscriptionBeforeMoveIn: '주택청약종합저축',
  familyTrack: '신혼·한부모 계층',
  housingBenefitRecipient: '주거급여 수급 여부',
  homeless: '무주택 여부',
  homelessHousehold: '무주택세대구성원',
  youthTrack: '청년계층',
  welfareTrack: '복지·보호 대상',
  registeredDistrict: '거주지역',
  registeredInBusan: '부산 거주',
  currentPurchaseRentalResident: '기존 매입임대 거주 여부',
  foreignApplicant: '외국인 신청 제한',
}

const ENUM_VALUE_LABELS = {
  homeless_person: '무주택자',
  homeless_household: '무주택세대구성원',
  age_19_39: '만 19~39세',
  student: '대학생',
  job_seeker_graduated_within_2_years: '졸업·중퇴 후 2년 이내 취업준비생',
  livelihood_benefit: '생계급여 수급자',
  medical_benefit: '의료급여 수급자',
  housing_benefit: '주거급여 수급자',
  supported_single_parent: '보호대상 한부모가족',
  near_poor: '차상위계층',
  married_within_7_years: '혼인기간 7년 이내',
  pre_married: '예비신혼부부',
  child_age_6_or_under: '6세 이하 자녀가 있는 혼인가구',
  single_parent_child_age_6_or_under: '6세 이하 자녀를 둔 한부모가족',
}

const MATCH_BASIS_LABELS = {
  complex_name_exact: '단지명이 공고에 명시됨',
  normalized_address_contains: '주소가 공급주택 목록에 명시됨',
  district_waitlist_scope: '자치구 예비입주자 모집 범위',
  rental_type: '임대유형 기준',
}

const STATUS_LABELS = {
  open: '접수 중 공고',
  upcoming: '모집 예정 공고',
  closed: '마감 공고 참고',
  reference: '최근 유형 기준 참고',
}

const APPLICATION_MODE_LABELS = {
  complex_and_unit_type: '단지·주택형 신청',
  one_housing: '공급주택 1곳 선택',
  district_waitlist: '자치구 예비입주자 신청',
  complex_and_unit_type_waitlist: '단지·주택형 예비입주자 신청',
  unit_type_waitlist: '주택형 예비입주자 신청',
  type_standard: '임대유형 공통기준',
}

const money = (value) =>
  Number.isFinite(value)
    ? `${Math.round(value / 10000).toLocaleString()}만원`
    : '-'

const operatorLabel = (operator) =>
  ({
    '<=': '이하',
    '<': '미만',
    '>=': '이상',
    '>': '초과',
    '==': '일치',
  })[operator] ?? ''

const requirement = (rule, detail) => ({
  id: rule.id ?? rule.field,
  aRuleId: `a3:${rule.id ?? rule.field}`,
  label: FIELD_LABELS[rule.field] ?? rule.field,
  detail,
  verification: AUTOMATION_LABELS[rule.automation] ?? '공고 및 제출서류 확인',
  page: rule.page ?? null,
})

const targetTagIdsForTrack = (track) => {
  const exact = TARGET_TAG_IDS_BY_TRACK[track.id]
  if (exact) return exact
  const text = `${track.id} ${track.label}`.normalize('NFC')
  const tags = []
  if (/대학생|취업준비/.test(text)) tags.push('target_student')
  if (/청년|사회초년/.test(text)) tags.push('target_youth')
  if (/신혼/.test(text)) tags.push('target_newlywed')
  if (/예비신혼/.test(text)) tags.push('target_prospective_newlywed')
  if (/한부모/.test(text)) tags.push('target_single_parent')
  if (/고령/.test(text)) tags.push('target_senior')
  if (/주거급여/.test(text)) tags.push('target_housing_benefit')
  if (/장애/.test(text)) tags.push('target_disabled')
  if (/일반/.test(text)) tags.push('target_general')
  return [...new Set(tags.length ? tags : ['target_other'])]
}

const valuesFromTable = (table) => {
  if (Array.isArray(table)) {
    return table.map((maxMonthlyIncome, index) => ({
      householdSize: index + 1,
      maxMonthlyIncome,
    }))
  }
  return Object.entries(table ?? {})
    .filter(
      ([size, value]) =>
        Number.isFinite(Number(size)) && Number.isFinite(value),
    )
    .map(([size, maxMonthlyIncome]) => ({
      householdSize: Number(size),
      maxMonthlyIncome,
    }))
    .sort((left, right) => left.householdSize - right.householdSize)
}

const formatRule = (rule, incomeTables = {}) => {
  if (rule.type === 'boolean') {
    const negativeFields = new Set([
      'married',
      'ownsValuedVehicle',
      'currentPurchaseRentalResident',
      'foreignApplicant',
    ])
    const negative = negativeFields.has(rule.field)
    const positiveDetails = {
      adult: '성년자여야 함(공고가 인정하는 예외는 원문 확인)',
      homeless: '신청자 본인이 무주택자여야 함',
      homelessHousehold:
        '신청자와 해당 세대가 무주택세대구성원 요건을 충족해야 함',
      registeredInBusan: '공고일 현재 부산광역시에 거주해야 함',
      housingSubscriptionBeforeMoveIn:
        '입주 전까지 주택청약종합저축 가입사실을 증명해야 함',
      housingBenefitRecipient: '주거급여 수급자 증빙이 필요함',
    }
    const detail =
      rule.value === false && negative
        ? {
            married: '혼인 중이 아닌 사람',
            ownsValuedVehicle:
              '공고의 자동차 가액기준을 넘는 자동차를 보유하지 않은 사람',
            currentPurchaseRentalResident:
              '현재 부산도시공사 매입임대주택에 거주하지 않는 사람',
            foreignApplicant: '외국인은 신청할 수 없음',
          }[rule.field]
        : rule.value
          ? (positiveDetails[rule.field] ??
            `${FIELD_LABELS[rule.field] ?? rule.field} 요건을 충족해야 함`)
          : `${FIELD_LABELS[rule.field] ?? rule.field}에 해당하지 않아야 함`
    return requirement(rule, detail)
  }
  if (rule.type === 'number') {
    const value =
      /Income|Assets|asset|vehicleValue/.test(rule.field) ||
      ['applicantAssets', 'householdAssets'].includes(rule.field)
        ? money(rule.value)
        : rule.value
    const unit =
      rule.field === 'age'
        ? '세'
        : rule.field === 'applicationsPerHousehold'
          ? '건'
          : rule.field === 'yearsSinceIllegalSublease'
            ? '년'
            : ''
    return requirement(
      rule,
      `${FIELD_LABELS[rule.field] ?? rule.field} ${value}${unit} ${operatorLabel(rule.operator)}`,
    )
  }
  if (rule.type === 'enum') {
    return requirement(
      rule,
      (rule.allowed ?? [])
        .map((value) => ENUM_VALUE_LABELS[value] ?? value)
        .join(' · ') + ' 중 해당',
    )
  }
  if (rule.type === 'household_size_table') {
    const table = rule.values ?? incomeTables[rule.table] ?? {}
    const values = valuesFromTable(table)
    return requirement(
      rule,
      values.length
        ? `가구원수별 월평균소득 상한 적용 (${values
            .slice(0, 3)
            .map(
              ({ householdSize, maxMonthlyIncome }) =>
                `${householdSize}인 ${money(maxMonthlyIncome)}`,
            )
            .join(' · ')}${values.length > 3 ? ' · 자세한 표 아래 확인' : ''})`
        : '가구원수별 소득기준을 공고에서 확인',
    )
  }
  if (rule.type === 'income_ratio') {
    return requirement(
      rule,
      `도시근로자 월평균소득 ${rule.singleIncomePercent}% 이하, 맞벌이 ${rule.dualIncomePercent}% 이하` +
        (rule.twoPersonSingleIncomePercent
          ? ` (2인 가구 ${rule.twoPersonSingleIncomePercent}%, 맞벌이 ${rule.twoPersonDualIncomePercent}%)`
          : ''),
    )
  }
  if (rule.type === 'range_or_social_beginner') {
    return requirement(
      rule,
      `만 ${rule.min}~${rule.max}세 또는 소득이 있는 업무에 종사한 기간 ${rule.socialBeginnerWorkYearsMax}년 이내`,
    )
  }
  if (rule.type === 'track_evidence') {
    return requirement(
      rule,
      `대학 재학·입학·복학 예정자 또는 졸업·중퇴 후 ${rule.value}년 이내 취업준비생`,
    )
  }
  if (rule.type === 'same_as_application_district') {
    return requirement(rule, '공고 대상 자치구에 주민등록이 되어 있어야 함')
  }
  return requirement(rule, rule.note ?? '세부조건은 공고문과 제출서류로 확인')
}

const displayTracksForStandard = (rentalType) => {
  if (rentalType !== '매입임대') return []
  return [
    {
      id: 'general_rank_1',
      label: '일반 매입 1순위',
      aTargetTagIds: TARGET_TAG_IDS_BY_TRACK.general_rank_1,
      requirements: [
        {
          id: 'general_rank_1_group',
          aRuleId: 'a3:general_rank_1_group',
          label: '1순위 대상',
          detail:
            '생계·의료급여 수급자, 보호대상 한부모가족, 주거취약 수급·차상위계층, 65세 이상 수급·차상위계층, 소득 70% 이하 장애인 중 해당',
          verification: '서류·공적자료 확인',
          page: null,
        },
      ],
    },
    {
      id: 'general_rank_2',
      label: '일반 매입 2순위',
      aTargetTagIds: TARGET_TAG_IDS_BY_TRACK.general_rank_2,
      requirements: [
        {
          id: 'general_rank_2_group',
          aRuleId: 'a3:general_rank_2_group',
          label: '2순위 대상',
          detail:
            '도시근로자 월평균소득 50% 이하 또는 소득 100% 이하 장애인 중 해당',
          verification: '소득·장애인 자격 공적자료 확인',
          page: null,
        },
      ],
    },
  ]
}

const normalizeTracks = (definition, incomeTables, rentalType) => {
  const rawTracks = definition.tracks
    ? definition.tracks
    : definition.byTrack
      ? Object.entries(definition.byTrack).map(([id, track]) => ({
          id,
          ...track,
        }))
      : []
  const tracks = rawTracks.map((track) => {
    const supplemental = []
    if (Number.isFinite(track.ageMin) || Number.isFinite(track.ageMax)) {
      supplemental.push({
        id: `${track.id}_age`,
        aRuleId: 'a3:age',
        label: '연령',
        detail:
          Number.isFinite(track.ageMin) && Number.isFinite(track.ageMax)
            ? `만 ${track.ageMin}~${track.ageMax}세`
            : Number.isFinite(track.ageMin)
              ? `만 ${track.ageMin}세 이상`
              : `만 ${track.ageMax}세 이하`,
        verification: '입력값으로 사전 확인',
        page: null,
      })
    }
    if (track.married === false) {
      supplemental.push({
        id: `${track.id}_married`,
        aRuleId: 'a3:marital_requirement',
        label: '혼인 여부',
        detail: '혼인 중이 아닌 사람',
        verification: '입력값 및 가족관계 확인',
        page: null,
      })
    }
    return {
      id: track.id,
      label: track.label,
      aTargetTagIds: targetTagIdsForTrack(track),
      requirements: [
        ...supplemental,
        ...(track.rules ?? []).map((rule) => formatRule(rule, incomeTables)),
      ],
    }
  })
  return tracks.length ? tracks : displayTracksForStandard(rentalType)
}

const normalizeIncomeTables = (incomeTables = {}) =>
  Object.entries(incomeTables).map(([id, table]) => ({
    id,
    aRuleId: `a3:income:${id}`,
    label:
      {
        '50_percent': '도시근로자 월평균소득 50%',
        '70_percent': '도시근로자 월평균소득 70%',
        '80_percent': '도시근로자 월평균소득 80%',
        '90_percent': '도시근로자 월평균소득 90%',
        '100_percent': '도시근로자 월평균소득 100%',
        general_cap_median_150: '기준중위소득 150% 일반공급 상한',
      }[id] ?? id,
    values: valuesFromTable(table),
  }))

const normalizeAssetLimits = (assetLimits) =>
  Object.entries(assetLimits ?? {}).map(([id, values]) => ({
    id,
    aRuleId: `a3:asset:${id}`,
    label:
      {
        base: '기본',
        oneRecentChild: '최근 출생 자녀 1명',
        twoOrMoreRecentChildren: '최근 출생 자녀 2명 이상',
      }[id] ?? id,
    totalAssets: values.totalAssets ?? null,
    vehicle: values.vehicle ?? null,
  }))

const termSummary = (term) => {
  if (!term) return null
  const parts = []
  if (term.contractYears) parts.push(`최초 계약 ${term.contractYears}년`)
  if (term.renewals != null) parts.push(`재계약 ${term.renewals}회`)
  if (term.maxYears) parts.push(`최장 ${term.maxYears}년`)
  if (term.saleConversion === false) parts.push('분양전환 없음')
  return parts.join(' · ') || null
}

const sourceDocumentLabel = (source, sourceOverride) => {
  const value =
    typeof source === 'string'
      ? source
      : (source.localOfficialPdf ??
        source.localNoticeLabel ??
        sourceOverride?.localOfficialDocument ??
        null)
  if (!value) return null
  return String(value).split('/').at(-1)
}

const routeFromDefinition = ({
  id,
  title,
  definition,
  rentalType,
  kind,
  matchBasis = null,
  sourceOverride = null,
}) => {
  const incomeTables =
    definition.incomeTables ??
    (definition.incomeGeneralCapKRW
      ? { general_cap_median_150: definition.incomeGeneralCapKRW }
      : {})
  const status = definition.statusAsOf ?? 'reference'
  const source = sourceOverride ?? definition.source ?? {}
  return {
    id,
    title,
    kind,
    aRentalTypeTagId: RENTAL_TYPE_TAG_IDS[rentalType] ?? 'rental_other',
    basis: matchBasis ?? 'rental_type',
    basisLabel:
      kind === 'type_standard'
        ? '이 임대유형의 최근 기준'
        : (MATCH_BASIS_LABELS[matchBasis] ?? '공고 범위에 포함'),
    status,
    statusLabel: STATUS_LABELS[status] ?? '공고 확인 필요',
    applicationMode: definition.applicationMode ?? 'type_standard',
    applicationModeLabel:
      APPLICATION_MODE_LABELS[definition.applicationMode ?? 'type_standard'] ??
      '공고 확인',
    unitSelectable: definition.unitSelectable ?? null,
    announcementDate: definition.announcementDate ?? null,
    applicationStart: definition.applicationStart ?? null,
    applicationEnd: definition.applicationEnd ?? null,
    commonRequirements: (definition.commonRules ?? []).map((rule) =>
      formatRule(rule, incomeTables),
    ),
    tracks: normalizeTracks(definition, incomeTables, rentalType),
    incomeTables: normalizeIncomeTables(incomeTables),
    assetLimits: normalizeAssetLimits(definition.assetLimits),
    term: termSummary(definition.term),
    note: definition.note ?? null,
    source: {
      officialUrl:
        source.officialUrl ??
        OFFICIAL_NOTICE_URLS[id] ??
        OFFICIAL_INFO_URLS[rentalType] ??
        OFFICIAL_NOTICE_SEARCH_URL,
      officialSearchUrl: OFFICIAL_NOTICE_SEARCH_URL,
      localOfficialDocument: sourceDocumentLabel(source, sourceOverride),
      pages: typeof source === 'string' ? [] : (source.pages ?? []),
    },
  }
}

export const buildQualificationDisplay = ({
  housing,
  rentalType,
  relevantNotices,
  noticeRules,
}) => {
  const typeStandard = noticeRules.typeStandards?.[rentalType] ?? null
  const noticeRoutes = relevantNotices.map((notice) =>
    routeFromDefinition({
      id: notice.noticeId,
      title: notice.title,
      definition: notice,
      rentalType,
      kind: 'matched_notice',
      matchBasis: notice.matchBasis,
    }),
  )
  const standardRoute = typeStandard
    ? routeFromDefinition({
        id: `TYPE-${rentalType}`,
        title: `${rentalType} 최근 유형 기준`,
        definition: typeStandard,
        rentalType,
        kind: 'type_standard',
      })
    : null
  const routes = noticeRoutes.length
    ? noticeRoutes
    : standardRoute
      ? [standardRoute]
      : []
  const historicalReference =
    HISTORICAL_PROPERTY_REFERENCES[housing.name] ?? null
  return {
    modelRole: 'hard_filter_only',
    coverage: noticeRoutes.length ? 'matched_notice' : 'type_standard_only',
    coverageLabel: noticeRoutes.length
      ? '연결 공고 기준'
      : '최근 유형 기준 참고',
    headline: noticeRoutes.length
      ? `${housing.name}에 연결된 공고 자격요건`
      : `${housing.name}의 ${rentalType} 참고 자격요건`,
    summary: noticeRoutes.length
      ? '이 매물이 포함된 모집공고의 공통조건과 공급대상별 조건입니다.'
      : '현재 연결된 모집공고가 없어, 부산도시공사의 최근 동일 유형 기준을 보여드립니다.',
    routes,
    historicalReference: historicalReference
      ? {
          ...historicalReference,
          officialSearchUrl: OFFICIAL_NOTICE_SEARCH_URL,
        }
      : null,
    asOf: noticeRules.asOf ?? null,
    disclaimer:
      noticeRules.disclaimer ??
      '자격정보는 사전 확인용이며 부산도시공사의 최종 심사를 대체하지 않습니다.',
  }
}
