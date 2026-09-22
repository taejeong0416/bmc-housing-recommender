import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNav } from '../nav'
import { useStore } from '../store'
import { useHousings } from '../hooks/useHousings'
import { Button } from '../components/ui/Button'
import { ErrorState, LoadingState } from '../components/ui/States'
import {
  createPreferenceModel,
  eligiblePairwiseHousings,
  learnPreference,
  legacyWeightsFromModel,
  type PairChoice,
  type PreferenceChoiceLog,
  type PreferenceModel,
} from '../onboarding/pairwise'
import {
  createVirtualPair,
  type VirtualPair,
  type VirtualProfile,
} from '../onboarding/virtualScenarios'
import { deriveDisplayTags } from '../onboarding/weights'
import { BASE_ROUNDS, EXTRA_ROUNDS, MAX_ROUNDS } from '../onboarding/rounds'
import { applyPrefs, filterPrefsFromState } from '../lib/filter'

const MIN_RECOMMENDATION_CANDIDATES = 2

interface AnsweredStep {
  pair: VirtualPair
  choice: PairChoice
}

export default function SwipeScreen() {
  const { go } = useNav()
  const { state: s, patch } = useStore()
  const { data = [], isLoading, isError } = useHousings()
  // 결과 화면(Prefill)에서 '더 비교'로 돌아오면 그간 학습분을 이어받아 EXTRA_ROUNDS 만큼 더 진행한다.
  // 그 외 진입(1단계 '비교 시작'·'처음부터 다시')은 라운드 0부터 새로 학습.
  const location = useLocation()
  const resume =
    Boolean((location.state as { continue?: boolean } | null)?.continue) &&
    s.preferenceModel != null &&
    s.comparisonRounds > 0
  const [round, setRound] = useState(() => (resume ? s.comparisonRounds : 0))
  const [targetRounds] = useState(() =>
    resume
      ? Math.min(MAX_ROUNDS, s.comparisonRounds + EXTRA_ROUNDS)
      : BASE_ROUNDS,
  )
  const [model, setModel] = useState<PreferenceModel>(() =>
    resume && s.preferenceModel ? s.preferenceModel : createPreferenceModel(),
  )
  const [history, setHistory] = useState<PreferenceChoiceLog[]>(() =>
    resume ? s.preferenceHistory : [],
  )
  const [answeredSteps, setAnsweredSteps] = useState<AnsweredStep[]>([])

  const candidates = useMemo(
    () => eligiblePairwiseHousings(applyPrefs(data, filterPrefsFromState(s))),
    [data, s],
  )
  const pair = useMemo(
    () =>
      createVirtualPair(
        round,
        candidates,
        model,
        history.flatMap((log) => [log.leftId, log.rightId]),
      ),
    [candidates, history, model, round],
  )

  const finish = (
    finalModel: PreferenceModel,
    finalHistory: PreferenceChoiceLog[],
    rounds: number,
  ) => {
    const weights = legacyWeightsFromModel(finalModel)
    patch({
      preferenceModel: finalModel,
      preferenceHistory: finalHistory,
      comparisonRounds: rounds,
      weights,
      ...deriveDisplayTags(weights),
    })
    go('prefill')()
  }

  const answer = (choice: PairChoice) => {
    const nextModel = learnPreference(
      model,
      pair.left.vector,
      pair.right.vector,
      choice,
    )
    const nextHistory = [
      ...history,
      { leftId: pair.left.id, rightId: pair.right.id, choice },
    ]
    const nextRound = round + 1
    // 목표 라운드에 닿으면 곧바로 결과 화면(Prefill)으로 — 결과를 보여준 뒤
    // 거기서 '더 비교(최대 MAX_ROUNDS)' 여부를 고르게 한다.
    if (nextRound >= targetRounds) {
      finish(nextModel, nextHistory, nextRound)
      return
    }
    setAnsweredSteps([...answeredSteps, { pair, choice }])
    setModel(nextModel)
    setHistory(nextHistory)
    setRound(nextRound)
  }

  const goPrevious = () => {
    if (!answeredSteps.length) return
    const previousSteps = answeredSteps.slice(0, -1)
    const previousHistory = history.slice(0, -1)
    // 재진입(resume) 땐 저장된 기존 모델 위에서 이번 세션 선택만 다시 반영한다
    // (처음부터 복기하면 앞선 라운드 학습을 잃는다).
    const baseModel =
      resume && s.preferenceModel ? s.preferenceModel : createPreferenceModel()
    const previousModel = previousSteps.reduce(
      (m, step) =>
        learnPreference(
          m,
          step.pair.left.vector,
          step.pair.right.vector,
          step.choice,
        ),
      baseModel,
    )
    setAnsweredSteps(previousSteps)
    setHistory(previousHistory)
    setModel(previousModel)
    setRound((resume ? s.comparisonRounds : 0) + previousSteps.length)
  }

  if (isLoading)
    return (
      <div className="w-full max-w-[860px] rounded-2xl bg-white shadow-card">
        <LoadingState label="실제 후보 분포로 가상 매물을 만드는 중…" />
      </div>
    )
  if (isError)
    return (
      <div className="w-full max-w-[860px] rounded-2xl bg-white shadow-card">
        <ErrorState />
      </div>
    )
  if (candidates.length < MIN_RECOMMENDATION_CANDIDATES)
    return (
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-8 text-center shadow-card">
        <h1 className="text-xl font-extrabold text-ink">
          추천할 실제 후보가 부족해요
        </h1>
        <p className="mt-2 text-sm text-sub">
          선택한 희망조건을 만족하면서 생활환경을 분석할 수 있는 데이터 보유
          후보가 최소 두 곳 필요합니다. 조건을 조금 넓혀주세요.
        </p>
        <Button onClick={go('setup')} className="mt-5">
          조건 다시 설정
        </Button>
      </div>
    )

  return (
    <div className="w-full max-w-[920px] animate-rise">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] font-bold text-body">
          2 / 3 · 생활취향 알아보기
        </span>
        <div className="flex items-center gap-2">
          {answeredSteps.length > 0 && (
            <button
              type="button"
              onClick={goPrevious}
              className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-bold text-sub transition-colors hover:border-teal/40 hover:text-teal"
              aria-label="이전 질문으로 돌아가기"
            >
              <span className="ms text-[15px]">arrow_back</span>
              이전 질문
            </button>
          )}
          <span className="rounded-full bg-teal-ghost px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-teal">
            {round + 1} / {targetRounds}
          </span>
        </div>
      </div>
      <div className="mb-5 flex gap-1.5">
        {Array.from({ length: targetRounds }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] flex-1 rounded-full transition-colors ${
              i < round ? 'bg-teal' : i === round ? 'bg-teal/50' : 'bg-line'
            }`}
          />
        ))}
      </div>

      <h1 className="text-[22px] font-extrabold leading-[1.34] tracking-[-0.4px] text-ink">
        {pair.prompt}
      </h1>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <VirtualListingChoice
          profile={pair.left}
          label="A"
          onClick={() => answer('left')}
        />
        <VirtualListingChoice
          profile={pair.right}
          label="B"
          onClick={() => answer('right')}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          onClick={() => answer('tie')}
          className="w-full rounded-[12px] py-[11px] text-[13px] text-sub"
        >
          둘 다 비슷해요
        </Button>
        <Button
          variant="outline"
          onClick={() => answer('reject')}
          className="w-full rounded-[12px] py-[11px] text-[13px] text-sub"
        >
          둘 다 내 생활과 달라요
        </Button>
      </div>

      {/* 취향 비교 건너뛰기 — 희망조건만으로 바로 후보 지도로. */}
      <button
        type="button"
        onClick={go('map')}
        className="mx-auto mt-4 flex items-center gap-1 text-[12.5px] font-bold text-sub transition-colors hover:text-teal"
      >
        취향 비교 건너뛰기
        <span className="ms text-[16px]">arrow_forward</span>
      </button>
    </div>
  )
}

// 카드는 대표 이미지(생활장면) 위에 A/B 배지·문장형 타이틀·한 줄 설명·핵심 포인트·
// 감수할 점·'이 매물이 더 끌려요' 선택을 쌓는다. 각 질문의 A/B에 고유한
// 생활환경 예시 사진을 사용하며, 실제 매물 사진으로 오해하지 않도록 배지는 항상 표시한다.
function VirtualListingChoice({
  profile,
  label,
  onClick,
}: {
  profile: VirtualProfile
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`가상 매물 ${label} · ${profile.title} 선택`}
      className="group flex flex-col overflow-hidden rounded-[18px] border-2 border-line bg-white text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-teal hover:shadow-pop active:translate-y-0"
    >
      {/* 실제 매물이 아닌 질문별 생활환경 예시 사진. 3:2 원본 비율로 노출한다. */}
      <div className="flex justify-center px-4 pt-4">
        <img
          src={`${import.meta.env.BASE_URL}onboarding/questions/${profile.imageFile}`}
          alt={`가상 생활환경 이미지: ${profile.title}`}
          loading="lazy"
          onError={(e) => {
            const wrapper = e.currentTarget.parentElement
            if (wrapper) wrapper.style.display = 'none'
          }}
          className="aspect-[3/2] w-full max-w-[280px] rounded-xl object-cover object-center"
        />
      </div>

      {/* 배지 헤더 — A/B 배지와 '가상 매물' 표시(사진 유무와 무관하게 항상) */}
      <div className="flex items-center gap-2.5 border-b border-line-soft bg-panel px-4 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal text-[13px] font-extrabold text-white">
          {label}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">
          취향 학습용 가상 매물 {label}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* 문장형 타이틀 + 한 줄 설명 */}
        <h2 className="text-[16.5px] font-extrabold leading-snug tracking-[-0.3px] text-ink">
          {profile.title}
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-sub">
          {profile.scene}
        </p>

        {/* 장점·감수할 점 — 동일한 라벨+불릿 형식으로 통일(섹션 제목만 다름) */}
        <p className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">
          장점
        </p>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {profile.tags.map((tag) => (
            <li
              key={tag.label}
              className="flex items-start gap-2 text-[13px] font-semibold leading-snug text-body"
            >
              <span className="ms flex-none text-[16px] leading-snug text-teal">
                {tag.icon}
              </span>
              {tag.label}
            </li>
          ))}
        </ul>

        <p className="mt-3.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint">
          감수할 점
        </p>
        {/* 감수할 점은 1~2개로 갯수가 달라 카드 높이가 어긋난다 — 2개가 들어가도 아래
            여백이 넉넉하도록 높이를 고정해 A/B 카드 레이아웃을 동일하게 맞춘다. */}
        <ul className="mt-1.5 flex min-h-[4.5rem] flex-col gap-1.5">
          {profile.tradeoffs.map((point) => (
            <li
              key={point.label}
              className="flex items-start gap-2 text-[13px] font-semibold leading-snug text-body"
            >
              <span className="ms flex-none text-[16px] leading-snug text-teal">
                {point.icon}
              </span>
              {point.label}
            </li>
          ))}
        </ul>

        {/* 선택 */}
        <span className="mt-auto flex w-full items-center justify-center gap-1 rounded-[10px] bg-teal py-2.5 pt-2.5 text-[13px] font-extrabold text-white transition-colors group-hover:bg-teal-dark">
          이 매물이 더 끌려요
          <span className="ms text-[16px]">arrow_forward</span>
        </span>
      </div>
    </button>
  )
}
