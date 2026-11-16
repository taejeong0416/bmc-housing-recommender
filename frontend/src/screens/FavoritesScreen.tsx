import type { MouseEvent } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { useRecommendations } from '../hooks/useRecommendations'
import { houseImage, toCard } from '../api/housings'
import { useFavorites } from '../hooks/useFavorites'
import { activeFavoriteCount, favoriteIds } from '../onboarding/refine'

export default function FavoritesScreen() {
  const { go, goDetail } = useNav()
  const goMap = go('map')
  // 추천 홈·상세와 같은 점수를 보이도록 추천 이음새의 전체 점수표에서 꺼낸다.
  const { all } = useRecommendations()
  const { favorites, toggle } = useFavorites()
  const patch = useStore((st) => st.patch)
  const learningEnabled = useStore((st) => st.state.favoriteLearningEnabled)
  const items = all
    .filter((dto) => favorites[dto.id])
    .map((dto) => ({
      ...toCard(dto),
      image: houseImage(dto).src,
      learned: dto.scoreSource === 'engine',
    }))

  // 찜 기반 정교화 상태(§12.7) — 반영 강도 β와 학습 가능한 찜 수.
  const activeCount = activeFavoriteCount(favoriteIds(favorites))

  return (
    <div className="w-full max-w-[960px] animate-rise">
      <div className="mb-4 flex items-center gap-1">
        <button
          onClick={goMap}
          aria-label="지도로 돌아가기"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-lg text-body transition-colors hover:bg-panel"
        >
          <span className="ms text-[22px]">arrow_back</span>
        </button>
        <h1 className="text-[24px] font-bold text-ink">
          관심 목록
          {items.length > 0 && (
            <span className="ml-2 tabular-nums text-sub">{items.length}</span>
          )}
        </h1>
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-[14px] bg-panel px-4 py-4">
          <div className="min-w-0 flex-1">
            <b className="block text-[13.5px] text-ink">
              {!learningEnabled
                ? '찜 기반 추천 반영을 꺼뒀어요'
                : activeCount > 0
                  ? `최근 찜한 후보 ${activeCount}곳이 추천에 반영되고 있어요`
                  : '반영할 생활환경 신호가 아직 없어요'}
            </b>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-sub">
              {!learningEnabled
                ? '다시 켜면 찜한 곳을 추천에 반영해요.'
                : activeCount > 0
                  ? '찜을 빼면 반영도 함께 빠져요.'
                  : '찜이 쌓이면 추천에 반영해요.'}
            </span>
          </div>
          <button
            onClick={() => patch({ favoriteLearningEnabled: !learningEnabled })}
            aria-pressed={learningEnabled}
            className={`shrink-0 rounded-[10px] px-3 py-2 text-[12px] font-bold transition-colors ${
              learningEnabled
                ? 'border border-line bg-white text-body hover:border-teal/45 hover:text-teal'
                : 'bg-teal text-white hover:bg-teal-dark'
            }`}
          >
            {learningEnabled ? '반영 끄기' : '다시 켜기'}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <p className="text-[16px] font-bold text-ink">
            아직 담은 주택이 없어요
          </p>
          <p className="mt-1 text-balance text-[13px] text-sub">
            지도에서 마음에 드는 단지의 하트를 눌러 담아보세요.
          </p>
          <button
            onClick={goMap}
            className="mt-4 inline-flex items-center rounded-[11px] bg-teal px-5 py-3 text-[13.5px] font-bold text-white transition-colors hover:bg-teal-dark"
          >
            지도에서 둘러보기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((h) => (
            <div
              key={h.id}
              onClick={goDetail(h.id)}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-white transition-colors hover:border-teal/45"
            >
              <div className="relative h-32 overflow-hidden bg-panel">
                <img
                  src={h.image}
                  alt={h.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    toggle(h.id, h.name)
                  }}
                  aria-label="관심 해제"
                  className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform active:scale-90"
                >
                  <span className="ms text-[18px] text-heart">favorite</span>
                </button>
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-bold text-ink">
                    {h.name}
                  </span>
                  <span className="shrink-0 text-[14px] font-bold tabular-nums text-teal">
                    {h.score}
                    {h.learned ? '점' : '%'}
                  </span>
                </div>
                <p className="mt-1 truncate text-[12px] text-sub">
                  {h.tag !== '매입임대' && (
                    <span className="mr-2 font-bold text-body">{h.tag}</span>
                  )}
                  {h.loc}
                </p>
                <div className="mt-2 flex gap-3 text-[12.5px]">
                  <span className="text-sub">
                    보증금 <b className="tabular-nums text-ink">{h.deposit}</b>
                  </span>
                  <span className="text-sub">
                    월 <b className="tabular-nums text-ink">{h.rent}</b>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
