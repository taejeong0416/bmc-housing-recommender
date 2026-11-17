// fetch 래퍼 — baseURL(env) + JSON 파싱 + ApiError 표준화.
// P2 백엔드 완성 시 VITE_API_BASE_URL만 실제 서버로 바꾸면 전환된다.
import type { RequestHandler } from 'msw'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 실 API 미설정 시 BASE_URL 기준. path는 선행 슬래시 없이('api/housings').
// VITE_API_BASE_URL은 슬래시로 끝나도록 설정.
const BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.BASE_URL

// 실 API 미설정 시 MSW 핸들러를 페이지 안에서 바로 실행해 목 응답을 만든다.
// 서비스워커를 쓰지 않으므로 인앱 브라우저·시크릿 창처럼 서비스워커가 없는 환경에서도 목록이 뜬다.
// 핸들러가 없는 경로(VITE_AI_PROXY일 때 /api/search/nl)는 실제 네트워크로 보낸다.
let mockHandlers: Promise<RequestHandler[]> | null = null
async function send(req: Request): Promise<Response> {
  if (!import.meta.env.VITE_API_BASE_URL) {
    mockHandlers ??= import('../mocks/handlers').then((m) => m.handlers)
    const { getResponse } = await import('msw')
    const mocked = await getResponse(await mockHandlers, req)
    if (mocked) return mocked
  }
  return fetch(req)
}

const url = (path: string) => new URL(`${BASE}${path}`, location.href)

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await send(new Request(url(path)))
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await send(
    new Request(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as T
}
