// Cloudflare Pages Function — 자유 문장 → 구조화 필터(POST /api/search/nl).
// 정적 배포에서 유일하게 서버가 필요한 지점. 이유는 연산이 아니라 API 키 은닉이다.
// 프롬프트·스키마·모델 호출은 @bmc/shared-types/dist/nl-search 단일 원천(백엔드와 공유)이고,
// 결과 shape의 단일 원천은 @bmc/shared-types의 ParsedFilter 타입.
// 별도 레이트리밋은 두지 않고, 비용 상한은 Claude Console 월 사용 한도가 담당한다(pages.dev에는
// Cloudflare Rate limiting 규칙을 걸 수 없다).
import {
  NL_CONTEXT_MAX_LEN,
  NL_MAX_LEN,
  NlNotConfiguredError,
  callNlModel,
  cleanHistory,
} from '@bmc/shared-types/dist/nl-search'

interface Env {
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_MODEL?: string
  GEMINI_API_KEY?: string // 설정 시 Claude 실패(한도 소진·장애)에 한해 폴백
  GEMINI_MODEL?: string
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

  let body: { text?: string; context?: string; history?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  const text = (body.text ?? '').trim()
  if (!text) return json({ error: '검색 문장이 비었습니다.' }, 400)
  if (text.length > NL_MAX_LEN)
    return json(
      { error: `검색 문장이 너무 깁니다(최대 ${NL_MAX_LEN}자).` },
      400,
    )

  // 개인화 컨텍스트(현재 조건·관심목록 경향·파악된 취향) — 문장이 아니라 참고 맥락이라 상한만 둔다.
  const context = (body.context ?? '').trim().slice(0, NL_CONTEXT_MAX_LEN)

  try {
    const { raw } = await callNlModel(
      { text, context, history: cleanHistory(body.history) },
      {
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        anthropicModel: env.ANTHROPIC_MODEL,
        geminiApiKey: env.GEMINI_API_KEY,
        geminiModel: env.GEMINI_MODEL,
      },
    )
    return json(raw)
  } catch (e) {
    if (e instanceof NlNotConfiguredError)
      return json({ error: e.message }, 503)
    // 실패해도 앱이 죽지 않도록 안전한 shape으로 폴백 — 프론트 normalize/augment가 마무리한다.
    return json({ summary: '조건을 이해했어요.' })
  }
}
