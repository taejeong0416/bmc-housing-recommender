import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import App from './App'
import PreferenceScreen from './screens/PreferenceScreen'
import SetupScreen from './screens/SetupScreen'
import SwipeScreen from './screens/SwipeScreen'
import PrefillScreen from './screens/PrefillScreen'
import HomeScreen from './screens/HomeScreen'
import MapScreen from './screens/MapScreen'
import DetailScreen from './screens/DetailScreen'
import FavoritesScreen from './screens/FavoritesScreen'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

const router = createBrowserRouter(
  [
    {
      element: <App />,
      children: [
        { index: true, element: <Navigate to="/setup" replace /> },
        { path: 'preference', element: <PreferenceScreen /> },
        { path: 'setup', element: <SetupScreen /> },
        { path: 'swipe', element: <SwipeScreen /> },
        { path: 'prefill', element: <PrefillScreen /> },
        { path: 'home', element: <HomeScreen /> },
        { path: 'map', element: <MapScreen /> },
        { path: 'housings/:id', element: <DetailScreen /> },
        { path: 'favorites', element: <FavoritesScreen /> },
        { path: '*', element: <Navigate to="/map" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)

// 실제 API(VITE_API_BASE_URL) 미설정 시 MSW 목서버로 generated/housings.json 서빙(개발·Pages 데모).
async function enableMocking() {
  if (import.meta.env.VITE_API_BASE_URL) return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  })
}

// MSW 기동 실패(SW 미지원 브라우저·워커 404 등)해도 앱은 항상 렌더 — 목 없이 뜨면 화면의 에러 상태가 안내한다.
enableMocking()
  .catch((err) =>
    console.error('[msw] 목서버 기동 실패 — 목 없이 렌더합니다:', err),
  )
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )
  })
