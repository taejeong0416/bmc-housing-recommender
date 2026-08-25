import { useLocation } from 'react-router-dom'
import { SCREEN_PATHS, useNav } from '../nav'
import { useStore } from '../store'
import type { ScreenId } from '../types'

const NAV: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'home', label: '추천 홈', icon: 'home' },
  { id: 'map', label: '지도·추천', icon: 'map' },
  { id: 'favorites', label: '관심 목록', icon: 'favorite' },
  { id: 'setup', label: '취향·조건', icon: 'tune' },
]

// 전역 웹 헤더 — 전 화면 공통. 실제 웹사이트 상단 네비게이션.
export default function SiteHeader() {
  const { pathname } = useLocation()
  const { go } = useNav()
  const favCount = useStore(
    (s) => Object.values(s.state.favorites).filter(Boolean).length,
  )

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-5 py-2.5">
        <button
          onClick={go('home')}
          className="flex items-baseline gap-2 pr-2"
          aria-label="홈"
        >
          <span className="text-[20px] font-extrabold tracking-[-0.5px] text-teal">
            Be:live
          </span>
          <span className="hidden text-[12px] font-medium text-sub md:inline">
            상권·취향 기반 임대 주택 추천 서비스
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          {NAV.map((n) => {
            const active = pathname === SCREEN_PATHS[n.id]
            return (
              <button
                key={n.id}
                onClick={go(n.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={n.label}
                className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
                  active
                    ? 'bg-teal-ghost text-teal'
                    : 'text-body hover:bg-teal-ghost hover:text-teal'
                }`}
              >
                <span className="ms text-[19px]">{n.icon}</span>
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
