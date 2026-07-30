import { setupServer } from 'msw/node'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { handlers } from './handlers'
import housings from '../generated/housings.json'

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterAll(() => server.close())

const BASE = 'http://localhost/bmc-housing-recommender/'

it('GET api/housings → 전체 목록', async () => {
  const res = await fetch(`${BASE}api/housings`)
  expect(res.status).toBe(200)
  const list = await res.json()
  expect(Array.isArray(list)).toBe(true)
  expect(list.length).toBe(housings.length)
  expect(list[0]).toHaveProperty('id')
})

it('GET api/housings/:id → 단건', async () => {
  const listRes = await fetch(`${BASE}api/housings`)
  const first = (await listRes.json())[0]
  const res = await fetch(`${BASE}api/housings/${first.id}`)
  expect(res.status).toBe(200)
  expect((await res.json()).id).toBe(first.id)
})

it('GET api/housings/없는id → 404', async () => {
  const res = await fetch(`${BASE}api/housings/none`)
  expect(res.status).toBe(404)
})

it('GET api/meta/filters → 공급유형·지역 distinct(정렬·중복제거)', async () => {
  const res = await fetch(`${BASE}api/meta/filters`)
  expect(res.status).toBe(200)
  const meta = await res.json()
  expect(Array.isArray(meta.types)).toBe(true)
  expect(Array.isArray(meta.districts)).toBe(true)
  // 중복 없음 + 오름차순 정렬
  expect(new Set(meta.types).size).toBe(meta.types.length)
  expect([...meta.districts].sort()).toEqual(meta.districts)
  // 실 샘플에 기장군 포함
  expect(meta.districts).toContain('기장군')
})
