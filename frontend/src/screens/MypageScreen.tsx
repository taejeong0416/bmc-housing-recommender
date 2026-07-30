import { useNav } from '../nav'
import { useStore } from '../store'
import { myMenuGroups } from '../data'
import { useHousings } from '../hooks/useHousings'
import { houseImage, toCard } from '../api/housings'
import { Toggle } from '../components/ui/Toggle'
import { soon, toast } from '../components/ui/toastStore'

export default function MypageScreen() {
  const { go, goDetail } = useNav()
  const goSetup = go('setup')
  const goMap = go('map')
  const goLogin = go('login')
  const goFavorites = go('favorites')
  const favorites = useStore((s) => s.state.favorites)
  const learningOn = useStore((s) => s.state.favoriteLearningEnabled)
  const patch = useStore((s) => s.patch)
  const toggleLearning = () => {
    const next = !learningOn
    // 최초 물음 여부와 무관하게 설정에서 켜고 끌 수 있게 seen도 함께 확정.
    patch({ favoriteLearningEnabled: next, learningPromptSeen: true })
    toast(next ? '취향 학습을 켰어요' : '취향 학습을 껐어요')
  }
  // 선택형 의료축(§9.2) — 기본 8축 학습과 분리된 조건부 축. 명시적으로 켤 때만 랭킹 반영.
  const medicalOn = useStore((s) => s.state.medicalPreferred)
  const toggleMedical = () => {
    const next = !medicalOn
    patch({ medicalPreferred: next })
    toast(next ? '의료 접근을 추천에 반영해요' : '의료 접근 반영을 껐어요')
  }
  const { data } = useHousings()
  const myInterests = (data ?? [])
    .filter((dto) => favorites[dto.id])
    .map((dto) => {
      const h = toCard(dto)
      return { ...h, image: houseImage(dto).src, goDetail: goDetail(h.id) }
    })
  const favCount = myInterests.length
  const logout = () => {
    patch({ loggedIn: false })
    goLogin()
  }

  return (
    <div className="w-full max-w-[960px] animate-rise">
      {/* 헤더 */}
      <div className="flex items-center gap-1">
        <button
          onClick={goMap}
          aria-label="지도로 돌아가기"
          className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-body transition-colors hover:bg-panel"
        >
          <span className="ms text-[22px]">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-extrabold text-ink">마이페이지</h1>
      </div>

      <div className="mt-3.5 flex flex-col gap-3.5 lg:grid lg:grid-cols-[320px_1fr] lg:gap-x-5 lg:gap-y-3.5">
        {/* 프로필 — 좌 상단 */}
        <div className="order-1 rounded-2xl bg-white p-5 shadow-card lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-ghost">
              <span className="ms text-[30px] text-teal">person</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[17px] font-extrabold text-ink">
                  김부산 님
                </span>
                <span className="flex items-center gap-0.5 rounded-full bg-teal-soft px-1.5 py-0.5 text-[10.5px] font-bold text-teal">
                  <span className="ms text-[12px]">verified</span>본인인증
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-sub">
                청년 · 무주택 세대구성원
              </p>
            </div>
          </div>
          <button
            onClick={goSetup}
            className="mt-4 w-full rounded-xl border border-line py-2.5 text-[13px] font-bold text-teal transition-colors hover:bg-teal-ghost"
          >
            취향·조건 설정
          </button>
        </div>

        {/* 관심 목록 — 우측 메인 */}
        <div className="order-2 self-start rounded-2xl bg-white px-5 py-[18px] shadow-card lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[14.5px] font-extrabold text-ink">
              <span className="ms text-[18px] text-heart">favorite</span>
              관심 목록
              {favCount > 0 && (
                <span className="rounded-full bg-teal-ghost px-2 py-0.5 text-[11.5px] font-bold text-teal">
                  {favCount}
                </span>
              )}
            </span>
            <button
              onClick={goFavorites}
              className="text-[12px] font-bold text-teal transition-colors hover:text-teal-dark"
            >
              전체 보기
            </button>
          </div>
          {myInterests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-panel/50 py-10 text-center">
              <span className="ms text-[28px] text-faint">favorite_border</span>
              <p className="mt-1.5 text-[13px] text-sub">
                아직 담은 주택이 없어요.
              </p>
              <button
                onClick={goMap}
                className="mt-2 text-[12.5px] font-bold text-teal transition-colors hover:text-teal-dark"
              >
                지도에서 둘러보기 →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {myInterests.map((h) => (
                <div
                  key={h.id}
                  onClick={h.goDetail}
                  className="group flex cursor-pointer gap-3 border-t border-line-soft py-2.5 transition-colors hover:bg-teal-ghost/50"
                >
                  <img
                    src={h.image}
                    alt={h.name}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-[9px] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-bold text-ink">
                        {h.name}
                      </span>
                      {h.tag !== '매입임대' && (
                        <span className="shrink-0 rounded bg-teal-soft px-1.5 py-px text-[10px] font-bold text-teal">
                          {h.tag}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-sub">
                      {h.loc} · 보증금 {h.deposit} / 월 {h.rent}
                    </p>
                  </div>
                  <span className="self-center rounded-md bg-teal px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-white">
                    {h.score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 메뉴 그룹 + 로그아웃 — 좌 하단 */}
        <div className="order-3 flex flex-col gap-3.5 lg:col-start-1 lg:row-start-2">
          {/* 취향 학습 on/off — 찜·스와이프 행동 반영 여부(맥락 동의와 동일 소스). */}
          <div>
            <p className="mb-1.5 px-1 text-[12px] font-bold text-faint">
              추천 설정
            </p>
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-[13px] shadow-card">
              <span className="ms text-[19px] text-teal">psychology</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">
                  취향 학습
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-sub">
                  찜·둘러본 집으로 추천을 정교하게 맞춰요
                </span>
              </span>
              <Toggle
                on={learningOn}
                onClick={toggleLearning}
                ariaLabel="취향 학습 켜기/끄기"
              />
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-[13px] shadow-card">
              <span className="ms text-[19px] text-teal">local_hospital</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">
                  의료 접근 중요
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-sub">
                  병원·약국이 가까운 집을 추천에서 더 높여요
                </span>
              </span>
              <Toggle
                on={medicalOn}
                onClick={toggleMedical}
                ariaLabel="의료 접근 중요 켜기/끄기"
              />
            </div>
          </div>
          {myMenuGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-1 text-[12px] font-bold text-faint">
                {group.title}
              </p>
              <div className="overflow-hidden rounded-2xl bg-white shadow-card">
                {group.items.map((m) => (
                  <button
                    key={m.label}
                    onClick={m.to ? go(m.to) : soon(m.label)}
                    className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-[13px] text-left transition-colors last:border-b-0 hover:bg-panel"
                  >
                    <span className="ms text-[19px] text-teal">{m.icon}</span>
                    <span className="flex-1 text-[13.5px] font-semibold text-ink">
                      {m.label}
                    </span>
                    {m.sub && (
                      <span className="text-[12px] font-semibold text-sub">
                        {m.sub}
                      </span>
                    )}
                    <span className="ms text-[18px] text-faint">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-[13px] text-left text-[13.5px] font-semibold text-body shadow-card transition-colors hover:bg-panel"
          >
            <span className="ms text-[19px] text-faint">logout</span>로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
