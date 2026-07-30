import { http, HttpResponse } from 'msw'
import housings from '../generated/housings.json'
import type { GeneratedHousing } from '../types'

// 인제스천 산출(generated/housings.json)을 /api로 서빙 — 백엔드 없이 실제 fetch 경로 개발.
const data = housings as GeneratedHousing[]

// `*/`로 BASE_URL 접두(예: /bmc-housing-recommender/)를 흡수 — 배포 base와 무관하게 매칭.
// 목데이터에서 distinct 옵션 계산 — 백엔드 /meta/filters와 동형.
const uniqSorted = (vals: string[]) => [...new Set(vals)].sort()

export const handlers = [
  http.get('*/api/housings', () => HttpResponse.json(data)),
  http.get('*/api/housings/:id', ({ params }) => {
    const found = data.find((h) => h.id === params.id)
    return found
      ? HttpResponse.json(found)
      : new HttpResponse(null, { status: 404 })
  }),
  http.get('*/api/meta/filters', () =>
    HttpResponse.json({
      types: uniqSorted(data.map((h) => h.type)),
      districts: uniqSorted(data.map((h) => h.district)),
    }),
  ),
  // AI 자연어 검색: VITE_AI_PROXY면 MSW가 가로채지 않고(bypass) 네트워크로 흘려보내
  // Vite 프록시→실백엔드(서버 키)로 위임한다 — 목데이터(321)+실 AI+키 미노출 하이브리드.
  // 미설정(순수 목, 백엔드 없음)이면 NL 해석이 없으므로 요약만 돌려준다.
  ...(import.meta.env.VITE_AI_PROXY
    ? []
    : [
        http.post('*/api/search/nl', () =>
          HttpResponse.json({
            summary:
              '데모 목서버라 문장 전체 해석 없이 기본 조건으로 보여드려요.',
          }),
        ),
      ]),
]
