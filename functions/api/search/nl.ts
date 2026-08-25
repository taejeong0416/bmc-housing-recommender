// Cloudflare Pages Function — 자유 문장 → 구조화 필터(POST /api/search/nl).
// 정적 배포에서 유일하게 서버가 필요한 지점. 이유는 연산이 아니라 API 키 은닉이다.
// 프롬프트·스키마는 backend/src/search/search.service.ts와 동형 사본이고,
// 결과 shape의 단일 원천은 @bmc/shared-types의 ParsedFilter 타입.
// 레이트리밋은 Cloudflare 대시보드 Rate limiting rules가 담당한다(SURVEY_DEPLOYMENT §6).
import { PREFERENCE_FEATURE_IDS } from '@bmc/shared-types'

interface Env {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
}

const MAX_LEN = 300 // 입력 길이 상한(백엔드 P5-B-1과 동일)
// 대화형 되묻기(followup)는 lite 모델에서 불안정(출력 폭주·구조화 누락) — flash 기본.
const DEFAULT_MODEL = 'gemini-flash-latest'

const SYSTEM = `너는 부산도시공사(BMC) 공공임대주택 검색 도우미다.
사용자의 한국어 문장에서 검색 조건을 구조화해 뽑아라. 문장에 없는 조건 항목은 넣지 마라(생략).
- depositMax / rentMax: 보증금·월세 상한을 만원 단위 숫자로. (예: "보증금 3천만원"=3000, "월 50만원 이하"=50)
- regions: "수영구","기장군" 등 구/군 이름 배열.
- rentType: 공급유형(행복주택·통합공공임대 등)이 명시될 때만. 없으면 생략.
- buildYear: "신축"·"새 집"은 '5년 이내'. "준공 N년" 등은 가장 가까운 보기. 언급 없으면 생략.
- area: 전용면적(m²)이 명시될 때만.
- houseTypes: 방 구조. 문장에 "원룸","1.5룸","투룸","쓰리룸"이 나오면 반드시 넣어라.
- tags: 생활 인프라 선호. 아래 id 중에서만 고른다:
  rail_access(도시철도 접근), cafe_choice(카페), fitness_access(운동시설), supermarket_access(마트), restaurant_choice(외식), culture_access(문화·여가), quiet_residential(조용한 주거), park_walk(공원).
  weight = 강조/"꼭"/"자주"=3, 보통=2, "있으면 좋음"/"멀어도 됨"=1.
- unresolved: 조건으로 해석하지 못한 모호하거나 지원하지 않는 표현을 짧은 구절 배열로(예: 모순된 조건, 위 항목에 없는 축). 모두 명확히 해석했으면 생략.
- followup: 취향을 더 끌어내는 짧은 질문 하나(question)와 탭 가능한 보기 2~4개(options). 각 보기는 짧은 label과 그 선택이 뜻하는 tags(위 8개 id, weight 2~3)를 담는다. 규칙:
  · 사용자가 취향을 모르거나("잘 모르겠어요"·"글쎄요"·"아무거나"·막연) 취향 tags를 아직 못 뽑았으면 반드시 followup을 채운다("취향을 잘 모르겠다"류는 unresolved가 아니라 followup 트리거).
  · [아직 안 물어본 취향 축]이 주어지면 그중 하나를 골라 그 축을 겨냥해 묻는다(한 번에 하나, [파악된 취향]에 이미 있는 축은 다시 묻지 않는다).
  · [파악된 취향]이 2개 이상이면 그중 둘을 놓고 "A와 B 중 뭐가 더 중요하세요?"처럼 하나만 고르게 해 강도를 가린다(각 보기 tags에 해당 축 하나만 weight 3).
  · "잘 모르겠어요"·"상관없어요" 같은 회피 보기는 tags를 비운다.
  · 질문은 존댓말·생활 각도(출퇴근·주말·동네 분위기·집에서 보내는 시간)로. 안 물어본 축이 없고 강도까지 갈렸거나, 사용자가 명확한 조건만 원하면 followup을 비운다.
  취향을 물을 거면 질문을 summary에만 적지 말고 followup의 question+options로 낸다. followup을 채웠으면 unresolved는 비운다.
- summary: 이해한 조건을 요약한 친근한 한 문장(존댓말, 30자 내외). followup을 낼 때는 질문으로 자연스럽게 이어지는 말로.
사용자의 현재 조건이나 관심목록 경향, 파악된 취향이 함께 주어지면, summary에 그 맥락을 자연스럽게 반영해도 된다(단 필터 필드는 이번 문장에 명시된 것만 채워라 — 맥락으로 필드를 임의로 채우지 마라).`

const tagItem = {
  type: 'object',
  properties: {
    id: { type: 'string', enum: [...PREFERENCE_FEATURE_IDS] },
    weight: { type: 'integer' },
  },
  required: ['id', 'weight'],
}

const SCHEMA = {
  type: 'object',
  properties: {
    rentType: { type: 'string' },
    depositMax: { type: 'number' },
    rentMax: { type: 'number' },
    regions: { type: 'array', items: { type: 'string' } },
    buildYear: {
      type: 'string',
      enum: ['5년 이내', '10년 이내', '15년 이내', '제한 없음'],
    },
    area: {
      type: 'string',
      enum: ['~ 30m² (원룸)', '30 ~ 40m²', '40 ~ 60m²', '60m² 이상', '전체'],
    },
    houseTypes: {
      type: 'array',
      items: { type: 'string', enum: ['원룸', '1.5룸', '투룸', '쓰리룸+'] },
    },
    tags: { type: 'array', items: tagItem },
    unresolved: { type: 'array', items: { type: 'string' } },
    followup: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              tags: { type: 'array', items: tagItem },
            },
            required: ['label'],
          },
        },
      },
      required: ['question', 'options'],
    },
    summary: { type: 'string' },
  },
  required: ['summary'],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const onRequestPost = async (ctx: {
  request: Request
  env: Env
}): Promise<Response> => {
  const { request, env } = ctx

  let body: { text?: string; context?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  const text = (body.text ?? '').trim()
  if (!text) return json({ error: '검색 문장이 비었습니다.' }, 400)
  if (text.length > MAX_LEN)
    return json({ error: `검색 문장이 너무 깁니다(최대 ${MAX_LEN}자).` }, 400)

  if (!env.GEMINI_API_KEY)
    return json({ error: 'AI 검색이 설정되지 않았습니다.' }, 503)

  // 개인화 컨텍스트(현재 조건·관심목록 경향·파악된 취향) — 문장이 아니라 참고 맥락이라 상한만 둔다.
  const context = (body.context ?? '').trim().slice(0, MAX_LEN)
  const parts = context ? [{ text: context }, { text }] : [{ text }]
  const model = env.GEMINI_MODEL ?? DEFAULT_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0.1,
        },
      }),
    })
    if (!res.ok) return json({ summary: '조건을 이해했어요.' })

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    return json(JSON.parse(raw))
  } catch {
    // 실패해도 앱이 죽지 않도록 안전한 shape으로 폴백 — 프론트 normalize/augment가 마무리한다.
    return json({ summary: '조건을 이해했어요.' })
  }
}
