// fetch 래퍼 — baseURL(env) + JSON 파싱 + ApiError 표준화.
// P2 백엔드 완성 시 VITE_API_BASE_URL만 실제 서버로 바꾸면 전환된다(HARNESS §5).

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 실 API 미설정 시 BASE_URL 기준(예: /bmc-housing-recommender/) — MSW 서비스워커 스코프 안이라야 가로챈다.
// path는 선행 슬래시 없이('api/housings'). VITE_API_BASE_URL은 슬래시로 끝나도록 설정.
const BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.BASE_URL

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return (await res.json()) as T
}
