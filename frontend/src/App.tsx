import { Outlet, useLocation } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import Footer from './components/Footer'
import LearningConsentModal from './components/LearningConsentModal'
import { Toaster } from './components/ui/Toast'

// 로그인·온보딩(취향·조건)은 몰입 흐름이라 전역 헤더를 숨긴다. 지도부터 노출.
const NO_HEADER = [
  '/login',
  '/consent',
  '/preference',
  '/setup',
  '/swipe',
  '/prefill',
]

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
