import { useMemo, useRef, useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { useRecommendations } from '../hooks/useRecommendations'
import { useFavorites } from '../hooks/useFavorites'
import { houseImage, toCard } from '../api/housings'
import { topPicks, TOP_PICK_COUNT } from '../lib/topPicks'
import { HousingDetailBody } from '../components/HousingDetailBody'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'

// 홈 탭 — 추천점수 상위 매물의 마스터·디테일 화면.
// (데스크톱) 왼쪽: 상위 N 목록 / 오른쪽: 선택 매물의 상세 본문을 카드로 슬라이드.
// (모바일) 목록은 숨기고 상세 카드만 좌우 스와이프. 목록↔카드는 cur로 동기화된다.
// 랭킹·필터는 지도와 같은 useRecommendations 이음새를 공유하고, 여기선 상위 N만 추린다.
export default function HomeScreen() {
  const { go, goDetail } = useNav()
  const goMap = go('map')
  const { toggle } = useFavorites()
  const favorites = useStore((s) => s.state.favorites)
  const { items, isLoading, isError, personalized } = useRecommendations()

  const picks = useMemo(() => topPicks(items), [items])
  const cards = picks.map((p, i) => ({
    ...toCard(p),
    rank: i + 1,
    image: houseImage(p).src,
  }))

  const [index, setIndex] = useState(0)
  // 데이터가 줄어 index가 범위를 벗어나도 항상 유효한 후보를 읽도록 클램프.
  const cur = picks.length ? Math.min(index, picks.length - 1) : 0
  const dto = picks[cur]
  const prev = () => setIndex(Math.max(0, cur - 1))
  const next = () => setIndex(Math.min(picks.length - 1, cur + 1))

  // 터치 스와이프 — 가로 이동이 세로보다 크고 임계값을 넘을 때만 카드 전환(세로 스크롤과 분리).
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next()
      else prev()
    }
  }

  const fav = dto ? !!favorites[dto.id] : false

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1120px] animate-rise">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-[20px] font-extrabold text-ink">
          <span className="ms text-[24px] text-teal">recommend</span>추천 홈
        </h1>
        <p className="mt-1 text-[13.5px] text-sub">
          {personalized
            ? '학습한 취향에 가장 잘 맞는 상위'
            : '조건에 맞는 추천점수 상위'}{' '}
          <b className="text-teal">{TOP_PICK_COUNT}곳</b>을 넘겨보세요.
        </p>
      </div>

      {personalized && (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-teal/15 bg-teal-ghost px-4 py-2.5 text-[12.5px] text-body">
          <span className="ms text-[17px] text-teal">psychology</span>
          <b className="text-teal">취향 반영 추천</b>
        </div>
      )}

      {isError && <ErrorState />}
      {!isError && isLoading && (
        <LoadingState label="추천 주택을 불러오는 중…" />
      )}
      {!isError && !isLoading && picks.length === 0 && (
        <EmptyState
          label="추천할 주택이 없습니다."
          sub="취향·조건을 넓혀보세요."
        />
      )}

      {dto && (
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-5">
          {/* 왼쪽 목록 — 데스크톱만. 클릭하면 오른쪽 카드가 그 매물로 슬라이드. */}
          <aside className="hidden lg:block">
            <p className="mb-2 px-1 text-[12px] font-bold text-sub">
              추천 목록 <span className="text-faint">{picks.length}곳</span>
            </p>
            <div className="flex max-h-[74vh] min-h-[440px] flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
              {cards.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setIndex(i)}
                  aria-current={i === cur}
                  className={`flex w-full gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    i === cur
                      ? 'border-teal bg-teal-ghost'
                      : 'border-line-soft bg-white hover:border-teal/40'
                  }`}
                >
                  <div className="relative h-16 w-20 flex-none overflow-hidden rounded-lg bg-panel">
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-gold px-1 py-px text-[10px] font-extrabold tabular-nums text-gold-ink">
                      {c.rank}위
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="truncate text-[13.5px] font-extrabold text-ink">
                        {c.name}
                      </span>
                      <span className="shrink-0 rounded bg-teal-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-teal">
                        {c.score}점
                      </span>
                    </div>
                    <p className="truncate text-[11.5px] text-sub">{c.loc}</p>
                    <p className="mt-0.5 truncate text-[11px] tabular-nums text-sub">
                      보 {c.deposit} · 월 {c.rent}
                    </p>
                    {c.highlight && (
                      <p className="mt-1 flex items-center gap-1 truncate text-[10.5px] font-semibold text-teal">
                        <span className="ms shrink-0 text-[13px] leading-none">
                          psychology
                        </span>
                        <span className="truncate">{c.highlight}</span>
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* 오른쪽 상세 카드 */}
          <div className="min-w-0">
            {/* 상단 — 현재 순위 */}
            <div className="mb-3 flex items-center justify-center">
              <span className="flex items-center gap-1 text-[13px] font-bold text-sub">
                <span className="ms text-[16px] text-gold">star</span>
                추천 <b className="tabular-nums text-teal">{cur + 1}</b>위
                <span className="text-faint">/ {picks.length}</span>
              </span>
            </div>

            {/* 상세 카드 캐러셀 — 5장을 가로로 붙인 트랙을 translateX로 실제 슬라이드.
                각 슬라이드는 고정 높이 안에서 내부 세로 스크롤. 화살표·관심 버튼은 트랙 밖
                (카드 고정)이라 어디까지 내려도, 또 슬라이드 중에도 늘 제자리에 보인다. */}
            <div className="group relative h-[74vh] max-h-[820px] min-h-[440px] overflow-hidden rounded-2xl bg-white shadow-card">
              {cur > 0 && (
                <button
                  onClick={prev}
                  aria-label="이전 추천"
                  className="absolute left-3 top-1/2 z-20 flex h-24 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-ink/45 text-white opacity-0 shadow-md backdrop-blur-sm transition-opacity hover:bg-ink/65 group-hover:opacity-100"
                >
                  <span className="ms text-[24px]">chevron_left</span>
                </button>
              )}
              {cur < picks.length - 1 && (
                <button
                  onClick={next}
                  aria-label="다음 추천"
                  className="absolute right-3 top-1/2 z-20 flex h-24 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-ink/45 text-white opacity-0 shadow-md backdrop-blur-sm transition-opacity hover:bg-ink/65 group-hover:opacity-100"
                >
                  <span className="ms text-[24px]">chevron_right</span>
                </button>
              )}
              <button
                onClick={() => toggle(dto.id, dto.name)}
                aria-label={fav ? '관심 해제' : '관심 등록'}
                className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform active:scale-90"
              >
                <span
                  className={`ms text-[20px] ${
                    fav ? 'text-heart' : 'text-faint hover:text-heart'
                  }`}
                >
                  {fav ? 'favorite' : 'favorite_border'}
                </span>
              </button>

              {/* 슬라이드 트랙 — 순위 이동 시 가로로 미끄러진다 */}
              <div
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                className="flex h-full transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${cur * 100}%)` }}
              >
                {picks.map((p) => (
                  <div
                    key={p.id}
                    className="h-full w-full flex-none overflow-y-auto overscroll-contain"
                  >
                    <HousingDetailBody dto={p} variant="embed" />
                    <div className="px-5 pb-5">
                      <button
                        onClick={goDetail(p.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-teal px-5 py-3 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-teal-dark"
                      >
                        상세 페이지 열기
                        <span className="ms text-[19px]">open_in_new</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 하단 점 인디케이터 */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {picks.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setIndex(i)}
                  aria-label={`추천 ${i + 1}위 보기`}
                  aria-current={i === cur}
                  className={`h-2 rounded-full transition-all ${
                    i === cur ? 'w-5 bg-teal' : 'w-2 bg-line hover:bg-teal/40'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={goMap}
              className="mx-auto mt-5 flex items-center gap-1.5 rounded-[12px] border border-line bg-white px-5 py-3 text-[14px] font-bold text-body shadow-sm transition-colors hover:border-teal/40 hover:text-teal"
            >
              <span className="ms text-[19px]">map</span>지도에서 전체 매물 보기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
