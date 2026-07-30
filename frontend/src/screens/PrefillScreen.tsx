import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNav } from '../nav'
import { useStore } from '../store'
import { useHousings } from '../hooks/useHousings'
import { Button } from '../components/ui/Button'
import { Segmented } from '../components/ui/Segmented'
import { MAX_ROUNDS } from '../onboarding/rounds'
import { houseImage, rangeLabel } from '../api/housings'
import { applyPrefs, filterPrefsFromState } from '../lib/filter'
import {
  candidateReason,
  candidateTradeoff,
  createPreferenceModel,
  eligiblePairwiseHousings,
  preferenceCategorySignals,
  rankByLearnedPreference,
  strongestPreferences,
  type PreferenceFeatureId,
  type PreferenceModel,
} from '../onboarding/pairwise'
import {
  categoryOverrideLevel,
  finalPreferenceModel,
  hasOverrides,
  setCategoryOverride,
  type OverrideLevel,
} from '../onboarding/refine'
import { tallyChoiceFeatures } from '../onboarding/virtualScenarios'

const LEVELS: { id: OverrideLevel; label: string }[] = [
  { id: 'avoid', label: '후순위' },
  { id: 'auto', label: '자동' },
  { id: 'prefer', label: '우선' },
]

// 대표 취향 유형 — 지배 카테고리(추론+직접보정 반영) 기준의 설명용 라벨. 확정 진단이 아니다.
const PERSONA_LABEL: Record<string, string> = {
  calm: '조용한 숲세권',
  transit: '역세권 이동파',
  lifestyle: '카페·문화 생활러',
  daily: '생활편의 실속파',
}

function personaName(categories: { id: string; score: number }[]): string {
  const top = categories.find((c) => c.score > 0.02)
  return top
    ? (PERSONA_LABEL[top.id] ?? '나만의 생활 취향')
    : '탐색 중인 생활 취향'
}

/** 상위 선호를 한 문장으로 요약(§6.5·결합형 취향 설명). 확정 진단이 아닌 설명용 프로필. */
function summarize(model: PreferenceModel): string {
  const strong = strongestPreferences(model, 2)
    .filter((s) => s.weight > 0)
    .map((s) => s.label)
  const weak = strongestPreferences(model, 7)
    .filter((s) => s.weight < 0)
    .map((s) => s.label)
  if (!strong.length)
    return '아직 뚜렷한 방향이 없어요. 희망조건 중심으로 후보를 보여드릴게요.'
  const head = strong.join('과 ')
  return weak.length
    ? `${head}을(를) 우선하고, ${weak[0]}은(는) 상대적으로 덜 중요하게 봤어요.`
    : `${head}을(를) 우선으로 봤어요.`
}

export default function PrefillScreen() {
  const { go, goDetail } = useNav()
  const navigate = useNavigate()
  const { state: s, patch } = useStore()
  const { data: housings = [], isLoading } = useHousings()
  const [showBreakdown, setShowBreakdown] = useState(false)
  // 결과를 확인한 뒤 원하면 이어서 더 비교(누적 MAX_ROUNDS 상한).
  const canCompareMore = s.comparisonRounds < MAX_ROUNDS
  const compareMore = () => navigate('/swipe', { state: { continue: true } })

  // 최종 모델 = 추론 + 직접 보정(§7.6) + 찜 정교화(§12). 랭킹·설명·요약의 단일 원천.
  const model = useMemo(
    () =>
      finalPreferenceModel({
        model: s.preferenceModel,
        overrides: s.preferenceOverrides,
        favorites: s.favorites,
        favoriteLearningEnabled: s.favoriteLearningEnabled,
      }),
    [
      s.preferenceModel,
      s.preferenceOverrides,
      s.favorites,
      s.favoriteLearningEnabled,
    ],
  )
  // 상단 '발견한 취향' 진단(제목·요약·카테고리 바·세부 신호)은 온보딩 A/B로 학습한
  // 신호만 반영해 고정한다. 직접 조정(override)은 이 진단을 다시 쓰지 않고, 아래 추천
  // 랭킹(model = 추론+보정+찜)에만 영향을 준다 — 진단과 튜닝을 분리(§7.6).
  const diagnosisModel = s.preferenceModel ?? createPreferenceModel()
  const categories = preferenceCategorySignals(diagnosisModel)
  const featureSignals = strongestPreferences(diagnosisModel, 3)
  const overridden = hasOverrides(s.preferenceOverrides)
  // "이렇게 분석했어요" 펼침 — 온보딩 A/B에서 고른 취향을 횟수로 집계(예: 공원 산책 4회).
  const choiceTally = tallyChoiceFeatures(s.preferenceHistory)
  const maxTally = Math.max(...choiceTally.map((t) => t.count), 1)
  const maxCat = Math.max(...categories.map((c) => Math.abs(c.score)), 0.0001)
  const prioritized = categories.filter((c) => c.score > 0.02).length
  const persona = personaName(categories)
  const recommendations = useMemo(() => {
    const filtered = eligiblePairwiseHousings(
      applyPrefs(housings, filterPrefsFromState(s)),
    )
    return rankByLearnedPreference(filtered, model).slice(0, 3)
  }, [housings, model, s])

  const setLevel = (
    features: readonly PreferenceFeatureId[],
    level: OverrideLevel,
  ) =>
    patch({
      preferenceOverrides: setCategoryOverride(
        s.preferenceOverrides,
        features,
        level,
      ),
    })

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1120px] animate-rise">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[19px] font-extrabold tracking-[-0.5px] text-teal">
              Be:live
            </span>
            <span className="text-[12px] text-sub">초기 취향 결과</span>
          </div>
          <span className="rounded-full bg-teal-ghost px-2.5 py-1 text-[11.5px] font-bold text-teal">
            3 / 3 단계
          </span>
        </div>
        <div className="mt-3.5 flex gap-1.5">
          <span className="h-[5px] flex-1 rounded-full bg-teal" />
          <span className="h-[5px] flex-1 rounded-full bg-teal" />
          <span className="h-[5px] flex-1 rounded-full bg-teal" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr]">
        <section className="rounded-[18px] bg-white p-6 shadow-card">
          <h1 className="text-[21px] font-extrabold leading-[1.3] tracking-[-0.4px] text-ink">
            선택에서 발견한 생활취향이에요
          </h1>

          {/* 취향 유형 카드 — 대표 유형 + 요약 + 신호 분석 펼치기 */}
          <div className="mt-4 rounded-[16px] bg-gradient-to-br from-teal-soft to-teal-ghost p-5">
            <h2 className="text-[22px] font-extrabold tracking-[-0.5px] text-ink">
              {persona}
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-body">
              {summarize(diagnosisModel)}
            </p>

            {choiceTally.length > 0 && (
              <>
                <button
                  onClick={() => setShowBreakdown((v) => !v)}
                  aria-expanded={showBreakdown}
                  className="mt-3 flex items-center gap-0.5 text-[12px] font-bold text-teal transition-colors hover:text-teal-dark"
                >
                  {showBreakdown ? '접기' : '이렇게 분석했어요'}
                  <span className="ms text-[16px]">
                    {showBreakdown ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showBreakdown && (
                  <div className="mt-3 flex flex-col gap-2.5 border-t border-teal/15 pt-3">
                    <p className="text-[11.5px] leading-relaxed text-body">
                      취향 비교에서 고른 선택을 모아봤어요. 자주 고른 취향일수록
                      추천에 크게 반영돼요.
                    </p>
                    {choiceTally.map((item) => {
                      const width = Math.round((item.count / maxTally) * 100)
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2.5"
                        >
                          <span className="flex w-[92px] shrink-0 items-center gap-1 text-[11.5px] text-body">
                            <span className="ms text-[14px] text-teal">
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-teal-soft to-teal"
                              style={{ width: `${width}%` }}
                            />
                          </span>
                          <span className="w-[38px] shrink-0 text-right text-[11.5px] font-bold text-teal">
                            {item.count}회
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <p className="text-[14px] font-extrabold text-ink">
                카테고리별 중요도
              </p>
              <span className="text-[11px] text-faint">
                {prioritized > 0
                  ? `${categories.length}개 중 ${prioritized}개를 우선 반영했어요`
                  : '아직 뚜렷한 우선순위가 없어요'}
              </span>
            </div>

            <div className="mt-3.5 flex flex-col gap-4">
              {categories.map((category) => {
                const positive = category.score > 0.02
                const negative = category.score < -0.02
                const level = categoryOverrideLevel(
                  s.preferenceOverrides,
                  category.features,
                )
                const width = Math.max(
                  positive || negative ? 8 : 3,
                  Math.round((Math.abs(category.score) / maxCat) * 100),
                )
                return (
                  <div key={category.id}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex w-[104px] shrink-0 items-center gap-1.5">
                        <span
                          className={`ms text-[17px] ${
                            positive ? 'text-teal' : 'text-faint'
                          }`}
                        >
                          {category.icon}
                        </span>
                        <b className="truncate text-[12.5px] text-ink">
                          {category.label}
                        </b>
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-teal-soft to-teal"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span
                        className={`w-12 shrink-0 whitespace-nowrap text-right text-[11.5px] font-bold ${
                          positive
                            ? 'text-teal'
                            : negative
                              ? 'text-sub'
                              : 'text-faint'
                        }`}
                      >
                        {level !== 'auto'
                          ? '설정'
                          : positive
                            ? '우선'
                            : negative
                              ? '후순위'
                              : '보통'}
                      </span>
                    </div>
                    <Segmented
                      className="mt-2"
                      items={LEVELS.map((lv) => ({
                        label: lv.label,
                        active: level === lv.id,
                        onClick: () => setLevel(category.features, lv.id),
                      }))}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {featureSignals.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-faint">
                선택에서 발견한 세부 취향 신호
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {featureSignals.map((signal) => (
                  <span
                    key={signal.id}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold ${
                      signal.weight > 0
                        ? 'bg-teal-ghost text-teal'
                        : 'bg-panel text-sub'
                    }`}
                  >
                    <span className="ms text-[14px]">{signal.icon}</span>
                    {signal.label}
                    {signal.weight < 0 && ' · 후순위'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2">
            {canCompareMore ? (
              <Button
                variant="outline"
                onClick={compareMore}
                className="rounded-[11px] py-[10px] text-[12.5px]"
              >
                취향 테스트 더 하기
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={go('swipe')}
                className="rounded-[11px] py-[10px] text-[12.5px]"
              >
                취향 테스트 다시하기
              </Button>
            )}
            <Button
              variant="outline"
              onClick={go('setup')}
              className="rounded-[11px] py-[10px] text-[12.5px]"
            >
              희망조건 수정
            </Button>
          </div>
          {/* 초기화 버튼은 override 유무와 무관하게 자리를 항상 차지한다 — 우선/자동을
              오갈 때 버튼이 생겼다 사라지며 카드 높이가 흔들리지 않도록 고정. */}
          <button
            onClick={() => patch({ preferenceOverrides: {} })}
            aria-hidden={!overridden}
            tabIndex={overridden ? 0 : -1}
            className={`mt-2 w-full text-[11.5px] font-bold text-sub transition-colors hover:text-teal ${
              overridden ? '' : 'invisible pointer-events-none'
            }`}
          >
            직접 설정 초기화 · 추론값으로 되돌리기
          </button>
        </section>

        <section className="rounded-[18px] bg-white p-6 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold text-teal">
                가장 먼저 볼 후보
              </p>
              <h2 className="mt-1 text-[20px] font-extrabold text-ink">
                내 취향과 가까운 실제 후보 3곳
              </h2>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {isLoading && (
              <div className="rounded-[13px] bg-panel p-5 text-center text-[13px] text-sub">
                데이터 보유 후보를 계산하고 있어요.
              </div>
            )}
            {!isLoading &&
              recommendations.map((housing, index) => {
                const image = houseImage(housing)
                const reason = candidateReason(housing.id, model)
                return (
                  <button
                    key={housing.id}
                    onClick={goDetail(housing.id)}
                    className="group flex gap-3 rounded-[14px] border border-line-soft p-3 text-left transition-colors hover:border-teal/40 hover:bg-teal-ghost/40"
                  >
                    <div className="relative h-[124px] w-[92px] shrink-0 overflow-hidden rounded-[10px] bg-panel">
                      <img
                        src={image.src}
                        alt={housing.name}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-teal px-1.5 py-0.5 text-[10.5px] font-extrabold text-white">
                        {recommendations.length > 1 ? `${index + 1}위` : '추천'}
                      </span>
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <b className="truncate text-[14.5px] text-ink">
                          {housing.name}
                        </b>
                        {housing.type !== '매입임대' && (
                          <span className="shrink-0 rounded-[5px] bg-teal-soft px-1.5 py-0.5 text-[10px] font-bold text-teal">
                            {housing.type}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-sub">
                        {[housing.district, housing.dong]
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                      <span className="mt-1.5 block text-[11.5px] text-sub">
                        보증금{' '}
                        <b className="text-ink">
                          {rangeLabel(housing.deposit)}
                        </b>
                        {' · '}월{' '}
                        <b className="text-ink">{rangeLabel(housing.rent)}</b>
                      </span>
                      <span className="mt-2 block text-[11px] leading-relaxed text-teal">
                        <b>추천 이유</b>{' '}
                        <span className="text-body">
                          {reason ?? housing.highlight ?? '선택 취향 반영'}
                        </span>
                      </span>
                      <span className="mt-1 block text-[10.5px] leading-relaxed text-sub">
                        <b className="text-body">감수할 점</b>{' '}
                        {candidateTradeoff(housing.id, model)}
                      </span>
                    </span>
                  </button>
                )
              })}
          </div>

          <Button
            onClick={go('home')}
            className="mt-4 w-full rounded-[11px] py-[11px] text-[13.5px]"
          >
            대체로 맞아요 · 추천 홈으로
          </Button>
        </section>
      </div>
    </div>
  )
}
