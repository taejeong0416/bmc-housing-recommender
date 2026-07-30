import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useNav } from '../nav'
import { byTagId } from '../data'
import { useRecommendations } from '../hooks/useRecommendations'
import { houseImage, toCard, toMarker } from '../api/housings'
import { useNaverMap, type MapBounds } from '../hooks/useNaverMap'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { toast } from '../components/ui/toastStore'
import { useFavorites } from '../hooks/useFavorites'
import { findLandmarks, withinLandmark } from '../lib/landmarks'
import { topPicks } from '../lib/topPicks'
import AiSearchPanel from './AiSearchPanel'
import type { GeneratedHousing, HomeMarker } from '../types'

type SortKey = 'score' | 'deposit'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score', label: '매칭순' },
  { key: 'deposit', label: '보증금 낮은순' },
]
// 빠른 필터 옵션 — [표시 라벨, 필터값]. 값이 비면 '전체'(필터 없음).
const DEPOSIT_OPTS: [string, number][] = [
  ['3,000만원 이하', 30_000_000],
  ['5,000만원 이하', 50_000_000],
  ['1억 이하', 100_000_000],
]
const YEAR_OPTS: [string, number][] = [
  ['5년 이내', 5],
  ['10년 이내', 10],
  ['15년 이내', 15],
]
const SCORE_PRESETS = [80, 60, 40]

// 키워드 검색 — 주택명·주소·구·동에 검색어가 포함되면 통과(부분일치, 대소문자 무시).
const kwMatch = (h: GeneratedHousing, kw: string) => {
  const q = kw.trim().toLowerCase()
  if (!q) return true
  return [h.name, h.address, h.district, h.dong].some((f) =>
    f?.toLowerCase().includes(q),
  )
}

const sortHousings = (list: GeneratedHousing[], by: SortKey) =>
  [...list].sort((a, b) => {
    if (by === 'deposit') return (a.deposit?.min ?? 0) - (b.deposit?.min ?? 0)
    // 취향순: 취향 점수가 매겨진 후보(engine)를 미커버(placeholder) 위로, 그 안에서 점수순.
    const covered = (h: GeneratedHousing) =>
      h.scoreSource === 'engine' ? 1 : 0
    return covered(b) - covered(a) || (b.score ?? 0) - (a.score ?? 0)
  })

const applyFilters = (
  list: GeneratedHousing[],
  type: string,
  deposit: string,
  year: string,
  score: string,
) => {
  const nowY = new Date().getFullYear()
  return list.filter((d) => {
    if (type && d.type !== type) return false
    if (deposit && (d.deposit?.min ?? Infinity) > Number(deposit)) return false
    if (year) {
      const y = Number(d.builtDate?.slice(0, 4))
      if (!y || y < nowY - Number(year)) return false
    }
    if (score && (d.score ?? 0) < Number(score)) return false
    return true
  })
}

export default function MapScreen() {
  const { state: s } = useStore()
  const { go, goDetail } = useNav()
  const goPreference = go('swipe')
  const goSetup = go('setup')
  const { toggle } = useFavorites()
  // 추천 이음새(P5-C-3) — 실 API면 스코어링 엔진, 아니면 로컬 폴백. 하드필터는 훅 안에서 처리.
  const { items, isLoading, isError, personalized } = useRecommendations()
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [fType, setFType] = useState('')
  const [fDeposit, setFDeposit] = useState('')
  const [fYear, setFYear] = useState('')
  const [fScore, setFScore] = useState('')
  // 상단 검색바 — 입력값(kw)과 디바운스 적용값(appliedKw) 분리. 타이핑이 멈춘 뒤에야
  // 필터·지도이동을 적용해, 글자마다 지도가 튀는 것을 막는다.
  const [kw, setKw] = useState('')
  const [appliedKw, setAppliedKw] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setAppliedKw(kw), 500)
    return () => clearTimeout(id)
  }, [kw])

  // useMemo: 참조 고정 — 리렌더마다 useNaverMap이 마커를 전부 재생성하지 않도록
  const sorted = useMemo(() => sortHousings(items, sortBy), [items, sortBy])
  const typeOpts = useMemo(
    () => [...new Set(sorted.map((d) => d.type))].sort(),
    [sorted],
  )
  // 키워드가 거점(역·대학·상권 등) 이름/별칭과 맞으면 그 반경 내 매물까지 포함 — 지역/근처 검색.
  const kwLandmarks = useMemo(() => findLandmarks(appliedKw), [appliedKw])
  // 취향/조건(스토어) 하드필터는 useRecommendations가 처리 — 여기선 지도 빠른필터 + 키워드/지역만.
  const housings = useMemo(
    () =>
      applyFilters(sorted, fType, fDeposit, fYear, fScore).filter(
        (h) =>
          // 문자열 일치(주택명·주소·구·동) 또는 매칭된 거점 영향권 안이면 통과.
          kwMatch(h, appliedKw) ||
          kwLandmarks.some(
            (l) =>
              h.lat != null && h.lng != null && withinLandmark(h.lat, h.lng, l),
          ),
      ),
    [sorted, fType, fDeposit, fYear, fScore, appliedKw, kwLandmarks],
  )
  // 추천 상위(홈 탭과 동일 집합) — 지도에서 강조 핀으로 찍는다. 빠른필터·정렬과 무관하게
  // 전체 추천에서 뽑아 안정적으로 유지. 취향을 아직 안 정한(건너뛰기) 상태에선 점수가
  // placeholder라 실제 추천이 아니므로 강조하지 않는다.
  const topIds = useMemo(
    () => new Set(personalized ? topPicks(items).map((h) => h.id) : []),
    [items, personalized],
  )
  // 첫 진입 중심 — 추천 1위 매물 좌표(위치 권한 없이 지도를 이 지점으로 잡는다).
  // 취향 미설정 시엔 추천 1위가 임의 placeholder라 중심을 잡지 않고 부산 기본으로 둔다.
  const initialCenter = useMemo(() => {
    if (!personalized) return null
    const top = topPicks(items)[0]
    return top?.lat != null && top?.lng != null
      ? { lat: top.lat, lng: top.lng }
      : null
  }, [items, personalized])
  const markers = useMemo(
    () =>
      housings
        .map(toMarker)
        .filter((m): m is HomeMarker => m != null)
        .map((m) => ({ ...m, top: topIds.has(m.id) })),
    [housings, topIds],
  )
  // 지도 화면 범위 + 마커 선택 — 리스트는 '화면 안 매물' 또는 '선택한 마커의 매물'만 보여준다.
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  const { setMapEl, zoomIn, zoomOut, panTo } = useNaverMap(
    markers,
    setSelectedIds, // 마커 클릭 → 해당 매물 id들(빈 지도 클릭 → null 해제)
    // 팬·줌 → 화면 범위 갱신. 선택은 유지 — 지도를 움직여도 선택한 마커 매물을 계속 표시.
    // (해제는 '× 전체' 버튼 또는 빈 지도 클릭으로만.)
    setBounds,
    initialCenter,
  )
  // 지역/거점 검색 시 지도를 그 위치로 이동 — 최상위(중요도) 거점 기준.
  const topLm = kwLandmarks[0]
  const topLmId = topLm?.id
  // 매칭 거점들의 최대 영향권 = 검색 결과가 퍼진 반경(배너 표기용).
  const kwRadiusKm = kwLandmarks.length
    ? Math.max(...kwLandmarks.map((l) => l.radiusM)) / 1000
    : 0
  useEffect(() => {
    if (topLm) panTo(topLm.lat, topLm.lng)
    // topLmId 변화(=검색 거점 변경) 시에만 이동 — 매 렌더 팬 방지.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLmId, panTo])
  // 선택이 있으면 그 매물만, 없으면 현재 화면 범위 안의 매물만.
  const visible = useMemo(() => {
    if (selectedIds) {
      const ids = new Set(selectedIds)
      return housings.filter((h) => ids.has(h.id))
    }
    if (!bounds) return housings
    return housings.filter(
      (h) =>
        h.lat != null &&
        h.lng != null &&
        h.lat >= bounds.swLat &&
        h.lat <= bounds.neLat &&
        h.lng >= bounds.swLng &&
        h.lng <= bounds.neLng,
    )
  }, [housings, selectedIds, bounds])
  const prefTags = s.selectedTags.map((id) => {
    const t = byTagId[id]
    return { icon: t?.icon, label: t?.label, lvl: s.tagWeights[id] || 2 }
  })
  const regionLabel = s.regions.length
    ? s.regions[0] +
      (s.regions.length > 1 ? ` 외 ${s.regions.length - 1}곳` : '')
    : '전체'
  const houseLabel = s.houseTypes.join(', ') || '전체'
  const prefMeta = [
    {
      icon: 'account_balance_wallet',
      label: `보증금 ${s.depositMax.toLocaleString()} · 월 ${s.rentMax}만원`,
    },
    { icon: 'place', label: regionLabel },
    { icon: 'home_work', label: houseLabel },
    ...(s.elevatorRequired
      ? [{ icon: 'elevator', label: '엘리베이터 필수' }]
      : []),
    ...(s.parkingRequired
      ? [{ icon: 'local_parking', label: '주차 필수' }]
      : []),
  ]
  const housingList = visible.map((dto) => {
    const h = toCard(dto)
    const fav = !!s.favorites[h.id]
    return {
      ...h,
      fav,
      scoreSource: dto.scoreSource,
      image: houseImage(dto).src,
      goDetail: goDetail(h.id),
      toggleFav: (e: MouseEvent) => {
        e.stopPropagation()
        toggle(h.id, h.name)
      },
    }
  })
  const resetFilters = () => {
    setFType('')
    setFDeposit('')
    setFYear('')
    setFScore('')
    setSortBy('score')
    toast('필터를 초기화했어요')
  }

  return (
    <Card
      className={`relative w-full animate-rise overflow-hidden transition-[max-width] duration-300 ease-out ${
        aiOpen ? 'max-w-[1600px]' : 'max-w-[1180px]'
      }`}
    >
      {/* 상단 바 — 키워드 검색 + AI 대화 버튼 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-3.5">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[11px] border border-line bg-panel px-3.5 py-2.5 transition-colors focus-within:border-teal focus-within:bg-white">
          <span className="ms text-[19px] text-faint">search</span>
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="지역·주택명·주소로 검색"
            className="w-full border-none bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          {kw && (
            <button
              onClick={() => {
                setKw('')
                setAppliedKw('')
              }}
              aria-label="검색어 지우기"
              className="rounded-full p-0.5 leading-[0] text-faint transition-colors hover:text-body"
            >
              <span className="ms text-[18px]">close</span>
            </button>
          )}
        </label>
        <Button
          onClick={() => setAiOpen((o) => !o)}
          aria-pressed={aiOpen}
          className="flex items-center gap-1.5 rounded-[22px] px-[18px] py-2.5 text-[14px]"
        >
          <span className="ms text-[18px]">auto_awesome</span>AI 검색
        </Button>
      </div>

      {/* 지역/거점 검색 안내 — 키워드가 거점과 맞으면 그 반경 매물을 보여준다. */}
      {kwLandmarks.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-teal/15 bg-teal-ghost px-5 py-2 text-[12px] text-body">
          <span className="ms text-[16px] text-teal">place</span>
          <b className="text-teal">‘{topLm.name}’</b> 인근 매물이에요 · 반경{' '}
          {kwRadiusKm % 1 ? kwRadiusKm.toFixed(1) : kwRadiusKm}km
        </div>
      )}

      {/* 빠른 필터 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3">
        <FilterSelect
          value={fType}
          onChange={setFType}
          placeholder="임대유형"
          options={typeOpts.map((t) => [t, t])}
        />
        <FilterSelect
          value={fDeposit}
          onChange={setFDeposit}
          placeholder="보증금"
          options={DEPOSIT_OPTS.map(([l, v]) => [l, String(v)])}
        />
        <FilterSelect
          value={fYear}
          onChange={setFYear}
          placeholder="준공연도"
          options={YEAR_OPTS.map(([l, v]) => [l, String(v)])}
        />
        <ScoreFilter value={fScore} onChange={setFScore} />
        {(fType || fDeposit || fYear || fScore) && (
          <button
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-semibold text-sub transition-colors hover:text-teal"
          >
            <span className="ms text-[16px]">refresh</span>재설정
          </button>
        )}
      </div>

      {/* 내 맞춤 조건 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-panel px-5 py-3">
        <span className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-teal px-3 py-1.5 text-[12px] font-bold text-white">
          <span className="ms text-[14px]">person</span>내 맞춤 조건
        </span>
        <ScrollStrip className="min-w-[200px] flex-1">
          {prefTags.map((t, idx) => (
            <span
              key={idx}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-[20px] border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-body"
            >
              <span className="ms text-[15px] text-teal">{t.icon}</span>
              {t.label}
              <span className="flex items-center gap-0.5">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`inline-block h-[5px] w-[5px] rounded-full ${
                      n <= t.lvl ? 'bg-teal' : 'bg-line'
                    }`}
                  />
                ))}
              </span>
            </span>
          ))}
          {prefMeta.map((m, idx) => (
            <span
              key={idx}
              className="flex flex-shrink-0 items-center gap-1 rounded-[20px] bg-teal-soft px-3 py-1.5 text-[12px] font-semibold text-teal"
            >
              <span className="ms text-[15px]">{m.icon}</span>
              {m.label}
            </span>
          ))}
        </ScrollStrip>
        <button
          onClick={goPreference}
          className="flex items-center gap-1 whitespace-nowrap rounded-[9px] border border-line bg-white px-3 py-[7px] text-[12.5px] font-bold text-body transition-colors hover:border-teal/45 hover:text-teal"
        >
          <span className="ms text-[15px]">compare_arrows</span>취향 다시 학습
        </button>
        <button
          onClick={goSetup}
          className="flex items-center gap-1 whitespace-nowrap rounded-[9px] border border-line bg-white px-3 py-[7px] text-[12.5px] font-bold text-body transition-colors hover:border-teal/45 hover:text-teal"
        >
          <span className="ms text-[15px]">tune</span>조건
        </button>
      </div>

      {/* 지도 + 목록 + AI 대화 — 대화가 열리면 지도·리스트가 왼쪽으로 밀리고 대화창이 오른쪽 컬럼으로 자리한다(겹침 없음). */}
      <div className="flex">
        <div className="flex min-w-0 flex-1 flex-wrap">
          <div className="relative h-[420px] w-full overflow-hidden bg-[#e4f5f2] md:h-[560px] md:min-w-[340px] md:flex-1">
            {/* 높이는 h-full(부모 560px의 100%)로 준다 — Naver SDK가 컨테이너 position을
              relative로 덮어써 absolute inset-0 기반 높이가 무너지기 때문. */}
            <div
              ref={setMapEl}
              className="naver-map absolute inset-0 h-full w-full z-0"
            />
            <div className="absolute left-4 top-4 z-[1000] flex flex-col overflow-hidden rounded-[10px] bg-white shadow-pop">
              <button
                onClick={zoomIn}
                aria-label="지도 확대"
                className="px-2.5 py-2 transition-colors hover:bg-panel"
              >
                <span className="ms text-[18px] text-body">add</span>
              </button>
              <span className="h-px bg-line-soft" />
              <button
                onClick={zoomOut}
                aria-label="지도 축소"
                className="px-2.5 py-2 transition-colors hover:bg-panel"
              >
                <span className="ms text-[18px] text-body">remove</span>
              </button>
            </div>
          </div>

          <div className="flex w-full flex-col border-t border-line-soft md:w-[420px] md:border-l md:border-t-0">
            <div className="flex items-center justify-between gap-2 border-b border-line-soft px-[18px] py-3">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold text-ink">
                  {selectedIds ? '선택 지점' : '이 지역'}{' '}
                  <span className="text-teal">{visible.length}</span>
                  <span className="text-[13px] font-bold text-sub">개</span>
                </span>
                {selectedIds && (
                  <button
                    onClick={() => setSelectedIds(null)}
                    className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] font-semibold text-sub transition-colors hover:text-teal"
                  >
                    <span className="ms text-[15px]">close</span>전체
                  </button>
                )}
              </div>
              <div className="flex gap-1 rounded-lg bg-panel p-0.5">
                {SORTS.map((so) => (
                  <button
                    key={so.key}
                    onClick={() => setSortBy(so.key)}
                    aria-pressed={sortBy === so.key}
                    className={`rounded-md px-2.5 py-1 text-[12px] font-bold transition-colors ${
                      sortBy === so.key
                        ? 'bg-white text-teal shadow-sm'
                        : 'text-sub hover:text-body'
                    }`}
                  >
                    {so.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {isError && <ErrorState />}
              {!isError && isLoading && (
                <LoadingState label="추천 주택을 불러오는 중…" />
              )}
              {!isError && !isLoading && housingList.length === 0 && (
                <EmptyState
                  label="조건에 맞는 주택이 없습니다."
                  sub="취향·조건을 넓혀보세요."
                />
              )}
              {housingList.map((h, i) => (
                <div
                  key={h.id}
                  onClick={h.goDetail}
                  className="group flex cursor-pointer gap-3 border-b border-line-soft px-[18px] py-3.5 transition-colors hover:bg-teal-ghost/60"
                >
                  <div className="relative h-24 w-[74px] shrink-0 overflow-hidden rounded-[10px] bg-panel">
                    <img
                      src={h.image}
                      alt={h.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-teal px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow-sm">
                      {h.score}점
                    </span>
                    <span className="absolute bottom-1 left-1.5 rounded bg-ink/55 px-1 text-[10px] font-bold tabular-nums text-white">
                      #{i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-extrabold text-ink">
                        {h.name}
                      </span>
                      {h.tag !== '매입임대' && (
                        <span className="shrink-0 rounded-[5px] bg-teal-soft px-1.5 py-0.5 text-[10.5px] font-bold text-teal">
                          {h.tag}
                        </span>
                      )}
                      <button
                        onClick={h.toggleFav}
                        aria-label={h.fav ? '관심 해제' : '관심 등록'}
                        className="ml-auto shrink-0 rounded-full p-1 leading-[0] transition-transform active:scale-90"
                      >
                        <span
                          className={`ms text-[19px] ${
                            h.fav ? 'text-heart' : 'text-faint hover:text-heart'
                          }`}
                        >
                          {h.fav ? 'favorite' : 'favorite_border'}
                        </span>
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-sub">
                      {h.loc}
                    </p>
                    <div className="mt-1.5 flex gap-3.5 text-[12.5px]">
                      <span className="text-sub">
                        보증금{' '}
                        <b className="tabular-nums text-ink">{h.deposit}</b>
                      </span>
                      <span className="text-sub">
                        월 <b className="tabular-nums text-ink">{h.rent}</b>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* AI 대화 — 오른쪽 컬럼. 열리면 폭 0→380으로 늘며 지도·리스트를 왼쪽으로 민다(겹침 없음). */}
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
            aiOpen ? 'w-full md:w-[380px]' : 'w-0'
          }`}
          aria-hidden={!aiOpen}
        >
          <div className="h-full w-full border-l border-line md:w-[380px]">
            <AiSearchPanel onClose={() => setAiOpen(false)} />
          </div>
        </div>
      </div>
    </Card>
  )
}

// 가로 스크롤 칩 스트립 — 넘칠 때만 스크롤한 방향으로 페이드+화살표를 켜 "더 있음"을 알린다.
// 화살표를 누르면 그쪽 끝까지 이동. 네이티브 스크롤바는 숨겨(정렬 밀림 방지) 대체한다.
function ScrollStrip({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })
  const update = () => {
    const el = ref.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setFade((p) => (p.left === left && p.right === right ? p : { left, right }))
  }
  // 렌더마다(칩 개수 변화 포함) 재계산 — setFade 가드로 루프 없음.
  useEffect(update)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 세로 휠 → 가로 스크롤(스크롤바 없는 마우스 사용자용). 더 밀 곳이 없으면
    // 가로채지 않고 페이지 세로 스크롤로 흘려보낸다.
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY || el.scrollWidth <= el.clientWidth) return
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', update)
    }
  }, [])
  const scrollToEnd = (dir: 'left' | 'right') => {
    const el = ref.current
    if (!el) return
    el.scrollTo({
      left: dir === 'left' ? 0 : el.scrollWidth,
      behavior: 'smooth',
    })
  }
  const l = fade.left ? 'transparent, #000 24px' : '#000 0'
  const r = fade.right ? '#000 calc(100% - 24px), transparent' : '#000 100%'
  const mask = `linear-gradient(to right, ${l}, ${r})`
  const arrow =
    'absolute top-1/2 z-[1] flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-body shadow-sm transition-colors hover:text-teal'
  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        onScroll={update}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="flex flex-nowrap gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {fade.left && (
        <button
          type="button"
          aria-label="처음으로"
          onClick={() => scrollToEnd('left')}
          className={`${arrow} left-0`}
        >
          <span className="ms text-[16px]">chevron_left</span>
        </button>
      )}
      {fade.right && (
        <button
          type="button"
          aria-label="끝으로"
          onClick={() => scrollToEnd('right')}
          className={`${arrow} right-0`}
        >
          <span className="ms text-[16px]">chevron_right</span>
        </button>
      )}
    </div>
  )
}

// 빠른 필터 — 커스텀 드롭다운(네이티브 select 대신 디자인된 메뉴). value=''이면 '전체'.
function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: [string, string][]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = !!value
  const current = options.find(([, v]) => v === value)?.[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const rows: [string, string][] = [['전체', ''], ...options]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-[9px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
          active
            ? 'border-teal bg-teal-soft text-teal'
            : open
              ? 'border-teal text-teal'
              : 'border-line text-body hover:border-teal/45'
        }`}
      >
        {current ?? placeholder}
        <span
          className={`ms text-[16px] transition-transform ${open ? 'rotate-180' : ''} ${
            active ? 'text-teal' : 'text-faint'
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div
          role="listbox"
          className="animate-toast-in absolute left-0 top-[calc(100%+6px)] z-[1200] min-w-[168px] overflow-hidden rounded-xl border border-line bg-white p-1 shadow-pop"
        >
          {rows.map(([label, v]) => {
            const on = v === value
            return (
              <button
                key={v || 'all'}
                role="option"
                aria-selected={on}
                onClick={() => pick(v)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-teal-ghost ${
                  on ? 'font-bold text-teal' : 'font-semibold text-body'
                }`}
              >
                {label}
                {on && <span className="ms text-[16px] text-teal">check</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 적합도 필터 — 슬라이더로 미세조정 + 프리셋 버튼으로 원터치. value=''이면 '전체'(필터 없음).
function ScoreFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = !!value
  const num = Number(value || 0)
  // 0 이하는 '전체'로 취급 — 빈 문자열로 되돌려 재설정 조건과 일관.
  const set = (n: number) => onChange(n <= 0 ? '' : String(n))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-[9px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
          active
            ? 'border-teal bg-teal-soft text-teal'
            : open
              ? 'border-teal text-teal'
              : 'border-line text-body hover:border-teal/45'
        }`}
      >
        {active ? `적합 ${num}↑` : '적합도'}
        <span
          className={`ms text-[16px] transition-transform ${open ? 'rotate-180' : ''} ${
            active ? 'text-teal' : 'text-faint'
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          className="animate-toast-in absolute left-0 top-[calc(100%+6px)] z-[1200] w-[252px] rounded-xl border border-line bg-white p-3.5 shadow-pop"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-sub">
              최소 적합도
            </span>
            <span className="rounded-md bg-teal-ghost px-2 py-0.5 text-[12.5px] font-bold tabular-nums text-teal">
              {active ? `${num} 이상` : '전체'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={num}
            onChange={(e) => set(+e.currentTarget.value)}
            aria-label="최소 적합도"
            className="mt-2.5 w-full accent-teal"
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-faint">
            <span>전체</span>
            <span>100</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {SCORE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => set(p)}
                aria-pressed={num === p}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] font-bold transition-colors ${
                  num === p
                    ? 'border-teal bg-teal-soft text-teal'
                    : 'border-line text-body hover:border-teal/45'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {active && (
            <button
              onClick={() => set(0)}
              className="mt-2.5 w-full rounded-lg py-1.5 text-[12px] font-semibold text-sub transition-colors hover:text-teal"
            >
              초기화
            </button>
          )}
        </div>
      )}
    </div>
  )
}
