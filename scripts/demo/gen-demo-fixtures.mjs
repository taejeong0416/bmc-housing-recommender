// 공개 저장소의 기본 데이터 — 전부 합성이다. 발제사 제공 데이터는 저장소에 올리지 않는다(README §데이터 공개 정책).
// 산출: frontend/src/demo/{housings,preference-features,listing-tags}.json
// 실행: node scripts/demo/gen-demo-fixtures.mjs  (또는 npm run gen:demo-fixtures)
// 실데이터로 앱을 돌리려면 `npm run ingest` → tag 파이프라인이 generated/를 덮어쓴다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildDemoHousings } from './gen-demo-housings.mjs'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/src/demo')

// 취향학습 8축(pairwise.ts PREFERENCE_FEATURES와 동일 순서).
const AXES = [
  'rail_access',
  'cafe_choice',
  'fitness_access',
  'supermarket_access',
  'restaurant_choice',
  'culture_access',
  'quiet_residential',
  'park_walk',
]

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const housings = buildDemoHousings()
const rnd = mulberry32(20260731)

const features = {}
const listings = {}
for (const h of housings) {
  const values = {}
  const evidence = {}
  for (const axis of AXES) {
    const v = +rnd().toFixed(4)
    values[axis] = v
    // nearestName은 null — 합성 데모에 가상 상호명을 만들어 넣지 않는다(UI가 일반 문구로 폴백).
    evidence[axis] = {
      count: Math.round(v * 60),
      nearestMeters: 40 + Math.round((1 - v) * 900),
      nearestName: null,
    }
  }
  features[h.id] = { values, evidence }
  listings[h.id] = {
    universityCommercialArea:
      rnd() > 0.8 ? { campusName: null, meters: 200 + Math.round(rnd() * 800) } : null,
    medicalDaily: +rnd().toFixed(3),
  }
}

const SYNTHETIC = '합성 데모 데이터 — 발제사 제공 데이터 파생물이 아니다.'

mkdirSync(OUT_DIR, { recursive: true })
const write = (name, data) => {
  const path = resolve(OUT_DIR, name)
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`${name} → ${path}`)
}

write('housings.json', housings)
write('preference-features.json', {
  meta: { source: SYNTHETIC, candidates: housings.length },
  features,
})
write('listing-tags.json', {
  meta: { source: SYNTHETIC, listings: housings.length },
  listings,
})
