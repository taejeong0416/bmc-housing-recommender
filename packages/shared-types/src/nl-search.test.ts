import { describe, expect, it, vi } from 'vitest'
import {
  NL_SCHEMA,
  NlNotConfiguredError,
  callNlModel,
  cleanHistory,
  withStrictObjects,
} from './nl-search'

const claudeReply = (json: unknown, stop_reason = 'end_turn') =>
  new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text: JSON.stringify(json) }],
      stop_reason,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )

const geminiReply = (json: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )

const urlOf = (input: unknown) =>
  typeof input === 'string'
    ? input
    : input instanceof Request
      ? input.url
      : String(input)

// 요청 URL로 Claude/Gemini를 가르는 가짜 fetch.
function fakeFetch(claude: () => Response, gemini: () => Response) {
  return vi.fn(async (input: unknown) =>
    urlOf(input).includes('anthropic.com') ? claude() : gemini(),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

const bodyOf = async (call: unknown[]) =>
  JSON.parse(String((call[1] as RequestInit).body))

describe('withStrictObjects', () => {
  it('모든 object에 additionalProperties: false를 붙이고 원본은 두지 않는다', () => {
    const s = withStrictObjects(NL_SCHEMA) as any
    expect(s.additionalProperties).toBe(false)
    expect(s.properties.tags.items.additionalProperties).toBe(false)
    expect(s.properties.followup.additionalProperties).toBe(false)
    expect(
      s.properties.followup.properties.options.items.additionalProperties,
    ).toBe(false)
    expect((NL_SCHEMA as any).additionalProperties).toBeUndefined()
  })
})

describe('cleanHistory', () => {
  it('형식이 어긋난 턴을 버리고 첫 턴을 user로 맞춘다', () => {
    expect(
      cleanHistory([
        { role: 'assistant', text: '앞 요약' },
        { role: 'user', text: '  카페 좋아요 ' },
        { role: 'system', text: 'x' },
        { role: 'assistant', text: '' },
        { role: 'assistant', text: '주말엔 뭐 하세요?' },
      ]),
    ).toEqual([
      { role: 'user', text: '카페 좋아요' },
      { role: 'assistant', text: '주말엔 뭐 하세요?' },
    ])
  })

  it('배열이 아니면 빈 기록', () => {
    expect(cleanHistory('nope')).toEqual([])
  })
})

describe('callNlModel', () => {
  const input = {
    text: '조용한 곳이요',
    context: '[파악된 취향] 카페 선택지',
    history: [
      { role: 'user' as const, text: '잘 모르겠어요' },
      { role: 'assistant' as const, text: '쉬는 날엔 주로 뭘 하세요?' },
    ],
  }

  it('키가 하나도 없으면 NlNotConfiguredError', async () => {
    await expect(callNlModel(input, {})).rejects.toBeInstanceOf(
      NlNotConfiguredError,
    )
  })

  it('Claude 성공 시 Gemini를 부르지 않고, 대화 기록·스키마를 보낸다', async () => {
    const f = fakeFetch(
      () => claudeReply({ summary: '조용한 곳으로 찾을게요.' }),
      () => geminiReply({ summary: 'gemini' }),
    )
    const r = await callNlModel(input, {
      anthropicApiKey: 'a',
      geminiApiKey: 'g',
      fetch: f,
    })
    expect(r).toEqual({
      raw: { summary: '조용한 곳으로 찾을게요.' },
      provider: 'claude',
    })
    expect(f).toHaveBeenCalledTimes(1)
    const body = await bodyOf(f.mock.calls[0])
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
    ])
    expect(body.messages[2].content).toContain('[이번 문장] 조용한 곳이요')
  })

  it('Claude가 실패하면 Gemini로 폴백한다(대화 기록은 model 역할로)', async () => {
    const f = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: 'credit' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      () => geminiReply({ summary: '폴백 응답' }),
    )
    const r = await callNlModel(input, {
      anthropicApiKey: 'a',
      geminiApiKey: 'g',
      fetch: f,
    })
    expect(r).toEqual({ raw: { summary: '폴백 응답' }, provider: 'gemini' })
    const geminiCall = f.mock.calls.find((c) =>
      urlOf(c[0]).includes('googleapis.com'),
    )!
    const body = await bodyOf(geminiCall)
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual([
      'user',
      'model',
      'user',
    ])
  })

  it('Claude가 거절(refusal)하면 폴백한다', async () => {
    const f = fakeFetch(
      () => claudeReply({ summary: 'x' }, 'refusal'),
      () => geminiReply({ summary: '폴백 응답' }),
    )
    const r = await callNlModel(input, {
      anthropicApiKey: 'a',
      geminiApiKey: 'g',
      fetch: f,
    })
    expect(r.provider).toBe('gemini')
  })

  it('Gemini 키가 없으면 Claude 오류를 그대로 던진다', async () => {
    const f = fakeFetch(
      () => claudeReply({ summary: 'x' }, 'refusal'),
      () => geminiReply({ summary: 'unused' }),
    )
    await expect(
      callNlModel(input, { anthropicApiKey: 'a', fetch: f }),
    ).rejects.toThrow('refusal')
    expect(f).toHaveBeenCalledTimes(1)
  })
})
