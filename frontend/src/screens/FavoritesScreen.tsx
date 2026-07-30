import type { MouseEvent } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { useHousings } from '../hooks/useHousings'
import { houseImage, toCard } from '../api/housings'
import { useFavorites } from '../hooks/useFavorites'
import {
  activeFavoriteCount,
  betaForFavorites,
  favoriteIds,
} from '../onboarding/refine'

export default function FavoritesScreen() {
  const { go, goDetail } = useNav()
  const goMap = go('map')
  const { data } = useHousings()
  const { favorites, toggle } = useFavorites()
  const patch = useStore((st) => st.patch)
  const learningEnabled = useStore((st) => st.state.favoriteLearningEnabled)
  const items = (data ?? [])
    .filter((dto) => favorites[dto.id])
    .map((dto) => ({ ...toCard(dto), image: houseImage(dto).src }))

  // 찜 기반 정교화 상태(§12.7) — 반영 강도 β와 학습 가능한 찜 수.
  const activeCount = activeFavoriteCount(favoriteIds(favorites))
  const beta = betaForFavorites(activeCount)

  return (
    <div className="w-full max-w-[960px] animate-rise">
      <div className="mb-4 flex items-center gap-1">
        <button
          onClick={goMap}
          aria-label="지도로 돌아가기"
          className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-body transition-colors hover:bg-white"
        >
          <span className="ms text-[22px]">arrow_back</span>
        </button>
        <h1 className="flex items-center gap-2 text-[18px] font-extrabold text-ink">
          <span className="ms text-[20px] text-heart">favorite</span>관심 목록
          {items.length > 0 && (
            <span className="rounded-full bg-teal-ghost px-2 py-0.5 text-[12px] font-bold text-teal">
              {items.length}
            </span>
          )}
        </h1>
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-line-soft bg-white px-4 py-3.5 shadow-card">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
              learningEnabled && activeCount > 0
                ? 'bg-teal-ghost text-teal'
                : 'bg-panel text-sub'
            }`}
          >
            <span className="ms text-[20px]">tune</span>
          </span>
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
                ? '찜 목록은 그대로예요. 다시 켜면 온보딩·직접 설정 위에 보수적으로 반영돼요.'
                : activeCount > 0
                  ? `반영 강도 최대 ${Math.round(beta * 100)}% · 찜을 빼면 그만큼 자동으로 취소돼요. 온보딩·직접 설정은 덮어쓰지 않아요.`
                  : '생활환경 데이터가 있는 찜이 쌓이면 취향을 조금씩 정교화해요.'}
            </span>
          </div>
          <button
            onClick={() => patch({ favoriteLearningEnabled: !learningEnabled })}
            aria-pressed={learningEnabled}
            className={`shrink-0 rounded-[10px] px-3 py-2 text-[12px] font-bold transition-colors ${
              learningEnabled
                ? 'bg-panel text-body hover:bg-teal-ghost hover:text-teal'
                : 'bg-teal text-white hover:bg-teal-dark'
            }`}
          >
            {learningEnabled ? '반영 끄기' : '다시 켜기'}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card">
          <span className="ms text-[40px] text-faint">favorite_border</span>
          <p className="mt-2 text-[15px] font-bold text-ink">
            아직 담은 주택이 없어요
          </p>
          <p className="mt-1 text-[13px] text-sub">
            지도에서 마음에 드는 단지의 하트를 눌러 담아보세요.
          </p>
          <button
            onClick={goMap}
            className="mt-4 inline-flex items-center gap-1 rounded-[11px] bg-teal px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm transition-colors hover:bg-teal-dark"
          >
            <span className="ms text-[17px]">map</span>지도에서 둘러보기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((h) => (
            <div
              key={h.id}
              onClick={goDetail(h.id)}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-pop"
            >
              <div className="relative h-32 overflow-hidden bg-panel">
                <img
                  src={h.image}
                  alt={h.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-2.5 top-2.5 rounded-md bg-teal px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white shadow-sm">
                  {h.score}%
                </span>
                <button
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    toggle(h.id, h.name)
                  }}
                  aria-label="관심 해제"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform active:scale-90"
                >
                  <span className="ms text-[18px] text-heart">favorite</span>
                </button>
              </div>
              <div className="p-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-extrabold text-ink">
                    {h.name}
                  </span>
                  {h.tag !== '매입임대' && (
                    <span className="shrink-0 rounded-[5px] bg-teal-soft px-1.5 py-0.5 text-[10.5px] font-bold text-teal">
                      {h.tag}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[12px] text-sub">{h.loc}</p>
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
