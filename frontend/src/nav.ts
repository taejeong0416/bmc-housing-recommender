import { useNavigate } from 'react-router-dom'
import type { ScreenId } from './types'

// 화면 id → URL. 기존 go('screen') 사용처를 라우터로 잇는 매핑(state.screen 대체).
export const SCREEN_PATHS: Record<ScreenId, string> = {
  login: '/login',
  consent: '/consent',
  preference: '/preference',
  home: '/home',
  map: '/map',
  setup: '/setup',
  swipe: '/swipe',
  prefill: '/prefill',
  detail: '/housings',
  mypage: '/mypage',
  favorites: '/favorites',
}

// go(id): 정적 화면 이동 핸들러. goDetail(id): 단지 상세(/housings/:id) 이동 핸들러.
// 빈 id(데이터 미로딩 등)는 no-op — '/housings/'가 '*' 라우트로 새어 /map 리다이렉트되는 것 방지.
export function useNav() {
  const navigate = useNavigate()
  const go = (id: ScreenId) => () => navigate(SCREEN_PATHS[id])
  const goDetail = (id: string) => () => {
    if (id) navigate(`/housings/${id}`)
  }
  return { go, goDetail }
}
