import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useStore } from '../store'
import { useNav } from '../nav'
import { selDef, busanDistricts, roomOpts, advancedSelects } from '../data'
import { useFilterMeta } from '../hooks/useFilterMeta'
import { useHousings } from '../hooks/useHousings'
import {
  ALL_TYPE,
  OPEN_DEPOSIT,
  OPEN_RENT,
  applyPrefs,
  depositCapLabel,
  rentCapLabel,
  type FilterPrefs,
} from '../lib/filter'
import { eligiblePairwiseHousings } from '../onboarding/pairwise'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { MultiSelect } from '../components/ui/MultiSelect'
import { Select } from '../components/ui/Select'
import { Toggle } from '../components/ui/Toggle'
import { toast } from '../components/ui/toastStore'
import type { ArrayKey, StoreState } from '../types'

const MIN_COMPARISON_CANDIDATES = 2
// 신청자격 셀렉트의 '미선택' 센티널 — '해당 없음'(실제 답)과 구분해 필수 입력을 강제한다.
const ELIGIBILITY_PLACEHOLDER = '선택하세요'

export default function SetupScreen() {
  const { state: s, patch } = useStore()
  const { data: meta } = useFilterMeta()
  const { data: housings = [], isLoading: housingsLoading } = useHousings()
  const { go } = useNav()
  // 지역 — 부산 구/군 고정 집합을 다중 선택 드롭다운으로 고른다.
  // 고정 집합에 백엔드가 돌려준 예외 구(집합 밖)만 합집합해 누락을 막는다.
  const districtOptions = [
    ...new Set([...busanDistricts, ...(meta?.districts ?? [])]),
  ].sort()
  // 빈 배열 = 전체(필터 미관여). 각 그룹의 '전체' 칩이 이걸로 초기화한다.
  const clearGroup = (key: ArrayKey) => () =>
    patch({ [key]: [] } as Partial<StoreState>)
  const mkToggle = (selKey: ArrayKey, id: string) => () =>
    patch(
      (st) =>
        ({
          [selKey]: st[selKey].includes(id)
            ? st[selKey].filter((x) => x !== id)
            : [...st[selKey], id],
        }) as Partial<StoreState>,
    )
  const setupSelects = selDef.map(([key, label, options]) => ({
    key,
    label,
    options:
      key === 'rentType'
        ? [ALL_TYPE, ...(meta?.types.length ? meta.types : options)]
        : options,
    value: s[key],
    onChange: (value: string) => patch({ [key]: value } as Partial<StoreState>),
  }))
  const onDeposit = (e: ChangeEvent<HTMLInputElement>) =>
    patch({ depositMax: +e.currentTarget.value })
  const onRent = (e: ChangeEvent<HTMLInputElement>) =>
    patch({ rentMax: +e.currentTarget.value })
  // 신청자격 값은 필터 비관여 — 매입임대 336곳에 공급계층 데이터가 없어 걸러낼 근거가 없다.
  const setAdvanced = (label: string, value: string) =>
    patch((st) => ({ advanced: { ...st.advanced, [label]: value } }))
  // 필터 필드만 memo 키로 — advancedOpen·favorites 등 무관 state 변경엔 재계산하지 않는다.
  const {
    rentType,
    depositMax,
    rentMax,
    regions,
    buildYear,
    area,
    houseTypes,
    elevatorRequired,
    parkingRequired,
  } = s
  const prefs = useMemo<FilterPrefs>(
    () => ({
      rentType,
      depositMax,
      rentMax,
      regions,
      buildYear,
      area,
      houseTypes,
      elevatorRequired,
      parkingRequired,
    }),
    [
      rentType,
      depositMax,
      rentMax,
      regions,
      buildYear,
      area,
      houseTypes,
      elevatorRequired,
      parkingRequired,
    ],
  )
  // 조건을 통과한 실제 후보(생활환경 데이터 유무 무관) — §6.2 '조건 만족 후보 수'.
  const passCandidates = useMemo(
    () => applyPrefs(housings, prefs),
    [housings, prefs],
  )
  // 그중 생활환경 데이터가 있어 비교·추천에 쓸 수 있는 후보 — §6.2 '데이터 보유 후보 수'.
  const comparisonCandidates = useMemo(
    () => eligiblePairwiseHousings(passCandidates),
    [passCandidates],
  )
  const canCompare = comparisonCandidates.length >= MIN_COMPARISON_CANDIDATES

  // 가장 큰 제약 조건(§6.2) — 활성 조건 중 혼자 풀었을 때 후보가 가장 많이 느는 것.
  const biggestConstraint = useMemo(() => {
    const base = passCandidates.length
    const relaxable: { label: string; open: Partial<FilterPrefs> }[] = [
      { label: '지역', open: { regions: [] } },
      { label: '보증금 상한', open: { depositMax: OPEN_DEPOSIT } },
      { label: '월 임대료 상한', open: { rentMax: OPEN_RENT } },
      { label: '임대유형', open: { rentType: ALL_TYPE } },
      { label: '준공연도', open: { buildYear: '제한 없음' } },
      { label: '면적', open: { area: '전체' } },
      { label: '방 구조', open: { houseTypes: [] } },
      { label: '엘리베이터 필수', open: { elevatorRequired: false } },
      { label: '주차 필수', open: { parkingRequired: false } },
    ]
    let best: {
      label: string
      open: Partial<FilterPrefs>
      gain: number
    } | null = null
    for (const r of relaxable) {
      const relaxed = applyPrefs(housings, { ...prefs, ...r.open })
      const gain = relaxed.length - base
      if (gain > 0 && (!best || gain > best.gain)) best = { ...r, gain }
    }
    return best
  }, [housings, prefs, passCandidates.length])
  const resetComparisonFilters = () =>
    patch({
      depositMax: OPEN_DEPOSIT,
      rentMax: OPEN_RENT,
      regions: [],
      rentType: ALL_TYPE,
      buildYear: '제한 없음',
      area: '전체',
      houseTypes: [],
      elevatorRequired: false,
      parkingRequired: false,
    })
  const [showMissing, setShowMissing] = useState(false)
  // 세부 조건은 기본값이 아닐 때만 펼친 채로 시작한다.
  const [detailOpen, setDetailOpen] = useState(
    () => s.buildYear !== '제한 없음' || s.area !== '전체',
  )
  const goSwipe = go('swipe')
  const goMap = go('map')
  // 추천 설정 — 랭킹에 실제로 반영되는 두 스위치. 로그인이 없으므로 이 화면이 유일한 변경 지점.
  const toggleLearning = () => {
    const next = !s.favoriteLearningEnabled
    patch({ favoriteLearningEnabled: next, learningPromptSeen: true })
    toast(next ? '취향 학습을 켰어요' : '취향 학습을 껐어요')
  }
  const toggleMedical = () => {
    const next = !s.medicalPreferred
    patch({ medicalPreferred: next })
    toast(next ? '의료 접근을 추천에 반영해요' : '의료 접근 반영을 껐어요')
  }

  // 비교를 한 번이라도 마친 사용자는 헤더 '취향·조건'으로 조건을 고치러 온 것 — 온보딩 단계 표시를 뺀다.
  const returning = s.comparisonRounds > 0
  // 신청자격은 비교 시작의 선행 필수조건 — 세 항목 모두 선택돼야 통과.
  const missingEligibility = advancedSelects.filter((a) => !s.advanced[a.label])
  // 비교 시작 — 빈 신청 자격이 있으면 막지 않고 첫 빈 칸으로 이동해 알린다.
  const startCompare = () => {
    if (missingEligibility.length > 0) {
      setShowMissing(true)
      document
        .getElementById(eligibilityId(missingEligibility[0].label))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    goSwipe()
  }
  const rentTypeSelect = setupSelects.find((sel) => sel.key === 'rentType')
  const detailSelects = setupSelects.filter((sel) => sel.key !== 'rentType')
  const detailActive = [s.buildYear !== '제한 없음', s.area !== '전체'].filter(
    Boolean,
  ).length

  return (
    <div className="w-full max-w-[720px] animate-rise">
      {!returning && (
        // 진행 헤더 — 필수조건(1) → 가상 생활권 비교(2) → 취향 요약(3)
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-body">
              비교 전 필수조건
            </span>
            <span className="text-[13px] font-bold tabular-nums text-sub">
              1/3 단계
            </span>
          </div>
          <div className="mt-3 flex gap-1.5">
            <span className="h-1 flex-1 rounded-full bg-teal" />
            <span className="h-1 flex-1 rounded-full bg-line" />
            <span className="h-1 flex-1 rounded-full bg-line" />
          </div>
        </div>
      )}

      <h1 className="text-balance text-[26px] font-bold leading-tight text-ink">
        {returning ? '내 조건' : '신청 자격과 주택 조건을 정해주세요'}
      </h1>

      <Card className="mt-6 divide-y divide-line-soft px-5 sm:px-8">
        {/* 신청 자격 — 신청 가능한 공고를 가려내는 필수 선행조건 */}
        <Section
          title="신청 자격"
          badge={<span className="text-[13px] font-bold text-teal">필수</span>}
          sub="정확하지 않아도 괜찮아요. 실제 자격은 BMC 청약센터에서 확인해요."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {advancedSelects.map((a) => {
              const missing = showMissing && !s.advanced[a.label]
              return (
                <div key={a.label} id={eligibilityId(a.label)}>
                  <Field label={a.label} required>
                    <Select
                      options={a.options}
                      value={s.advanced[a.label] ?? ''}
                      placeholder={ELIGIBILITY_PLACEHOLDER}
                      onChange={(v) => setAdvanced(a.label, v)}
                      invalid={missing}
                    />
                  </Field>
                  {missing && (
                    <p
                      role="alert"
                      className="mt-1.5 text-[12.5px] font-semibold text-ink"
                    >
                      {a.label}을 골라 주세요
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="지역과 예산">
          <Field label="지역">
            <MultiSelect
              options={districtOptions}
              value={s.regions}
              onChange={(regions) => patch({ regions })}
              allLabel="부산 전체"
            />
          </Field>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
            <BudgetSlider
              label="보증금 상한"
              value={depositCapLabel(s.depositMax)}
              max={OPEN_DEPOSIT}
              step={100}
              raw={s.depositMax}
              onChange={onDeposit}
            />
            <BudgetSlider
              label="월 임대료 상한"
              value={rentCapLabel(s.rentMax)}
              max={OPEN_RENT}
              step={1}
              raw={s.rentMax}
              onChange={onRent}
            />
          </div>
        </Section>

        <Section title="주택 조건">
          <Field label="방 구조">
            <div className="flex flex-wrap gap-2">
              <Chip
                active={s.houseTypes.length === 0}
                onClick={clearGroup('houseTypes')}
              >
                전체
              </Chip>
              {roomOpts.map((t) => (
                <Chip
                  key={t}
                  active={s.houseTypes.includes(t)}
                  onClick={mkToggle('houseTypes', t)}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rentTypeSelect && (
              <Field label={rentTypeSelect.label}>
                <Select
                  options={rentTypeSelect.options}
                  value={rentTypeSelect.value}
                  onChange={rentTypeSelect.onChange}
                />
              </Field>
            )}
          </div>
          <div className="mt-5">
            <Field label="꼭 있어야 하는 시설">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MustHaveToggle
                  label="엘리베이터"
                  active={s.elevatorRequired}
                  onClick={() =>
                    patch((st) => ({
                      elevatorRequired: !st.elevatorRequired,
                    }))
                  }
                />
                <MustHaveToggle
                  label="주차 1대 이상"
                  active={s.parkingRequired}
                  onClick={() =>
                    patch((st) => ({ parkingRequired: !st.parkingRequired }))
                  }
                />
              </div>
            </Field>
          </div>

          {/* 세부 조건 — 대부분 기본값으로 두는 축은 접어 두고, 적용 중이면 개수를 보인다. */}
          <button
            type="button"
            onClick={() => setDetailOpen((o) => !o)}
            aria-expanded={detailOpen}
            className="mt-5 flex items-center gap-1 py-1 text-[13px] font-bold text-body transition-colors hover:text-teal"
          >
            세부 조건
            {detailActive > 0 && (
              <span className="tabular-nums text-teal">
                {detailActive}개 적용 중
              </span>
            )}
            <span
              className={`ms text-[18px] text-sub transition-transform ${detailOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
          {detailOpen && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {detailSelects.map((sel) => (
                <Field key={sel.label} label={sel.label}>
                  <Select
                    options={sel.options}
                    value={sel.value}
                    onChange={sel.onChange}
                  />
                </Field>
              ))}
            </div>
          )}
        </Section>

        {/* 추천 설정 — 하드필터가 아니라 랭킹 반영 스위치. 비교를 마친 뒤 조건을 고치러 왔을 때만 보인다. */}
        {returning && (
          <Section
            title="추천 설정"
            sub="조건은 그대로 두고 추천 순서만 바꿔요"
          >
            <div className="divide-y divide-line-soft">
              <SettingToggle
                label="취향 학습"
                sub="찜한 집을 보고 추천을 맞춰요"
                on={s.favoriteLearningEnabled}
                onClick={toggleLearning}
              />
              <SettingToggle
                label="의료 접근 중요"
                sub="병원·약국이 가까운 집을 먼저 보여줘요"
                on={s.medicalPreferred}
                onClick={toggleMedical}
              />
            </div>
          </Section>
        )}
      </Card>

      {/* 하단 고정 바 — 맞는 매물 수와 다음 단계. 긴 폼을 내려가도 늘 보인다. */}
      <div className="sticky bottom-4 z-10 mt-4 flex flex-col gap-3 rounded-[16px] border border-line bg-white px-4 py-3 shadow-pop sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">
            {housingsLoading ? (
              '매물을 세는 중이에요…'
            ) : (
              <>
                조건에 맞는 매물{' '}
                <span
                  className={`font-display text-[22px] tabular-nums ${
                    canCompare ? 'text-teal' : 'text-ink'
                  }`}
                >
                  {passCandidates.length}곳
                </span>
              </>
            )}
          </p>
          {!housingsLoading && !canCompare && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[12.5px] text-sub">
                비교하려면 {MIN_COMPARISON_CANDIDATES}곳 이상 필요해요.
              </p>
              {biggestConstraint && (
                <button
                  onClick={() =>
                    patch(biggestConstraint.open as Partial<StoreState>)
                  }
                  className="text-[12.5px] font-bold text-teal hover:text-teal-dark"
                >
                  {biggestConstraint.label} 풀기(+{biggestConstraint.gain}곳)
                </button>
              )}
              <button
                onClick={resetComparisonFilters}
                className="text-[12.5px] font-bold text-sub hover:text-teal"
              >
                전체 초기화
              </button>
            </div>
          )}
        </div>
        {returning ? (
          <div className="grid grid-cols-[2fr_3fr] gap-2 sm:flex">
            <Button
              variant="outline"
              onClick={startCompare}
              disabled={!canCompare || housingsLoading}
              className="whitespace-nowrap rounded-[11px] px-3 py-3 text-[13.5px] sm:px-4"
            >
              취향 비교 다시 하기
            </Button>
            <Button
              onClick={goMap}
              className="whitespace-nowrap rounded-[11px] px-3 py-3 text-[13.5px] sm:px-6 sm:text-[14px]"
            >
              이 조건으로 지도 보기
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[2fr_3fr] gap-2 sm:flex">
            <Button
              variant="outline"
              onClick={goMap}
              className="whitespace-nowrap rounded-[11px] px-3 py-3 text-[13.5px] sm:px-4"
            >
              지도 바로 보기
            </Button>
            <Button
              onClick={startCompare}
              disabled={!canCompare || housingsLoading}
              className="whitespace-nowrap rounded-[11px] px-3 py-3 text-[13.5px] sm:px-6 sm:text-[14px]"
            >
              가상 생활권 비교 시작
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

const eligibilityId = (label: string) => `eligibility-${label}`

function Section({
  title,
  sub,
  badge,
  children,
}: {
  title: string
  sub?: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="py-7">
      <h2 className="flex items-baseline gap-2 text-[18px] font-bold leading-tight text-ink">
        {title}
        {badge}
      </h2>
      {sub && <p className="mt-1 text-[13px] text-sub">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-body">
        {label}
        {required && <span className="ml-0.5 text-teal">*</span>}
      </p>
      {children}
    </div>
  )
}

function MustHaveToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2.5 rounded-[9px] border px-3 py-2.5 text-left text-[14px] transition-colors ${
        active
          ? 'border-teal font-bold text-teal'
          : 'border-line bg-white text-body hover:border-teal/45'
      }`}
    >
      <span
        className={`ms text-[20px] ${active ? 'text-teal' : 'text-faint'}`}
        aria-hidden
      >
        {active ? 'check_box' : 'check_box_outline_blank'}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  )
}

function SettingToggle({
  label,
  sub,
  on,
  onClick,
}: {
  label: string
  sub: string
  on: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-sub">
          {sub}
        </span>
      </span>
      <Toggle on={on} onClick={onClick} ariaLabel={`${label} 켜기/끄기`} />
    </div>
  )
}

function BudgetSlider({
  label,
  value,
  max,
  step,
  raw,
  onChange,
}: {
  label: string
  value: string
  max: number
  step: number
  raw: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-body">{label}</span>
        <span className="text-[13px] font-bold tabular-nums text-teal">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={raw}
        onChange={onChange}
        className="mt-3 w-full accent-teal"
      />
    </div>
  )
}
