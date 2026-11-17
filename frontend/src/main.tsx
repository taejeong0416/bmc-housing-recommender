import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import App from './App'
import LandingScreen from './screens/LandingScreen'
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
        { index: true, element: <LandingScreen /> },
        // 이전 취향 설정 화면 주소 — 지금 온보딩의 첫 단계(조건 설정)로 넘긴다.
        { path: 'preference', element: <Navigate to="/setup" replace /> },
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
)
