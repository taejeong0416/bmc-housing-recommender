import { useMemo, type ChangeEvent, type ReactNode } from 'react'
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
  type FilterPrefs,
} from '../lib/filter'
import { eligiblePairwiseHousings } from '../onboarding/pairwise'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
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
  // 지역 — 부산 구/군은 고정 집합이라 전부 칩으로 띄우고 탭 토글.
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
  // 신청자격 값은 추천엔진(P3) 전까지 필터 비관여 — 세션 동안 스토어에 보관.
  const setAdvanced = (label: string, value: string) =>
    patch((st) => ({ advanced: { ...st.advanced, [label]: value } }))
  // 신청자격은 비교 시작의 선행 필수조건 — 세 항목 모두 선택돼야 통과.
  const eligibilityComplete = advancedSelects.every(
    (a) => !!s.advanced[a.label],
  )
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

  return (
    <div className="w-full max-w-[860px] animate-rise">
      {/* 서비스 성격 고지 — 첫 화면. 수집하지 않는다는 사실을 들어오자마자 알린다. */}
      <div className="mb-3.5 flex items-start gap-2.5 rounded-[13px] border border-teal/20 bg-teal-ghost px-4 py-3.5">
        <span className="ms mt-px shrink-0 text-[19px] text-teal">
          shield_person
        </span>
        <p className="text-[12.5px] leading-[1.6] text-body">
          <b className="block text-ink">
            시민 개인정보를 수집·보관하지 않습니다.
          </b>
          로그인이 없고, 선택한 조건·취향·관심 목록은 사용자 브라우저에만
          저장되며 서버로 전송되지 않습니다. 실제 청약 신청·자격 조회는 BMC
          청약센터에서 진행해 주세요.
        </p>
      </div>

      <Card className="px-7 py-6">
        {/* 진행 헤더 — 필수조건(1) → 가상 생활권 비교(2) → 취향 요약(3) */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-body">
              비교 전 필수조건
            </span>
            <span className="rounded-full bg-teal-ghost px-2.5 py-1 text-[11.5px] font-bold text-teal">
              1 / 3 단계
            </span>
          </div>
          <div className="mt-3.5 flex gap-1.5">
            <span className="h-[5px] flex-1 rounded-full bg-teal" />
            <span className="h-[5px] flex-1 rounded-full bg-line" />
            <span className="h-[5px] flex-1 rounded-full bg-line" />
          </div>
        </div>

        <h1 className="text-[21px] font-extrabold leading-[1.32] tracking-[-0.4px] text-ink">
          신청 자격과 주택 조건을 정해주세요
        </h1>

        {/* 신청 자격 — 신청 가능한 공고를 가려내는 필수 선행조건 */}
        <section className="mt-6">
          <Head
            icon="verified_user"
            title="신청 자격"
            sub="신청할 수 있는 공고만 추천에 담아요"
            badge={
              <span className="rounded-full bg-teal px-2 py-0.5 text-[10.5px] font-bold text-white">
                필수
              </span>
            }
          />
          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
            {advancedSelects.map((a) => (
              <div key={a.label}>
                <p className="mb-1.5 text-[12.5px] text-sub">{a.label}</p>
                <Select
                  options={a.options}
                  value={s.advanced[a.label] ?? ''}
                  placeholder={ELIGIBILITY_PLACEHOLDER}
                  onChange={(v) => setAdvanced(a.label, v)}
                />
              </div>
            ))}
          </div>
          <p className="mt-3.5 flex items-center gap-1.5 text-[11.5px] leading-relaxed text-sub">
            <span className="ms text-[15px] text-teal">lock</span>
            자격 정보는 신청 가능한 공고를 가려내는 데만 쓰여요.
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* 지역·예산 */}
          <section>
            <Head icon="place" title="지역·예산" sub="어디서 얼마까지 볼까요" />
            <p className="text-[12.5px] text-sub">
              지역 <span className="text-faint">· 중복 선택</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-[7px]">
              <Chip
                active={s.regions.length === 0}
                onClick={clearGroup('regions')}
              >
                전체
              </Chip>
              {districtOptions.map((d) => (
                <Chip
                  key={d}
                  active={s.regions.includes(d)}
                  onClick={mkToggle('regions', d)}
                >
                  {d}
                </Chip>
              ))}
            </div>

            <BudgetSlider
              label="보증금 상한"
              value={`${s.depositMax.toLocaleString()}만원`}
              min={0}
              max={5000}
              step={100}
              raw={s.depositMax}
              onChange={onDeposit}
              maxLabel="5,000만원"
            />
            <BudgetSlider
              label="월 임대료 상한"
              value={`${s.rentMax}만원`}
              min={0}
              max={60}
              step={1}
              raw={s.rentMax}
              onChange={onRent}
              maxLabel="60만원"
            />
          </section>

          {/* 주택 조건 */}
          <section className="md:border-l md:border-line-soft md:pl-8">
            <Head
              icon="home_work"
              title="주택·필수시설"
              sub="양보하기 어려운 조건만 골라요"
            />
            <p className="mb-2 text-[12.5px] text-sub">
              방 구조 <span className="text-faint">· 중복 선택</span>
            </p>
            <div className="flex flex-wrap gap-[7px]">
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
            <div className="mt-4 grid grid-cols-2 gap-3">
              {setupSelects.map((sel) => (
                <div key={sel.label}>
                  <p className="mb-1.5 text-[12.5px] text-sub">{sel.label}</p>
                  <Select
                    options={sel.options}
                    value={sel.value}
                    onChange={sel.onChange}
                  />
                </div>
              ))}
            </div>
            <p className="mb-2 mt-4 text-[12.5px] text-sub">
              필수시설{' '}
              <span className="text-faint">· 선택한 조건은 반드시 적용</span>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <MustHaveToggle
                icon="elevator"
                label="엘리베이터 필수"
                active={s.elevatorRequired}
                onClick={() =>
                  patch((st) => ({
                    elevatorRequired: !st.elevatorRequired,
                  }))
                }
              />
              <MustHaveToggle
                icon="local_parking"
                label="주차 1대 이상 필수"
                active={s.parkingRequired}
                onClick={() =>
                  patch((st) => ({ parkingRequired: !st.parkingRequired }))
                }
              />
            </div>
          </section>
        </div>

        {/* 추천 설정 — 하드필터가 아니라 랭킹 반영 스위치. 언제든 여기서 끄고 켠다. */}
        <section className="mt-7">
          <Head
            icon="tune"
            title="추천 설정"
            sub="조건을 거르지 않고 순서만 바꿔요"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SettingToggle
              icon="psychology"
              label="취향 학습"
              sub="찜·둘러본 집으로 추천을 정교하게 맞춰요"
              on={s.favoriteLearningEnabled}
              onClick={toggleLearning}
            />
            <SettingToggle
              icon="local_hospital"
              label="의료 접근 중요"
              sub="병원·약국이 가까운 집을 더 높여요"
              on={s.medicalPreferred}
              onClick={toggleMedical}
            />
          </div>
        </section>

        <div
          className={`mt-7 flex flex-wrap items-center gap-3 rounded-[13px] border px-4 py-3.5 ${
            canCompare
              ? 'border-teal/20 bg-teal-ghost'
              : 'border-gold/30 bg-gold/10'
          }`}
        >
          <div className="min-w-[220px] flex-1">
            <p className="text-[14px] font-bold text-ink">
              {housingsLoading ? (
                '매물을 세는 중이에요…'
              ) : (
                <>
                  지금 조건에 맞는 매물{' '}
                  <span
                    className={`text-[18px] font-extrabold tabular-nums ${
                      canCompare ? 'text-teal' : 'text-gold-dark'
                    }`}
                  >
                    {passCandidates.length}
                  </span>
                  곳
                </>
              )}
            </p>
            {!housingsLoading && !canCompare && (
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-sub">
                {biggestConstraint
                  ? `비교하려면 최소 ${MIN_COMPARISON_CANDIDATES}곳이 필요해요. '${biggestConstraint.label}'을 풀면 약 ${biggestConstraint.gain}곳 늘어요.`
                  : `비교하려면 최소 ${MIN_COMPARISON_CANDIDATES}곳이 필요해요. 지역·예산·필수시설을 조금 넓혀주세요.`}
              </p>
            )}
          </div>
          {!housingsLoading && !canCompare && (
            <div className="flex shrink-0 gap-2">
              {biggestConstraint && (
                <button
                  onClick={() =>
                    patch(biggestConstraint.open as Partial<StoreState>)
                  }
                  className="rounded-[9px] border border-gold/40 bg-gold/15 px-3 py-2 text-[12px] font-bold text-gold-dark"
                >
                  '{biggestConstraint.label}' 풀기
                </button>
              )}
              <button
                onClick={resetComparisonFilters}
                className="rounded-[9px] border border-gold/30 bg-white px-3 py-2 text-[12px] font-bold text-gold-dark"
              >
                전체 초기화
              </button>
            </div>
          )}
        </div>

        {!housingsLoading && !eligibilityComplete && (
          <p className="mt-6 flex items-center gap-1.5 text-[12px] font-bold text-gold-dark">
            <span className="ms text-[15px]">error</span>
            신청 자격을 먼저 선택하면 비교를 시작할 수 있어요
          </p>
        )}

        {/* 액션 바 */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line-soft pt-5">
          <span className="hidden items-center gap-1.5 text-[12px] text-faint sm:flex">
            <span className="ms text-[15px]">info</span>설정은 상단 '취향·조건'
            에서 언제든 바꿀 수 있어요
          </span>
          <div className="flex flex-1 gap-2.5 sm:flex-none">
            <Button
              onClick={goSwipe}
              disabled={!canCompare || housingsLoading || !eligibilityComplete}
              className="flex-1 rounded-[11px] px-6 py-[11px] text-[13.5px] sm:flex-none"
            >
              가상 생활권 비교 시작
            </Button>
            <Button
              variant="outline"
              onClick={goMap}
              className="flex-1 rounded-[11px] px-4 py-[11px] text-[13px] sm:flex-none"
            >
              {s.comparisonRounds > 0 ? '기존 취향으로 보기' : '지도 바로 보기'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function MustHaveToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-[11px] border px-3 py-2.5 text-left text-[12.5px] font-bold transition-colors ${
        active
          ? 'border-teal bg-teal-ghost text-teal'
          : 'border-line bg-white text-body hover:border-teal/40'
      }`}
    >
      <span className="ms text-[18px]">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="ms text-[18px]">
        {active ? 'check_circle' : 'radio_button_unchecked'}
      </span>
    </button>
  )
}

function SettingToggle({
  icon,
  label,
  sub,
  on,
  onClick,
}: {
  icon: string
  label: string
  sub: string
  on: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[11px] border border-line bg-white px-3 py-2.5">
      <span className="ms text-[18px] text-teal">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-sub">
          {sub}
        </span>
      </span>
      <Toggle on={on} onClick={onClick} ariaLabel={`${label} 켜기/끄기`} />
    </div>
  )
}

function Head({
  icon,
  title,
  sub,
  badge,
}: {
  icon: string
  title: string
  sub: string
  badge?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal-ghost">
        <span className="ms text-[19px] text-teal">{icon}</span>
      </span>
      <div>
        <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold leading-tight text-ink">
          {title}
          {badge}
        </h3>
        <p className="text-[11.5px] text-faint">{sub}</p>
      </div>
    </div>
  )
}

function BudgetSlider({
  label,
  value,
  min,
  max,
  step,
  raw,
  onChange,
  maxLabel,
}: {
  label: string
  value: string
  min: number
  max: number
  step: number
  raw: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  maxLabel: string
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-sub">{label}</span>
        <span className="rounded-md bg-teal-ghost px-2 py-0.5 text-[12.5px] font-bold tabular-nums text-teal">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={onChange}
        className="mt-2.5 w-full accent-teal"
      />
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-faint">
        <span>0</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}
