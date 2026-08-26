import { Outlet } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import Footer from './components/Footer'
import LearningConsentModal from './components/LearningConsentModal'
import NoticeModal from './components/NoticeModal'
import { Toaster } from './components/ui/Toast'

// 브랜드 마크는 헤더 한 곳뿐 — 각 화면은 단계 라벨·진행바만 갖는다.
export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 justify-center px-5 pb-[60px] pt-6">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      <NoticeModal />
      <LearningConsentModal />
    </div>
  )
}
