import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStore } from '../store'

// 인증 필요 라우트 가드. 가짜 세션(loggedIn 플래그) 기준 — 비로그인 시 /login으로.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const loggedIn = useStore((s) => s.state.loggedIn)
  if (!loggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}
