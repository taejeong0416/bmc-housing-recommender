import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useStore } from '../store'
import { aiExamples } from '../data'
import {
  parseQuery,
  prefsFromParse,
  parsedFromPrefs,
  mergeInto,
  type ParsedFilter,
  type ParsedFollowup,
} from '../api/ai'
import {
  applyPrefs,
  filterPrefsFromState,
  type FilterPrefs,
} from '../lib/filter'
import { useHousings } from '../hooks/useHousings'
import { deriveDisplayTags } from '../onboarding/weights'
import {
  preferenceModelFromTags,
  legacyWeightsFromModel,
  featureDefinition,
  PREFERENCE_CATEGORIES,
  type PreferenceFeatureId,
} from '../onboarding/pairwise'
import { toast } from '../components/ui/toastStore'
import type { GeneratedHousing } from '../types'

type Tag = { id: string; weight: number }

// 대화 로그 한 턴. followup은 마지막 AI 턴에만 살아 있고, 답하면 다음 턴으로 대체된다.
type Msg =
  | { role: 'user'; text: string }
  | { role: 'ai'; summary: string; unresolved?: string[] }

// 취향 태그 누적 — id 기준 합집합, 더 강한 weight 유지. parsed.tags가 취향의 단일 소스다.
function mergeTags(base: Tag[], add: Tag[]): Tag[] {
  const map = new Map(base.map((t) => [t.id, t.weight]))
  for (const t of add) map.set(t.id, Math.max(map.get(t.id) ?? 0, t.weight))
  return [...map].map(([id, weight]) => ({ id, weight }))
}

// 누적 취향 → 한국어 요약(재질문 방지 컨텍스트). 예: "카페 선택지, 공원 산책"
function tasteSummary(tags: Tag[]): string | null {
  if (!tags.length) return null
  return tags
    .map((t) => featureDefinition[t.id as PreferenceFeatureId]?.label ?? t.id)
    .join(', ')
}

// 관심목록 경향 프로필(P5-C) — 개인화 컨텍스트·선제 제안의 공통 소스.
function favProfile(
  favorites: Record<string, boolean>,
  housings: GeneratedHousing[],
): { count: number; topDist: string | null; newish: boolean } | null {
  const ids = Object.entries(favorites)
    .filter(([, on]) => on)
    .map(([id]) => id)
  if (!ids.length) return null
  const set = new Set(ids)
  const favs = housings.filter((h) => set.has(h.id))
  if (!favs.length) return { count: ids.length, topDist: null, newish: false }
  const nowY = new Date().getFullYear()
  const byDist = new Map<string, number>()
  let recent = 0
  for (const h of favs) {
    if (h.district) byDist.set(h.district, (byDist.get(h.district) ?? 0) + 1)
    const y = h.builtDate ? Number(h.builtDate.slice(0, 4)) : 0
    if (y && y >= nowY - 5) recent++
  }
  const topDist =
    [...byDist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return {
    count: favs.length,
    topDist,
    newish: recent >= Math.ceil(favs.length / 2),
  }
}

// ParsedFilter → 제거 가능한 조건 칩 목록. 각 칩을 빼면 해당 조건만 사라진다.
function buildChips(p: ParsedFilter, set: (next: ParsedFilter) => void) {
  const c: { key: string; label: string; remove: () => void }[] = []
  const upd = (patch: Partial<ParsedFilter>) => set({ ...p, ...patch })
  if (p.rentType)
    c.push({
      key: 'type',
      label: `유형 · ${p.rentType}`,
      remove: () => upd({ rentType: undefined }),
    })
  if (p.depositMax != null)
    c.push({
      key: 'dep',
      label: `보증금 ${p.depositMax.toLocaleString()}만 이하`,
      remove: () => upd({ depositMax: undefined }),
    })
  if (p.rentMax != null)
    c.push({
      key: 'rent',
      label: `월세 ${p.rentMax}만 이하`,
      remove: () => upd({ rentMax: undefined }),
    })
  ;(p.regions ?? []).forEach((r) =>
    c.push({
      key: 'r-' + r,
      label: r,
      remove: () => upd({ regions: (p.regions ?? []).filter((x) => x !== r) }),
    }),
  )
  if (p.buildYear)
    c.push({
      key: 'yr',
      label: `준공 ${p.buildYear}`,
      remove: () => upd({ buildYear: undefined }),
    })
  if (p.area)
    c.push({ key: 'ar', label: p.area, remove: () => upd({ area: undefined }) })
  ;(p.houseTypes ?? []).forEach((h) =>
    c.push({
      key: 'h-' + h,
      label: h,
      remove: () =>
        upd({ houseTypes: (p.houseTypes ?? []).filter((x) => x !== h) }),
    }),
  )
  ;(p.tags ?? []).forEach((t) =>
    c.push({
      key: 't-' + t.id,
      label: `${featureDefinition[t.id as PreferenceFeatureId]?.label ?? t.id} ${'●'.repeat(t.weight)}`,
      remove: () => upd({ tags: (p.tags ?? []).filter((x) => x.id !== t.id) }),
    }),
  )
  return c
}

// 그릴링 상한(턴) — 4개 취향 카테고리를 다 커버하고 강도까지 갈리면 자연히 끝나고,
// 그 전이라도 이 횟수를 넘기면 마찰을 막기 위해 더 되묻지 않는다.
const MAX_GRILL = 6

// 취향을 모른다는 신호(모델이 되묻기를 빠뜨릴 때 결정적 시작 질문을 띄우는 트리거).
const UNCERTAIN = /모르|글쎄|아무거나|상관없|추천|골라|정하기|막연|어렵/

// 태그가 어느 취향 카테고리(4묶음)를 덮었는지 — 그릴링이 빈 축부터 채우도록 판정.
function coveredCats(tags: Tag[]): Set<string> {
  const ids = new Set(tags.map((t) => t.id))
  const set = new Set<string>()
  for (const c of PREFERENCE_CATEGORIES)
    if (c.features.some((f) => ids.has(f))) set.add(c.id)
  return set
}

// 결정적 시작 질문 — 취향 4묶음(PREFERENCE_CATEGORIES 정합). 모델이 첫 턴에 되묻기를
// 빠뜨려도 그릴링 진입을 보장한다. "잘 모르겠어요"는 빈 태그 → 다음 턴 LLM이 다른 각도로 이어감.
const STARTER_GRILL: ParsedFollowup = {
  question: '집 고를 때 뭐가 제일 중요하세요? 편하게 골라보세요.',
  options: [
    { label: '지하철·교통 편한 곳', tags: [{ id: 'rail_access', weight: 3 }] },
    {
      label: '카페·외식·문화 많은 곳',
      tags: [
        { id: 'cafe_choice', weight: 2 },
        { id: 'restaurant_choice', weight: 2 },
        { id: 'culture_access', weight: 2 },
      ],
    },
    {
      label: '운동·장보기 편한 곳',
      tags: [
        { id: 'fitness_access', weight: 2 },
        { id: 'supermarket_access', weight: 2 },
      ],
    },
    {
      label: '조용하고 공원 가까운 곳',
      tags: [
        { id: 'quiet_residential', weight: 3 },
        { id: 'park_walk', weight: 2 },
      ],
    },
    { label: '잘 모르겠어요', tags: [] },
  ],
}

// 카테고리별 결정적 질문 — LLM이 followup을 빠뜨려도 안 물어본 축을 파고들어 커버리지를
// 보장한다. 회피 보기(빈 tags)를 눌러도 그 카테고리는 '물어봄'으로 기록돼 다시 묻지 않는다.
const CATEGORY_GRILL: Record<string, ParsedFollowup> = {
  transit: {
    question: '출퇴근이나 외출은 주로 어떻게 하세요?',
    options: [
      {
        label: '지하철로 다녀서 역 가까우면 좋아요',
        tags: [{ id: 'rail_access', weight: 3 }],
      },
      { label: '교통은 크게 상관없어요', tags: [] },
    ],
  },
  lifestyle: {
    question: '쉬는 날엔 주로 뭘 하세요?',
    options: [
      {
        label: '카페·맛집 다녀요',
        tags: [
          { id: 'cafe_choice', weight: 2 },
          { id: 'restaurant_choice', weight: 2 },
        ],
      },
      {
        label: '전시·공연 즐겨요',
        tags: [{ id: 'culture_access', weight: 3 }],
      },
      { label: '집에서 쉬는 편이에요', tags: [] },
    ],
  },
  daily: {
    question: '평소 생활에서 뭐가 편했으면 하세요?',
    options: [
      {
        label: '운동시설 가까웠으면',
        tags: [{ id: 'fitness_access', weight: 3 }],
      },
      {
        label: '장보기·마트 편했으면',
        tags: [{ id: 'supermarket_access', weight: 3 }],
      },
      { label: '딱히 없어요', tags: [] },
    ],
  },
  calm: {
    question: '어떤 동네 분위기가 좋으세요?',
    options: [
      {
        label: '조용한 주택가요',
        tags: [{ id: 'quiet_residential', weight: 3 }],
      },
      {
        label: '공원 산책하기 좋은 곳',
        tags: [{ id: 'park_walk', weight: 3 }],
      },
      { label: '상관없어요', tags: [] },
    ],
  },
}

// 강도 질문 — 파악된 취향 중 서로 다른 카테고리의 상위 둘을 놓고 하나를 고르게 해
// 가중치를 가린다(고른 축을 weight 3으로). 대비할 두 축이 없으면 null.
function tradeoffGrill(tags: Tag[]): ParsedFollowup | null {
  const catOf = (id: string) =>
    PREFERENCE_CATEGORIES.find((c) =>
      (c.features as readonly string[]).includes(id),
    )?.id
  const sorted = [...tags].sort((a, b) => b.weight - a.weight)
  const a = sorted[0]
  const b = sorted.find((t) => catOf(t.id) !== catOf(a?.id ?? ''))
  if (!a || !b) return null
  const la = featureDefinition[a.id as PreferenceFeatureId]?.label ?? a.id
  const lb = featureDefinition[b.id as PreferenceFeatureId]?.label ?? b.id
  return {
    question: `${la}랑 ${lb} 중에 더 포기하기 어려운 건요?`,
    options: [
      { label: la, tags: [{ id: a.id, weight: 3 }] },
      { label: lb, tags: [{ id: b.id, weight: 3 }] },
    ],
  }
}

// 지도 검색바에서 슬라이드로 열리는 AI 대화 패널. 대화 한 턴마다 취향·조건을 스토어에
// 즉시 반영해(useEffect) 지도 마커·리스트·개수가 실시간 갱신된다(별도 "확정" 없음).
export default function AiSearchPanel({ onClose }: { onClose: () => void }) {
  const { state, patch } = useStore()
  const { data } = useHousings()
  const [q, setQ] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [parsed, setParsed] = useState<ParsedFilter | null>(null)
  const [followup, setFollowup] = useState<ParsedFollowup | null>(null)
  const [grillCount, setGrillCount] = useState(0)
  const [grillStop, setGrillStop] = useState(false) // "결과 볼래요"로 그릴링 중단
  const [askedCats, setAskedCats] = useState<Set<string>>(() => new Set()) // 결정적으로 물어본 카테고리
  const [askedTradeoff, setAskedTradeoff] = useState(false)
  const [loading, setLoading] = useState(false)

  // 개인화 컨텍스트(P5-C-1): 현재 설정 조건 + 관심목록 경향. 파싱 결과를 이 위에 병합.
  const current: FilterPrefs = filterPrefsFromState(state)
  const profile = useMemo(
    () => favProfile(state.favorites, data ?? []),
    [state.favorites, data],
  )
  const favSummary = useMemo(() => {
    if (!profile) return null
    const parts = [`관심 ${profile.count}곳`]
    if (profile.topDist) parts.push(`주로 ${profile.topDist}`)
    if (profile.newish) parts.push('신축 위주')
    return parts.join(' · ')
  }, [profile])
  const favSuggestion = useMemo(() => {
    if (!profile?.topDist) return null
    const terms = [profile.topDist, profile.newish ? '신축' : ''].filter(
      Boolean,
    )
    return { text: terms.join(' '), label: terms.join(' ') }
  }, [profile])

  const chips = parsed ? buildChips(parsed, setParsed) : []
  const count = useMemo(
    () => (parsed ? applyPrefs(data ?? [], prefsFromParse(parsed)).length : 0),
    [parsed, data],
  )

  // 매 턴 지도 반영(§7.1) — parsed가 바뀔 때마다 취향/조건을 스토어에 patch한다.
  // AI 취향은 pairwise 8피처 선호모델로 흘려 LIVE 랭킹에 반영(weights·selectedTags는 칩 표시용 파생).
  useEffect(() => {
    if (!parsed) return
    const tags = parsed.tags ?? []
    const extra = tags.length
      ? (() => {
          const model = preferenceModelFromTags(tags)
          const legacy = legacyWeightsFromModel(model)
          return {
            preferenceModel: model,
            preferenceHistory: [],
            comparisonRounds: 0,
            weights: legacy,
            ...deriveDisplayTags(legacy),
          }
        })()
      : {}
    patch({ ...prefsFromParse(parsed), ...extra })
  }, [parsed, patch])

  // 한 대화 턴 — 자유 문장 또는 followup 보기 탭(presetTags). 취향은 누적, 조건은 병합.
  const runTurn = async (text: string, presetTags: Tag[] = []) => {
    const t = text.trim()
    if (!t || loading) return
    const prevTags = parsed?.tags ?? []
    setMessages((m) => [...m, { role: 'user', text: t }])
    setQ('')
    setFollowup(null)
    setLoading(true)
    try {
      // 이번 턴 진입 시점의 취향(이전 누적 + 탭한 보기) → 빈 취향 축을 모델에 알려 겨냥시킴.
      // 그릴링이 활성일 때만 힌트를 준다(순수 조건 검색은 그대로 두어 불필요한 되묻기 방지).
      const enteringTags = mergeTags(prevTags, presetTags)
      const grillActive =
        grillCount > 0 || prevTags.length > 0 || UNCERTAIN.test(t)
      const enteringCats = coveredCats(enteringTags)
      const uncoveredAxes = grillActive
        ? PREFERENCE_CATEGORIES.filter((c) => !enteringCats.has(c.id)).map(
            (c) => c.label,
          )
        : undefined
      const p = await parseQuery(t, {
        current,
        favSummary,
        knownTaste: tasteSummary(prevTags),
        uncoveredAxes,
      })
      // 조건은 현재/기존 위에 병합(P5-C-1), 취향 태그는 대화 내내 누적한다.
      const base = parsed ?? parsedFromPrefs(current)
      const tags = mergeTags(enteringTags, p.tags ?? [])
      setParsed({ ...mergeInto(base, p), tags: tags.length ? tags : undefined })
      setMessages((m) => [
        ...m,
        { role: 'ai', summary: p.summary, unresolved: p.unresolved },
      ])

      // 다음 되묻기 결정 — 커버리지(breadth) 먼저, 다 덮이면 강도(intensity) 한 번.
      // LLM followup이 있으면 우선하고, 없으면 미커버 카테고리·트레이드오프로 이어간다.
      const covered = coveredCats(tags)
      let next: ParsedFollowup | null = null
      let markCat: string | null = null
      let markTradeoff = false
      if (!grillStop && grillCount < MAX_GRILL) {
        if (p.followup) {
          next = p.followup
        } else if (grillCount === 0) {
          // 첫 턴은 취향을 모른다는 신호가 있을 때만 그릴링 시작(선제 그릴링 안 함).
          if (tags.length === 0 && UNCERTAIN.test(t)) next = STARTER_GRILL
        } else {
          const gap = PREFERENCE_CATEGORIES.find(
            (c) => !covered.has(c.id) && !askedCats.has(c.id),
          )
          if (gap) {
            next = CATEGORY_GRILL[gap.id]
            markCat = gap.id
          } else if (!askedTradeoff && tags.length >= 2) {
            next = tradeoffGrill(tags)
            markTradeoff = next != null
          }
        }
      }
      if (next) {
        setFollowup(next)
        setGrillCount((n) => n + 1)
        if (markCat) {
          const id = markCat
          setAskedCats((s) => new Set(s).add(id))
        }
        if (markTradeoff) setAskedTradeoff(true)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'AI 응답에 실패했어요')
      setMessages((m) => m.slice(0, -1)) // 실패한 사용자 발화 롤백
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setMessages([])
    setParsed(null)
    setFollowup(null)
    setGrillCount(0)
    setGrillStop(false)
    setAskedCats(new Set())
    setAskedTradeoff(false)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') runTurn(q)
  }

  const started = messages.length > 0 || loading

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
          <span className="ms text-[19px] text-teal">auto_awesome</span>AI 검색
        </h2>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="rounded-lg p-1.5 leading-[0] text-faint transition-colors hover:bg-panel hover:text-body"
        >
          <span className="ms text-[20px]">close</span>
        </button>
      </div>

      {/* 대화/빈상태 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {started ? (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[88%] rounded-[16px_16px_4px_16px] bg-teal px-3.5 py-2.5 text-[13px] leading-[1.5] text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-ghost">
                    <span className="ms text-[15px] text-teal">
                      auto_awesome
                    </span>
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[12.5px] font-semibold leading-relaxed text-body">
                      {m.summary}
                    </p>
                    {m.unresolved && m.unresolved.length > 0 && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-panel px-2.5 py-2">
                        <span className="ms mt-px text-[14px] text-faint">
                          help
                        </span>
                        <p className="text-[11.5px] leading-relaxed text-sub">
                          이 부분은 이해하지 못했어요 —{' '}
                          <span className="font-semibold text-body">
                            {m.unresolved.join(', ')}
                          </span>
                          . 더 구체적으로 알려주시면 반영할게요.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-ghost">
                  <span className="ms animate-pulse text-[15px] text-teal">
                    auto_awesome
                  </span>
                </span>
                <p className="pt-0.5 text-[12.5px] font-semibold text-body">
                  생각하고 있어요…
                </p>
              </div>
            )}

            {/* 취향 그릴링 — AI가 되묻는 질문의 탭 가능한 보기 */}
            {followup && !loading && (
              <div className="ml-8 flex flex-col gap-2">
                <p className="text-[12px] font-semibold text-teal">
                  {followup.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  {followup.options.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => runTurn(o.label, o.tags ?? [])}
                      className="rounded-full border border-teal/35 bg-teal-ghost px-3 py-1.5 text-[12px] font-semibold text-teal transition-colors hover:bg-teal-soft"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setFollowup(null)
                    setGrillStop(true)
                  }}
                  className="self-start text-[11.5px] font-semibold text-sub transition-colors hover:text-teal"
                >
                  이제 결과 볼래요 →
                </button>
              </div>
            )}

            {/* 누적된 이해 조건 — 눌러서 뺄 수 있음(빼면 지도 즉시 갱신) */}
            {parsed && !loading && chips.length > 0 && (
              <div className="ml-8">
                <p className="mb-1.5 text-[11.5px] text-sub">
                  이렇게 이해했어요 · 눌러서 뺄 수 있어요
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c.key}
                      className="flex items-center gap-1 rounded-[8px] bg-teal-soft py-1.5 pl-2.5 pr-1.5 text-[12px] font-bold text-teal"
                    >
                      {c.label}
                      <button
                        onClick={c.remove}
                        aria-label={`${c.label} 제거`}
                        className="rounded-full p-0.5 leading-[0] transition-colors hover:bg-teal/15"
                      >
                        <span className="ms text-[14px] text-teal">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="ms text-[28px] text-teal">auto_awesome</span>
            <p className="text-[13.5px] font-bold text-ink">
              무엇을 찾으시나요?
            </p>
            <p className="text-[12px] leading-relaxed text-sub">
              원하는 조건을 말해주세요. 취향이 막연하면
              <br />몇 가지 여쭤보며 함께 좁혀드릴게요.
            </p>
            {favSuggestion && (
              <button
                onClick={() => runTurn(favSuggestion.text)}
                disabled={loading}
                className="mt-2 flex max-w-full items-center gap-1.5 rounded-full border border-teal/35 bg-teal-ghost px-3 py-1.5 text-[12px] font-semibold text-teal transition-colors hover:bg-teal-soft disabled:opacity-50"
              >
                <span className="ms text-[15px]">favorite</span>
                <span className="truncate">
                  찜하신 곳처럼 · {favSuggestion.label}
                </span>
              </button>
            )}
            <div className="mt-3 flex w-full flex-col gap-1.5">
              {aiExamples.map((e) => (
                <button
                  key={e}
                  onClick={() => runTurn(e)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-left text-[12px] font-semibold text-body transition-colors hover:border-teal/45 hover:bg-teal-ghost hover:text-teal disabled:opacity-50"
                >
                  <span className="ms text-[14px] text-faint">search</span>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 지도 반영 상태 + 새 대화 */}
      {parsed && (
        <div className="flex items-center justify-between gap-2 border-t border-line-soft bg-teal-ghost px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-teal">
            <span className="ms text-[16px]">map</span>
            지도에 반영 중 · {count}곳
          </span>
          <button
            onClick={reset}
            className="rounded-lg px-2 py-1 text-[12px] font-semibold text-sub transition-colors hover:text-teal"
          >
            새 대화
          </button>
        </div>
      )}

      {/* 입력칸 */}
      <div className="border-t border-line-soft p-3">
        <div className="flex items-center gap-2 rounded-[11px] border border-line bg-panel py-1.5 pl-3.5 pr-1.5 transition-colors focus-within:border-teal focus-within:bg-white">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              started
                ? '이어서 답하거나 조건을 더'
                : '예: 수영구 원룸 카페 근처'
            }
            className="flex-1 border-none bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
          />
          <button
            onClick={() => runTurn(q)}
            disabled={loading || !q.trim()}
            aria-label="보내기"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-teal transition-colors hover:bg-teal-dark disabled:opacity-40"
          >
            <span
              className={`ms text-[17px] text-white ${loading ? 'animate-pulse' : ''}`}
            >
              {loading ? 'hourglass_empty' : 'send'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
