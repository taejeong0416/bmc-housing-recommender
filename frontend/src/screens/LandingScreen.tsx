import { useEffect, useState } from 'react'
import { useNav } from '../nav'
import { Button } from '../components/ui/Button'

// 첫 화면 — 서비스가 무엇이고 무엇을 하면 되는지를 한 화면에서 알린다.
// 청약센터 공지에서 들어온 사용자가 조건 입력 폼부터 마주하지 않도록 흐름 앞에 둔다.
// 브랜드 마크를 크게 쓰는 화면은 여기뿐 — 이후 단계 화면은 헤더 마크만 갖는다.

// 히어로만 먼저 보인 뒤 왼쪽으로 비켜서고, 오른쪽에 미리보기가 들어온다(lg 이상).
// 히어로 등장은 전역 rise보다 느리게 — 마지막 줄이 다 올라온 뒤 480ms 쉬고 갈라진다.
const RISE_MS = 700
const RISE_STAGGER = [0, 160, 280, 380]
const SPLIT_DELAY = RISE_STAGGER[3] + RISE_MS + 480
// 미리보기 자동 넘김 간격. 탭을 누르면 그 시점부터 다시 센다.
const ROTATE_INTERVAL = 2000

// 실제 화면 캡처 — 탭으로 전환한다(모두 1200x700 비율).
const PREVIEWS = [
  {
    id: 'setup',
    label: '조건 설정',
    file: 'setup-preview.jpg',
    alt: '지역·예산·주택 조건과 신청 자격을 고르는 조건 설정 화면',
  },
  {
    id: 'swipe',
    label: '취향 비교',
    file: 'swipe-preview.jpg',
    alt: '두 가상 생활권을 나란히 놓고 하나를 고르는 취향 비교 화면',
  },
  {
    id: 'map',
    label: '지도·추천',
    file: 'map-preview.jpg',
    alt: '지도에 표시된 부산 공공임대 단지와 취향 적합도 순으로 정렬된 추천 목록',
  },
]

export default function LandingScreen() {
  const [index, setIndex] = useState(0)
  const [split, setSplit] = useState(false)
  const [paused, setPaused] = useState(false)
  const { go } = useNav()
  const goSetup = go('setup')

  useEffect(() => {
    const t = setTimeout(() => setSplit(true), SPLIT_DELAY)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!split || paused) return
    const t = setTimeout(
      () => setIndex((i) => (i + 1) % PREVIEWS.length),
      ROTATE_INTERVAL,
    )
    return () => clearTimeout(t)
  }, [split, paused, index])

  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-12 pt-4 sm:pt-12 lg:grid-cols-[42fr_58fr] lg:items-center lg:gap-10">
      {/* 42:58 칸에서 히어로를 69%(=29/42)만큼 밀어 두면 가운데에 온다. */}
      <section
        className={`text-center transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:text-left ${
          split ? '' : 'lg:translate-x-[69%]'
        }`}
      >
        <p
          className="animate-rise text-[46px] font-extrabold leading-[1.1] tracking-[-1.5px] text-teal sm:text-[64px]"
          style={{
            animationDuration: `${RISE_MS}ms`,
            animationDelay: `${RISE_STAGGER[0]}ms`,
          }}
        >
          Be:live
        </p>
        <h1
          className="animate-rise mx-auto mt-5 max-w-[620px] break-keep text-[24px] font-extrabold leading-[1.35] tracking-[-0.5px] text-ink sm:text-[30px] lg:mx-0"
          style={{
            animationDuration: `${RISE_MS}ms`,
            animationDelay: `${RISE_STAGGER[1]}ms`,
          }}
        >
          부산 공공임대, 어느 동네가 나와 맞을까
        </h1>
        <p
          className="animate-rise mx-auto mt-3 max-w-[560px] break-keep text-[14.5px] leading-[1.75] text-sub lg:mx-0"
          style={{
            animationDuration: `${RISE_MS}ms`,
            animationDelay: `${RISE_STAGGER[2]}ms`,
          }}
        >
          예산과 조건을 고르고 두 동네를 몇 번 비교하면,
          <br className="hidden sm:inline" />
          생활 취향에 맞는 단지를 지도 위에 순서대로 보여드려요.
        </p>
        <div
          className="animate-rise mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row lg:justify-start"
          style={{
            animationDuration: `${RISE_MS}ms`,
            animationDelay: `${RISE_STAGGER[3]}ms`,
          }}
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

      <section
        aria-label="화면 미리보기"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={`transition-[opacity,transform] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          split
            ? 'opacity-100'
            : 'pointer-events-none opacity-0 lg:translate-x-8'
        }`}
      >
        <div className="flex gap-2">
          {PREVIEWS.map((p, i) => {
            const active = i === index
            return (
              <button
                key={p.id}
                onClick={() => setIndex(i)}
                aria-pressed={active}
                className={`flex-1 rounded-[10px] border px-3 py-2.5 text-[13.5px] font-bold transition-colors ${
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
        <figure className="mt-3 overflow-hidden rounded-[14px] border border-line shadow-card">
          {/* 세 장을 겹쳐 두고 투명도로 넘긴다 — 자동 넘김 때 첫 로드 깜빡임이 없다. */}
          <div className="grid">
            {PREVIEWS.map((p, i) => (
              <img
                key={p.id}
                src={`${import.meta.env.BASE_URL}landing/${p.file}`}
                alt={i === index ? p.alt : ''}
                aria-hidden={i !== index}
                width={1200}
                height={700}
                decoding="async"
                className={`col-start-1 row-start-1 block aspect-[12/7] w-full object-cover transition-opacity duration-500 ${
                  i === index ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
          </div>
        </figure>
      </section>
    </div>
  )
}
