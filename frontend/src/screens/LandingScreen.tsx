import { useState } from 'react'
import { useNav } from '../nav'
import { Button } from '../components/ui/Button'

// 첫 화면 — 서비스가 무엇이고 무엇을 하면 되는지를 한 화면에서 알린다.
// 청약센터 공지에서 들어온 사용자가 조건 입력 폼부터 마주하지 않도록 흐름 앞에 둔다.
// 브랜드 마크를 크게 쓰는 화면은 여기뿐 — 이후 단계 화면은 헤더 마크만 갖는다.

// 실제 화면 캡처 — 탭으로 전환한다(모두 1200x700 비율).
const PREVIEWS = [
  {
    id: 'setup',
    label: '조건 설정',
    file: 'setup-preview.jpg',
    caption: '지역·예산·주택 조건을 고르면 맞는 매물 수가 바로 바뀌어요.',
    alt: '지역·예산·주택 조건과 신청 자격을 고르는 조건 설정 화면',
  },
  {
    id: 'swipe',
    label: '취향 비교',
    file: 'swipe-preview.jpg',
    caption: '가상 생활권 A와 B 중 끌리는 쪽을 고르면 취향을 학습해요.',
    alt: '두 가상 생활권을 나란히 놓고 하나를 고르는 취향 비교 화면',
  },
  {
    id: 'map',
    label: '지도·추천',
    file: 'map-preview.jpg',
    caption: '취향에 맞는 순서로 정렬된 목록 옆에서 위치를 바로 확인해요.',
    alt: '지도에 표시된 부산 공공임대 단지와 취향 적합도 순으로 정렬된 추천 목록',
  },
]

export default function LandingScreen() {
  const [preview, setPreview] = useState(PREVIEWS[0])
  const { go } = useNav()
  const goSetup = go('setup')

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <section className="pt-4 text-center sm:pt-12">
        <p className="animate-rise text-[12.5px] font-bold tracking-[0.06em] text-teal">
          부산도시공사(BMC) 공공임대
        </p>
        <p
          className="animate-rise mt-2 text-[46px] font-extrabold leading-[1.1] tracking-[-1.5px] text-teal sm:text-[64px]"
          style={{ animationDelay: '90ms' }}
        >
          Be:live
        </p>
        <h1
          className="animate-rise mx-auto mt-5 max-w-[620px] text-[24px] font-extrabold leading-[1.35] tracking-[-0.5px] text-ink sm:text-[30px]"
          style={{ animationDelay: '180ms' }}
        >
          부산 공공임대, 어느 동네가 나와 맞을까
        </h1>
        <p
          className="animate-rise mx-auto mt-3 max-w-[560px] break-keep text-[14.5px] leading-[1.75] text-sub"
          style={{ animationDelay: '240ms' }}
        >
          예산과 조건을 고르고 두 동네를 몇 번 비교하면,
          <br className="hidden sm:inline" />
          생활 취향에 맞는 단지를 지도 위에 순서대로 보여드려요.
        </p>
        <div
          className="animate-rise mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row"
          style={{ animationDelay: '300ms' }}
        >
          <Button
            onClick={goSetup}
            className="w-full max-w-[280px] gap-1.5 rounded-[12px] px-6 py-3.5 text-[15px] sm:w-auto"
          >
            내 조건으로 시작하기
            <span className="ms text-[19px]">arrow_forward</span>
          </Button>
          <Button
            variant="outline"
            onClick={go('map')}
            className="w-full max-w-[280px] rounded-[12px] px-6 py-3.5 text-[15px] sm:w-auto"
          >
            지도 먼저 둘러보기
          </Button>
        </div>
      </section>

      <section className="mt-14 sm:mt-20">
        <h2 className="text-[15px] font-extrabold text-ink">화면 미리보기</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
          <div className="flex gap-2 sm:flex-col">
            {PREVIEWS.map((p) => {
              const active = p.id === preview.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPreview(p)}
                  aria-pressed={active}
                  className={`flex-1 rounded-[10px] border px-3 py-2.5 text-[13.5px] font-bold transition-colors sm:flex-none sm:text-left ${
                    active
                      ? 'border-teal bg-white text-teal shadow-[inset_0_0_0_0.5px_var(--color-teal)]'
                      : 'border-line bg-white text-body hover:border-teal/45'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <figure className="overflow-hidden rounded-[14px] border border-line shadow-card">
            <img
              src={`${import.meta.env.BASE_URL}landing/${preview.file}`}
              alt={preview.alt}
              width={1200}
              height={700}
              decoding="async"
              loading="lazy"
              className="block aspect-[12/7] w-full object-cover"
            />
            <figcaption className="border-t border-line bg-white px-4 py-3 text-[12.5px] leading-[1.7] text-sub">
              {preview.caption}
            </figcaption>
          </figure>
        </div>
      </section>
    </div>
  )
}
