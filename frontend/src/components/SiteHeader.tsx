import { useLocation } from 'react-router-dom'
import { SCREEN_PATHS, useNav } from '../nav'
import { useStore } from '../store'
import type { ScreenId } from '../types'

// short는 모바일 폭에서 쓰는 짧은 이름
const NAV: { id: ScreenId; label: string; short: string }[] = [
  { id: 'home', label: '추천 홈', short: '홈' },
  { id: 'map', label: '지도·추천', short: '지도' },
  { id: 'favorites', label: '관심 목록', short: '관심' },
  { id: 'setup', label: '취향·조건', short: '조건' },
]

// 전역 웹 헤더 — 전 화면 공통. 실제 웹사이트 상단 네비게이션.
export default function SiteHeader() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const { go } = useNav()
  const favCount = useStore(
    (s) => Object.values(s.state.favorites).filter(Boolean).length,
  )

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-5 py-2">
        <button
          onClick={go('home')}
          className="flex h-11 items-baseline gap-2 pr-2 pt-2.5"
          aria-label="홈"
        >
          <span className="font-display text-[20px] font-extrabold tracking-[-0.5px] text-teal">
            Be:live
          </span>
          <span className="hidden text-[12px] font-medium text-sub md:inline">
            상권·취향 기반 임대 주택 추천 서비스
          </span>
        </button>

        {/* 랜딩에서는 네비를 감춘다 — 시작 CTA 하나로만 들어가게 둔다. */}
        <div className="ml-auto flex items-center gap-1">
          {!isLanding &&
            NAV.map((n) => {
              const active = pathname === SCREEN_PATHS[n.id]
              return (
                <button
                  key={n.id}
                  onClick={go(n.id)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={n.label}
                  className={`relative flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-semibold transition-colors ${
                    active
                      ? 'bg-panel text-teal'
                      : 'text-body hover:bg-panel hover:text-teal'
                  }`}
                >
                  <span className="sm:hidden">{n.short}</span>
                  <span className="hidden sm:inline">{n.label}</span>
                  {n.id === 'favorites' && favCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-heart px-1 text-[10px] font-bold text-white sm:static sm:ml-0.5">
                      {favCount}
                    </span>
                  )}
                </button>
              )
            })}
        </div>
      </div>
    </header>
  )
}
