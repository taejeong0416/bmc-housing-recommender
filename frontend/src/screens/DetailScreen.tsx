import { useParams } from 'react-router-dom'
import { useNav } from '../nav'
import { useFavorites } from '../hooks/useFavorites'
import { useHousing } from '../hooks/useHousings'
import { useRecommendations } from '../hooks/useRecommendations'
import { toCard } from '../api/housings'
import { HousingDetailBody } from '../components/HousingDetailBody'
import { NoticePreview } from '../components/NoticePreview'
import { ScoreBar } from '../components/ScoreBar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States'
import { toast } from '../components/ui/toastStore'

export default function DetailScreen() {
  const { id } = useParams()
  const { go } = useNav()
  const goMap = go('map')
  // 지도에서 넘어온 추천 결과에 엔진 점수(취향·예산 매칭)가 담겨 있으면 그대로 소비.
  // 직접 URL 진입 등 추천 목록에 없으면 상세 fetch로 폴백(placeholder 점수).
  const { items } = useRecommendations()
  const recDto = items.find((it) => it.id === id)
  const {
    data: fetched,
    isLoading,
    isError,
  } = useHousing(recDto ? undefined : id)
  const dto = recDto ?? fetched
  const { favorites, toggle } = useFavorites()
  const h = dto ? toCard(dto) : undefined
  const learnedScore = dto?.scoreSource === 'engine'
  const fav = h ? !!favorites[h.id] : false
  const toggleFav = () => {
    if (h) toggle(h.id, h.name)
  }
  const share = () =>
    navigator.clipboard
      .writeText(location.href)
      .then(() => toast('상세 페이지 링크를 복사했어요'))
      .catch(() => toast('복사하지 못했어요. 주소창에서 복사해 주세요.'))
  // 부산도시공사 청약센터(모집공고 원문 안내 URL) — 새 탭으로 이동.
  const goApply = () =>
    window.open('https://apply.bmc.busan.kr', '_blank', 'noopener,noreferrer')

  if (isLoading || isError || !dto || !h) {
    return (
      <Card className="w-full max-w-[640px] p-2">
        <button
          onClick={goMap}
          className="flex items-center gap-1.5 rounded-lg p-3 text-[13.5px] font-semibold text-body transition-colors hover:text-teal"
        >
          <span className="ms text-[19px]">arrow_back</span>목록으로
        </button>
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState />
        ) : (
          <EmptyState
            label="주택 정보를 찾을 수 없습니다."
            sub="목록에서 다시 선택해 주세요."
          />
        )}
      </Card>
    )
  }

  return (
    <div className="w-full max-w-[1000px] animate-rise lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
      {/* 본문 */}
      <Card className="mx-auto w-full max-w-[640px] overflow-hidden lg:mx-0 lg:max-w-none">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <button
            onClick={goMap}
            className="flex items-center gap-1.5 text-[13.5px] font-semibold text-body transition-colors hover:text-teal"
          >
            <span className="ms text-[19px]">arrow_back</span>목록으로
          </button>
          <div className="flex gap-1">
            <button
              onClick={toggleFav}
              aria-label={fav ? '관심 해제' : '관심 등록'}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-body transition-colors hover:bg-teal-ghost"
            >
              <span
                className={`ms text-[18px] ${fav ? 'text-heart' : 'text-body'}`}
              >
                {fav ? 'favorite' : 'favorite_border'}
              </span>
              관심
            </button>
            <button
              onClick={share}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-body transition-colors hover:bg-teal-ghost"
            >
              <span className="ms text-[17px]">ios_share</span>공유
            </button>
          </div>
        </div>

        <HousingDetailBody dto={dto} />

        {/* 모바일 — 청약 CTA는 하단 고정이라 그 위에 공고 미리보기를 둔다(데스크톱은 우측 요약에). */}
        <div className="px-5 pb-4 lg:hidden">
          <NoticePreview tag={h.tag} />
        </div>

        {/* 모바일 하단 고정 CTA */}
        <div className="sticky bottom-0 flex gap-2.5 border-t border-line-soft bg-white/95 px-5 py-4 backdrop-blur-sm lg:hidden">
          <Button
            variant="outline"
            onClick={toggleFav}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] p-[13px] text-[15px]"
          >
            <span className={`ms text-[19px] ${fav ? 'text-heart' : ''}`}>
              {fav ? 'favorite' : 'favorite_border'}
            </span>
            {fav ? '관심 등록됨' : '관심 등록'}
          </Button>
          <Button
            variant="gold"
            onClick={goApply}
            className="flex-[1.4] rounded-[12px] p-[13px] text-[15px]"
          >
            청약센터 바로가기
          </Button>
        </div>
      </Card>

      {/* 데스크톱 우측 sticky 요약 */}
      <aside className="mx-auto mt-3.5 hidden w-full max-w-[640px] lg:mx-0 lg:mt-0 lg:block">
        <div className="lg:sticky lg:top-6">
          <Card className="p-5">
            <p className="text-[11.5px] font-semibold text-sub">
              {learnedScore ? '생활취향 적합도' : '매칭 점수'}
            </p>
            <p className="text-[34px] font-extrabold leading-none tabular-nums text-teal">
              {h.score}
              {!learnedScore && <span className="text-[18px]">%</span>}
            </p>
            <ScoreBar score={h.score} className="mt-2.5" />
            <div className="mt-4 space-y-2 border-t border-line-soft pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-sub">보증금</span>
                <span className="text-[14px] font-extrabold tabular-nums text-ink">
                  {h.deposit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-sub">월 임대료</span>
                <span className="text-[14px] font-extrabold tabular-nums text-ink">
                  {h.rent}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={toggleFav}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[12px] p-3 text-[14px]"
            >
              <span className={`ms text-[18px] ${fav ? 'text-heart' : ''}`}>
                {fav ? 'favorite' : 'favorite_border'}
              </span>
              {fav ? '관심 등록됨' : '관심 등록'}
            </Button>
            <Button
              variant="gold"
              onClick={goApply}
              className="mt-2 w-full rounded-[12px] p-3 text-[14px]"
            >
              청약센터 바로가기
            </Button>
            <NoticePreview tag={h.tag} className="mt-3" />
            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-sub">
              <span className="ms mt-px text-[14px] text-teal">
                verified_user
              </span>
              청약 신청·자격 조회에는 본인인증이 필요합니다.
            </p>
          </Card>
        </div>
      </aside>
    </div>
  )
}
