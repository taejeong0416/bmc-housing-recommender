import { Outlet, useLocation } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import Footer from './components/Footer'
import LearningConsentModal from './components/LearningConsentModal'
import { Toaster } from './components/ui/Toast'

// 온보딩 비교 흐름(취향 학습)은 몰입 흐름이라 전역 헤더를 숨긴다.
// 조건 설정(/setup)은 첫 화면이자 상시 재방문 지점이라 헤더를 유지한다.
const NO_HEADER = ['/preference', '/swipe', '/prefill']

export default function App() {
  const { pathname } = useLocation()
  const showHeader = !NO_HEADER.includes(pathname)
  return (
    <div className="flex min-h-screen flex-col">
      {showHeader && <SiteHeader />}
      <main className="flex flex-1 justify-center px-5 pb-[60px] pt-6">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      <LearningConsentModal />
    </div>
  )
}
